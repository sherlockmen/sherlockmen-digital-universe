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
  const duration = (Math.max(1.9,Math.min(6.4,routeLength(path) / 125)) + .65).toFixed(2);
  const color = flow ? '#d3f1ff' : '#efc896';
  const shape = flow ? `<circle r="3.3" fill="${color}"/>` : `<path d="M0 -4 L4 0 L0 4 L-4 0 Z" fill="${color}"/>`;
  return Array.from({length:edge.bidirectional ? 2 : 1},(_,direction) => {
    const delay = ((index * .43 + direction * 1.1) % Number(duration)).toFixed(2);
    const timing = `dur="${duration}s" begin="-${delay}s" repeatCount="indefinite"`;
    return `<g class="architecture-packet packet-${flow ? 'flow' : 'support'}" data-direction="${direction ? 'reverse' : 'forward'}" aria-hidden="true" opacity="0"><circle r="9" fill="${color}" opacity=".12"/><circle r="5.5" fill="${color}" opacity=".18"/>${shape}<animateMotion path="${path}" keyPoints="${direction ? '1;0;0' : '0;1;1'}" keyTimes="0;.82;1" calcMode="linear" ${timing}/><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.035;.76;.82;1" calcMode="linear" ${timing}/></g>`;
  }).join('');
};

export function describeArchitecture(architecture) {
  const names = Object.fromEntries(architecture.nodes.map(node => [node.id,node.label]));
  const layers = architecture.layers.map(layer => `${layer.label}：${architecture.nodes.filter(node => node.layer === layer.id).map(node => [node.label,node.state,...(node.items || [])].filter(Boolean).join('，')).join('；')}`);
  const edges = architecture.edges.map((edge,index) => `${String(index + 1).padStart(2,'0')} ${names[edge.from]} ${edge.bidirectional ? '↔' : '→'} ${names[edge.to]}：${relationLabel(edge)}`);
  return [...layers,...edges].join('；');
}

