const escapeXML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const labels = {flow:'数据流',call:'接口 / 工具调用',config:'配置装载',event:'运行记录',feedback:'执行循环'};
const types = {ui:'UI',api:'API',service:'SERVICE',runtime:'RUNTIME',model:'MODEL',tool:'TOOL',data:'DATA',external:'EXTERNAL'};
const wrapText = (text,width,size) => {
  const lines = []; let line = '', used = 0;
  for (const token of String(text).match(/[A-Za-z0-9_]+|[\s\S]/g) || []) {
    const measure = value => Array.from(value).reduce((sum,char) => sum + (/[\x00-\x7f]/.test(char) ? size * .58 : size),0);
    const parts = measure(token) > width ? Array.from(token) : [token];
    for (const part of parts) {
      const cost = measure(part);
      if (used + cost > width && line) {lines.push(line.trim()); line = ''; used = 0;}
      if (!line && !part.trim()) continue;
      line += part; used += cost;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
};
const textLines = (lines,x,y,size,color,step = size * 1.45,anchor = 'start') => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${lines.map((line,index) => `<tspan x="${x}" dy="${index ? step : 0}">${escapeXML(line)}</tspan>`).join('')}</text>`;

// Routes contain only M/H/V commands. Use their real distance so short API
// links and long cross-layer routes both read as a steady transfer.
const routeLength = path => {
  const tokens = path.match(/[MHV]|-?(?:\d*\.)?\d+/g);
  let x = 0, y = 0, length = 0;
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++];
    if (command === 'M') {x = Number(tokens[index++]); y = Number(tokens[index++]);}
    else if (command === 'H') {const next = Number(tokens[index++]); length += Math.abs(next - x); x = next;}
    else if (command === 'V') {const next = Number(tokens[index++]); length += Math.abs(next - y); y = next;}
  }
  return length;
};
const renderPackets = (path,edge,index) => {
  const flow = edge.kind === 'flow';
  const distance = routeLength(path);
  const speed = 100;
  const duration = (distance / speed).toFixed(6);
  const color = flow ? '#d3f1ff' : '#efc896';
  const shape = flow ? `<circle r="3" fill="${color}"/>` : `<path d="M0 -3.5 L3.5 0 L0 3.5 L-3.5 0 Z" fill="${color}"/>`;
  return Array.from({length:edge.bidirectional ? 2 : 1},(_,direction) => {
    const delay = (Number(duration) * ((index * .381966 + direction * .5) % 1)).toFixed(6);
    const timing = `dur="${duration}s" begin="-${delay}s" repeatCount="indefinite"`;
    return `<g class="architecture-packet packet-${flow ? 'flow' : 'support'}" data-direction="${direction ? 'reverse' : 'forward'}" data-distance="${distance}" data-speed="${speed}" aria-hidden="true" opacity="0"><circle r="7" fill="${color}" opacity=".1"/><circle r="4.5" fill="${color}" opacity=".16"/>${shape}<animateMotion path="${path}" keyPoints="${direction ? '1;0' : '0;1'}" keyTimes="0;1" calcMode="linear" ${timing}/><animate attributeName="opacity" values="0;${flow ? '1;1' : '.72;.72'};0" keyTimes="0;.03;.97;1" calcMode="linear" ${timing}/></g>`;
  }).join('');
};

export function describeArchitecture(architecture) {
  const names = Object.fromEntries(architecture.nodes.map(node => [node.id,node.label]));
  const layers = architecture.layers.map(layer => `${layer.label}：${architecture.nodes.filter(node => node.layer === layer.id).map(node => [node.label,...(node.items || [])].filter(Boolean).join('，')).join('；')}`);
  const edges = architecture.edges.map((edge,index) => `${String(index + 1).padStart(2,'0')} ${names[edge.from]} ${edge.bidirectional ? '↔' : '→'} ${names[edge.to]}：${relationLabel(edge)}`);
  return [...layers,...edges].join('；');
}

export function renderArchitecture(project) {
  const {nodes,edges,layers} = project.architecture;
  const width = 1080, minBoxHeight = 132, left = 144, right = 154, gapX = 32;
  const positions = {}, rows = [], bands = [];
  layers.forEach(layer => {
    const group = nodes.filter(node => node.layer === layer.id);
    const columns = group.length === 4 ? 2 : 3;
    for (let offset = 0; offset < group.length; offset += columns) {
      const lane = group.slice(offset,offset + columns);
      const boxWidth = Math.min(290,(width - left - right - (lane.length - 1) * gapX) / lane.length);
      const start = left + (width - left - right - lane.length * boxWidth - (lane.length - 1) * gapX) / 2;
      let rowHeight = minBoxHeight;
      lane.forEach((node,index) => {
        const titleLines = wrapText(node.label,boxWidth - 28,17);
        const detailLines = (node.items || []).flatMap(detail => wrapText(detail,boxWidth - 28,12));
        const detailY = 64 + titleLines.length * 23;
        const lastBaseline = detailLines.length ? detailY + (detailLines.length - 1) * 18 : 53 + Math.max(0,titleLines.length - 1) * 23;
        rowHeight = Math.max(rowHeight,Math.ceil((lastBaseline + 22) / 4) * 4);
        positions[node.id] = {x:start + index * (boxWidth + gapX),width:boxWidth,row:rows.length,column:index,titleLines,detailLines,detailY};
      });
      lane.forEach(node => {positions[node.id].height = rowHeight;});
      rows.push({nodes:lane,layer,first:offset === 0,height:rowHeight});
    }
  });

  // Every connection gets a horizontal track in the relevant row gap. Long
  // connections use separate outer lanes, leaving the cards and layer headers
  // clear. Reserve the space before positioning cards, rather than squeezing
  // all routes into a fixed-height gap.
  const gaps = Array.from({length:rows.length + 1},() => []);
  const ports = new Map();
  const sideCounts = {left:0,right:0};
  const routes = edges.map((edge,index) => {
    const from = positions[edge.from], to = positions[edge.to];
    const same = from.row === to.row, forward = to.row > from.row;
    const adjacent = Math.abs(to.row - from.row) === 1;
    const route = {edge,index,same,adjacent,forward,fromFace:same || !forward ? 'top' : 'bottom',toFace:same || forward ? 'top' : 'bottom'};
    for (const [end,node,peer] of [['from',from,to],['to',to,from]]) {
      const key = `${edge[end]}:${route[`${end}Face`]}`;
      if (!ports.has(key)) ports.set(key,[]);
      ports.get(key).push({route,end,x:peer.x + peer.width / 2});
    }
    if (!same && !adjacent) {
      const center = (from.x + from.width / 2 + to.x + to.width / 2) / 2;
      const leftCost = center - (left - 38) + sideCounts.left * 180;
      const rightCost = width - right + 38 - center + sideCounts.right * 180;
      route.side = leftCost <= rightCost ? 'left' : 'right';
      route.lane = sideCounts[route.side]++;
    }
    return route;
  });
  for (const entries of ports.values()) {
    entries.sort((a,b) => a.x - b.x || a.route.index - b.route.index);
    entries.forEach((entry,index) => {
      const node = positions[entry.route.edge[entry.end]];
      if (entry.route[`${entry.end}Face`] === 'top') {
        // Enter the card from its left edge. The vertical segment stays in
        // the inter-card gutter (or the first-column margin), so it cannot
        // cross the layer heading that sits above the cards.
        entry.route[`${entry.end}X`] = node.x;
        entry.route[`${entry.end}LaneX`] = (node.column === 0 ? left : node.x) - 8 - 20 * (index + 1) / (entries.length + 1);
        entry.route[`${entry.end}OffsetY`] = 35 + (node.height - 60) * (index + 1) / (entries.length + 1);
      } else entry.route[`${entry.end}X`] = node.x + 22 + (node.width - 44) * (index + 1) / (entries.length + 1);
    });
  }
  const reserveTrack = (route,key,gap) => {
    route[key] = {gap,index:gaps[gap].length};
    gaps[gap].push(route);
  };
  [...routes].sort((a,b) => Number(b.edge.kind === 'flow') - Number(a.edge.kind === 'flow') || a.index - b.index).forEach(route => {
    const from = positions[route.edge.from], to = positions[route.edge.to];
    if (route.same) reserveTrack(route,'track',from.row);
    else if (route.adjacent) reserveTrack(route,'track',Math.max(from.row,to.row));
    else {
      reserveTrack(route,'exit',route.forward ? from.row + 1 : from.row);
      reserveTrack(route,'entry',route.forward ? to.row : to.row + 1);
    }
  });
  let cursor = 0;
  rows.forEach((row,index) => {
    const headerSpace = row.first ? 48 : 0;
    const gapHeight = Math.max(84 + headerSpace,56 + Math.max(0,gaps[index].length - 1) * 26 + headerSpace);
    gaps[index].forEach((_,track) => {gaps[index][track] = cursor + 28 + track * 26;});
    cursor += gapHeight;
    row.nodes.forEach(node => {positions[node.id].y = cursor;});
    const band = bands.find(item => item.id === row.layer.id);
    if (band) band.height = cursor + row.height - band.y;
    else bands.push({...row.layer,y:cursor - 56,height:row.height + 56});
    cursor += row.height;
  });
  const graphBottom = cursor;
  const markerId = `arrow-${project.id}`;
  const bandMarkup = bands.map((layer,index) => `<g data-layer="${escapeXML(layer.id)}"><rect x="${left - 14}" y="${layer.y}" width="${width - left - right + 28}" height="${layer.height + 12}" rx="6" fill="#0b141d" stroke="#253541"/>${textLines(wrapText(`${String(index + 1).padStart(2,'0')} / ${layer.label}`,200,15),left,layer.y + 30,15,'#d0e2ef')}${textLines(wrapText(layer.caption || '',200,10),width - right,layer.y + 29,10,'#7994a8',14,'end')}</g>`).join('');
  const trackY = track => gaps[track.gap][track.index];
  const lineMarkup = routes.map(route => {
    const {edge,index,fromX:x1,toX:x2} = route;
    const from = positions[edge.from], to = positions[edge.to];
    const y1 = from.y + (route.fromFace === 'bottom' ? from.height : route.fromOffsetY);
    const y2 = to.y + (route.toFace === 'bottom' ? to.height : route.toOffsetY);
    const startX = route.fromLaneX ?? x1, endX = route.toLaneX ?? x2;
    const start = `M${x1} ${y1}${route.fromFace === 'top' ? ` H${startX}` : ''}`;
    const end = `V${y2}${route.toFace === 'top' ? ` H${x2}` : ''}`;
    let path, labelX, labelY;
    if (route.same || route.adjacent) {
      labelY = trackY(route.track);
      path = `${start} V${labelY} H${endX} ${end}`;
      labelX = (startX + endX) / 2;
    } else {
      const routeX = route.side === 'left' ? left - 38 - route.lane * 24 : width - right + 38 + route.lane * 24;
      const exitY = trackY(route.exit), entryY = trackY(route.entry);
      path = `${start} V${exitY} H${routeX} V${entryY} H${endX} ${end}`;
      labelX = (startX + routeX) / 2; labelY = exitY;
    }
    const color = edge.kind === 'flow' ? '#afcee3' : '#5c7b92';
    const number = String(index + 1).padStart(2,'0');
    return `<g data-edge="${number}" data-kind="${escapeXML(edge.kind)}"><path class="architecture-route" d="${path}" fill="none" stroke="${color}" stroke-width="${edge.kind === 'flow' ? '1.5' : '1.1'}" ${edge.kind === 'flow' ? '' : 'stroke-dasharray="4 7"'} ${edge.bidirectional ? `marker-start="url(#${markerId})"` : ''} marker-end="url(#${markerId})"/>${renderPackets(path,edge,index)}<circle cx="${labelX}" cy="${labelY}" r="10" fill="#0a1015" stroke="${color}"/>${textLines([number],labelX,labelY + 3.5,10,'#c1d9ea',14,'middle')}</g>`;
  }).join('');
  const nodeMarkup = nodes.map(node => {
    const {x,y,width:boxWidth,height:boxHeight,titleLines,detailLines,detailY} = positions[node.id];
    const core = node.id === project.architecture.focus;
    const dataGlyph = node.type === 'data' ? `<path d="M${x + 14} ${y + 19} q5 -5 10 0 v9 q-5 5 -10 0 z m0 -5 q5 5 10 0" fill="none" stroke="#85a9c2"/>` : '';
    const badgeX = x + (node.type === 'data' ? 31 : 14);
    return `<g data-node="${escapeXML(node.id)}"><rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="5" fill="${core ? '#152b3a' : '#101e29'}" stroke="${core ? '#a6d0eb' : '#405c70'}"/>${dataGlyph}${textLines([types[node.type] || 'COMPONENT'],badgeX,y + 22,10,'#85a9c2')}${textLines(titleLines,x + 14,y + 53,17,'#edf4f8',23)}${textLines(detailLines,x + 14,y + detailY,12,'#a4bacb',18)}</g>`;
  }).join('');
  let legendY = graphBottom + 54;
  const legendHeading = textLines(['技术连接 / 调用与数据流'],24,legendY,16,'#d0e2ef');
  legendY += 36;
  let legendMarkup = '';
  for (let offset = 0; offset < edges.length; offset += 2) {
    let rowHeight = 0;
    edges.slice(offset,offset + 2).forEach((edge,index) => {
      const number = String(offset + index + 1).padStart(2,'0');
      const x = 24 + index * 468;
      const from = nodes.find(node => node.id === edge.from), to = nodes.find(node => node.id === edge.to);
      const nameLines = wrapText(`${from.label} ${edge.bidirectional ? '↔' : '→'} ${to.label}`,404,13);
      const detailLines = wrapText(relationLabel(edge),404,12);
      const detailY = legendY + nameLines.length * 19 + 3;
      rowHeight = Math.max(rowHeight,nameLines.length * 19 + detailLines.length * 18 + 25);
      legendMarkup += `${textLines([number],x,legendY,10,'#85a9c2')}${textLines(nameLines,x + 30,legendY,13,'#d0e2ef',19)}${textLines(detailLines,x + 30,detailY,12,'#8da9bd',18)}`;
    });
    legendY += rowHeight;
  }
  const height = legendY + 12;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMin meet" role="img" aria-labelledby="title-${project.id}" aria-describedby="desc-${project.id}" style="font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;background:#0a1015"><title id="title-${project.id}">${escapeXML(project.title)} · ${escapeXML(project.architecture.title || '技术架构')}</title><desc id="desc-${project.id}">${escapeXML([project.architecture.note,describeArchitecture(project.architecture)].filter(Boolean).join('；'))}</desc><style>.architecture-packet{pointer-events:none}svg[data-motion="paused"] .architecture-packet{visibility:hidden}@media(prefers-reduced-motion:reduce){.architecture-packet{display:none}}</style><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#85a9c2"/></marker></defs>${bandMarkup}${lineMarkup}${nodeMarkup}${legendHeading}${legendMarkup}</svg>`;
}

export function relationLabel(edge) {return edge.label || labels[edge.kind];}
export function componentType(node) {return types[node.type] || 'COMPONENT';}