export function renderArchitecture(project) {
  const {nodes,edges,layers} = project.architecture;
  const width = 1080, boxHeight = 132, gapY = 80, left = 144, right = 154, gapX = 32;
  const positions = {}, bands = [];
  let cursor = 28;
  layers.forEach(layer => {
    const group = nodes.filter(node => node.layer === layer.id);
    const top = cursor;
    for (let offset = 0; offset < group.length; offset += 3) {
      const lane = group.slice(offset,offset + 3);
      const boxWidth = Math.min(290,(width - left - right - (lane.length - 1) * gapX) / lane.length);
      const start = left + (width - left - right - lane.length * boxWidth - (lane.length - 1) * gapX) / 2;
      lane.forEach((node,index) => {positions[node.id] = {x:start + index * (boxWidth + gapX),y:cursor,width:boxWidth};});
      cursor += boxHeight + gapY;
    }
    bands.push({...layer,y:top,height:cursor - top - gapY});
  });
  const graphBottom = cursor - gapY;
  const markerId = `arrow-${project.id}`;
  const bandMarkup = bands.map((layer,index) => `<g data-layer="${escapeXML(layer.id)}"><rect x="${left - 14}" y="${layer.y - 12}" width="${width - left - right + 28}" height="${layer.height + 24}" rx="6" fill="#0b141d" stroke="#253541"/>${textLines([String(index + 1).padStart(2,'0')],24,layer.y + 20,11,'#6f92aa')}${textLines(wrapText(layer.label,96,15),24,layer.y + 46,15,'#d0e2ef')}${textLines(wrapText(layer.caption || '',96,10),24,layer.y + 94,10,'#7994a8')}</g>`).join('');
  let sideRoute = 0;
  const lineMarkup = edges.map((edge,index) => {
    const from = positions[edge.from], to = positions[edge.to];
    const sx = from.x + from.width / 2, tx = to.x + to.width / 2;
    const port = ((index % 3) - 1) * 18;
    let path, labelX, labelY;
    if (edge.from === edge.to) {
      const x = from.x + from.width, y = from.y;
      path = `M${x - 24} ${y} V${y - 30} H${x + 16} V${y + 46} H${x}`;
      labelX = x + 16; labelY = y + 12;
    } else if (from.y === to.y) {
      const forward = to.x > from.x;
      const x1 = forward ? from.x + from.width : from.x, x2 = forward ? to.x : to.x + to.width;
      const y = from.y + boxHeight / 2;
      if (Math.abs(x2 - x1) <= gapX + 1) {
        path = `M${x1} ${y} H${x2}`; labelX = (x1 + x2) / 2; labelY = y - 19;
      } else {
        const routeY = from.y - 34;
        path = `M${sx} ${from.y} V${routeY} H${tx} V${to.y}`;
        labelX = (sx + tx) / 2; labelY = routeY;
      }
    } else {
      const forward = to.y > from.y;
      const x1 = sx + port, x2 = tx + port;
      const y1 = forward ? from.y + boxHeight : from.y, y2 = forward ? to.y : to.y + boxHeight;
      const adjacent = Math.abs(from.y - to.y) === boxHeight + gapY;
      if (adjacent) {
        const middle = (y1 + y2) / 2 + port / 2;
        path = `M${x1} ${y1} V${middle} H${x2} V${y2}`;
        labelX = (x1 + x2) / 2; labelY = middle;
      } else {
        const routeX = width - right + 36 + sideRoute++ * 28;
        const entryY = y1 + (forward ? 36 : -36), exitY = y2 + (forward ? -36 : 36);
        path = `M${x1} ${y1} V${entryY} H${routeX} V${exitY} H${x2} V${y2}`;
        labelX = routeX; labelY = (entryY + exitY) / 2;
      }
    }
    const color = edge.kind === 'flow' ? '#afcee3' : '#6f91aa';
    const number = String(index + 1).padStart(2,'0');
    return `<g data-edge="${number}" data-kind="${escapeXML(edge.kind)}"><path class="architecture-route" d="${path}" fill="none" stroke="${color}" stroke-width="1.4" ${edge.kind === 'flow' ? '' : 'stroke-dasharray="5 4"'} ${edge.bidirectional ? `marker-start="url(#${markerId})"` : ''} marker-end="url(#${markerId})"/>${renderPackets(path,edge,index)}<circle cx="${labelX}" cy="${labelY}" r="12" fill="#0a1015" stroke="${color}"/>${textLines([number],labelX,labelY + 3.5,10,'#c1d9ea',14,'middle')}</g>`;
  }).join('');
  const nodeMarkup = nodes.map(node => {
    const {x,y,width:boxWidth} = positions[node.id];
    const titleLines = wrapText(node.label,boxWidth - 28,17);
    const detailLines = (node.items || []).flatMap(detail => wrapText(detail,boxWidth - 28,12));
    const core = node.id === project.architecture.focus;
    const state = node.state ? textLines([node.state],x + boxWidth - 14,y + 22,10,'#cdbca1',14,'end') : '';
    const dataGlyph = node.type === 'data' ? `<path d="M${x + 14} ${y + 19} q5 -5 10 0 v9 q-5 5 -10 0 z m0 -5 q5 5 10 0" fill="none" stroke="#85a9c2"/>` : '';
    const badgeX = x + (node.type === 'data' ? 31 : 14);
    return `<g data-node="${escapeXML(node.id)}"><rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="5" fill="${core ? '#152b3a' : '#101e29'}" stroke="${core ? '#a6d0eb' : '#405c70'}" ${node.state === '规划' ? 'stroke-dasharray="5 4"' : ''}/>${dataGlyph}${textLines([types[node.type] || 'COMPONENT'],badgeX,y + 22,10,'#85a9c2')}${state}${textLines(titleLines,x + 14,y + 53,17,'#edf4f8',23)}${textLines(detailLines,x + 14,y + 64 + titleLines.length * 23,12,'#a4bacb',18)}</g>`;
  }).join('');
  let legendY = graphBottom + 74;
  const motionNote = textLines(['流动示意 · 非实时数据 / 圆点：数据传递 · 菱形：接口调用与配置'],24,graphBottom + 38,11,'#8da9bd');
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title-${project.id}" aria-describedby="desc-${project.id}" style="font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;background:#0a1015"><title id="title-${project.id}">${escapeXML(project.title)} · ${escapeXML(project.architecture.title || '技术架构')}</title><desc id="desc-${project.id}">${escapeXML(['光点仅示意调用与数据流向，非实时数据。',project.architecture.note,describeArchitecture(project.architecture)].filter(Boolean).join('；'))}</desc><style>.architecture-packet{pointer-events:none}svg[data-motion="paused"] .architecture-packet{visibility:hidden}@media(prefers-reduced-motion:reduce){.architecture-packet{display:none}}</style><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#85a9c2"/></marker></defs>${bandMarkup}${lineMarkup}${nodeMarkup}${motionNote}${legendHeading}${legendMarkup}</svg>`;
}

export function relationLabel(edge) {return edge.label || labels[edge.kind];}
export function componentType(node) {return types[node.type] || 'COMPONENT';}
