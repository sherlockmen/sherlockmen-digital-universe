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

const edgeWeight = edge => edge.kind === 'flow' ? 5 : edge.kind === 'call' ? 3 : 1;
const columnCache = new WeakMap();

// Keep one row per technical layer. Choose column assignments from the real
// dependencies, so a main execution path aligns vertically and same-layer
// processing chains run left to right. Four-component layers stay on one row.
const arrangeColumns = architecture => {
  if (columnCache.has(architecture)) return columnCache.get(architecture);
  const {nodes,edges,layers,focus} = architecture;
  const rows = layers.map(layer => nodes.filter(node => node.layer === layer.id));
  const rank = Object.fromEntries(rows.flatMap((row,index) => row.map(node => [node.id,index])));
  const candidates = rows.map(row => {
    const options = [];
    const visit = (index,used,columns) => {
      if (index === row.length) {options.push({...columns}); return;}
      for (let column = 0; column < 4; column++) {
        if (used.has(column) || row[index].id === focus && column !== 1) continue;
        used.add(column); columns[row[index].id] = column;
        visit(index + 1,used,columns); used.delete(column);
      }
    };
    visit(0,new Set(),{});
    return options;
  });
  const inversions = [];
  for (let index = 0; index < edges.length; index++) {
    const a = edges[index];
    if (Math.abs(rank[a.from] - rank[a.to]) !== 1) continue;
    const aTop = rank[a.from] < rank[a.to] ? a.from : a.to;
    const aBottom = aTop === a.from ? a.to : a.from;
    for (const b of edges.slice(index + 1)) {
      if (Math.abs(rank[b.from] - rank[b.to]) !== 1 || Math.min(rank[b.from],rank[b.to]) !== rank[aTop]) continue;
      const bTop = rank[b.from] < rank[b.to] ? b.from : b.to;
      inversions.push([aTop,aBottom,bTop,bTop === b.from ? b.to : b.from]);
    }
  }
  const score = columns => {
    let cost = nodes.reduce((sum,node) => sum + Math.abs(columns[node.id] - 1.5) * .025,0);
    for (const edge of edges) {
      const from = columns[edge.from], to = columns[edge.to];
      const distance = Math.abs(from - to), separation = Math.abs(rank[edge.from] - rank[edge.to]);
      cost += distance * edgeWeight(edge) * (separation === 0 ? 1.7 : separation === 1 ? 1 : .45);
      if (!separation && edge.kind === 'flow' && to < from) cost += 2;
      if (separation > 1) cost += (6 - from - to) * .18;
    }
    // A column swap that reduces distance can still introduce a crossing.
    // Penalize actual endpoint inversions between adjacent technical layers.
    for (const [aTop,aBottom,bTop,bBottom] of inversions) {
      if ((columns[aTop] - columns[bTop]) * (columns[aBottom] - columns[bBottom]) < 0) cost += 11;
    }
    return cost;
  };
  let bestCost = Infinity, best;
  const search = (row,columns) => {
    if (row === candidates.length) {
      const cost = score(columns);
      if (cost < bestCost) {bestCost = cost; best = {...columns};}
      return;
    }
    for (const candidate of candidates[row]) search(row + 1,{...columns,...candidate});
  };
  search(0,{});
  columnCache.set(architecture,best);
  return best;
};

const compactPath = points => {
  const clean = [];
  for (const point of points) {
    const last = clean.at(-1), previous = clean.at(-2);
    if (last && point[0] === last[0] && point[1] === last[1]) continue;
    if (previous && (previous[0] === last[0] && last[0] === point[0] && (last[1] - previous[1]) * (point[1] - last[1]) >= 0 || previous[1] === last[1] && last[1] === point[1] && (last[0] - previous[0]) * (point[0] - last[0]) >= 0)) clean.pop();
    clean.push(point);
  }
  return clean.map(([x,y],index) => !index ? `M${x} ${y}` : clean[index - 1][0] === x ? ` V${y}` : ` H${x}`).join('');
};

export function layoutArchitecture(architecture) {
  const {nodes,edges,layers} = architecture;
  const columns = arrangeColumns(architecture);
  const left = 144, boxWidth = 224, columnStep = 256;
  const positions = {}, rows = layers.map(layer => ({layer,nodes:nodes.filter(node => node.layer === layer.id),height:148}));
  rows.forEach((row,index) => row.nodes.forEach(node => {
    const titleLines = wrapText(node.label,boxWidth - 32,17);
    const detailLines = (node.items || []).flatMap(detail => wrapText(detail,boxWidth - 32,12));
    const detailY = 62 + titleLines.length * 23;
    row.height = Math.max(row.height,Math.ceil((detailY + Math.max(0,detailLines.length - 1) * 18 + 24) / 4) * 4);
    positions[node.id] = {x:left + columns[node.id] * columnStep,width:boxWidth,row:index,column:columns[node.id],titleLines,detailLines,detailY};
  }));
  rows.forEach(row => row.nodes.forEach(node => {positions[node.id].height = row.height;}));

  const gaps = Array.from({length:rows.length + 1},() => []);
  const ports = new Map();
  let outerCount = 0;
  const routes = edges.map((edge,index) => {
    const from = positions[edge.from], to = positions[edge.to];
    const same = from.row === to.row, forward = from.row < to.row;
    const direct = same && Math.abs(from.column - to.column) === 1;
    const aligned = !same && Math.abs(from.row - to.row) === 1 && from.column === to.column;
    const route = {edge,index,same,direct,aligned,forward};
    route.fromFace = direct ? from.column < to.column ? 'right' : 'left' : same || !forward ? 'top' : 'bottom';
    route.toFace = direct ? from.column < to.column ? 'left' : 'right' : same || forward ? 'top' : 'bottom';
    for (const end of ['from','to']) {
      const key = `${edge[end]}:${route[`${end}Face`]}`;
      if (!ports.has(key)) ports.set(key,[]);
      ports.get(key).push({route,end,peer:positions[edge[end === 'from' ? 'to' : 'from']]});
    }
    if (!same && Math.abs(from.row - to.row) > 1) route.outerLane = outerCount++;
    return route;
  });
  // Same-layer links use opposing side ports. Cross-layer links enter the
  // actual top or bottom edge instead of circling around the card's side.
  for (const [key,entries] of ports) {
    const face = key.split(':').at(-1);
    entries.sort((a,b) => a.peer.column - b.peer.column || a.peer.row - b.peer.row || a.route.index - b.route.index);
    entries.forEach((entry,index) => {
      const node = positions[entry.route.edge[entry.end]];
      const center = index - (entries.length - 1) / 2;
      entry.route[`${entry.end}Offset`] = ['left','right'].includes(face) ? node.height / 2 + center * 18 : node.width / 2 + center * 22;
    });
  }
  const addTrack = (route,name,gap) => {
    route[name] = {gap,index:gaps[gap].length};
    gaps[gap].push({route,name});
  };
  routes.filter(route => !route.direct).sort((a,b) => {
    const aSpan = Math.abs(positions[a.edge.from].column - positions[a.edge.to].column);
    const bSpan = Math.abs(positions[b.edge.from].column - positions[b.edge.to].column);
    return aSpan - bSpan || a.index - b.index;
  }).forEach(route => {
    const from = positions[route.edge.from], to = positions[route.edge.to];
    if (route.same) addTrack(route,'track',from.row);
    else if (route.outerLane === undefined) addTrack(route,'track',Math.max(from.row,to.row));
    else {
      addTrack(route,'exit',route.forward ? from.row + 1 : from.row);
      addTrack(route,'entry',route.forward ? to.row : to.row + 1);
    }
  });
  let cursor = 0;
  rows.forEach((row,index) => {
    const gapHeight = Math.max(index ? 80 : 36,40 + gaps[index].length * 16);
    gaps[index].forEach((track,trackIndex) => {track.y = cursor + 24 + trackIndex * 16;});
    cursor += gapHeight;
    row.y = cursor;
    row.nodes.forEach(node => {positions[node.id].y = cursor;});
    cursor += row.height;
  });
  gaps.at(-1).forEach((track,trackIndex) => {track.y = cursor + 24 + trackIndex * 16;});
  const point = (route,end) => {
    const node = positions[route.edge[end]], face = route[`${end}Face`], offset = route[`${end}Offset`];
    return [face === 'left' ? node.x : face === 'right' ? node.x + node.width : node.x + offset,face === 'top' ? node.y : face === 'bottom' ? node.y + node.height : node.y + offset];
  };
  const trackY = track => gaps[track.gap][track.index].y;
  const routePoints = route => {
    const from = point(route,'from'), to = point(route,'to');
    let points;
    if (route.direct) {
      const middle = (from[0] + to[0]) / 2;
      points = [from,[middle,from[1]],[middle,to[1]],to];
    } else if (route.outerLane === undefined) {
      const y = trackY(route.track);
      points = [from,[from[0],y],[to[0],y],to];
    } else {
      const x = 1172 + route.outerLane * 18, exit = trackY(route.exit), entry = trackY(route.entry);
      points = [from,[from[0],exit],[x,exit],[x,entry],[to[0],entry],to];
    }
    return points;
  };
  const crossingCost = () => {
    const segments = routes.flatMap(route => {
      const points = routePoints(route);
      return points.slice(1).map((to,index) => ({route,from:points[index],to})).filter(segment => segment.from[0] !== segment.to[0] || segment.from[1] !== segment.to[1]);
    });
    let cost = 0;
    for (let index = 0; index < segments.length; index++) {
      const a = segments[index];
      for (const b of segments.slice(index + 1)) {
        if (a.route === b.route) continue;
        const av = a.from[0] === a.to[0], bv = b.from[0] === b.to[0];
        if (av === bv) {
          const constant = av ? 0 : 1, axis = 1 - constant;
          if (a.from[constant] === b.from[constant] && Math.min(Math.max(a.from[axis],a.to[axis]),Math.max(b.from[axis],b.to[axis])) > Math.max(Math.min(a.from[axis],a.to[axis]),Math.min(b.from[axis],b.to[axis]))) cost += 100;
        } else {
          const vertical = av ? a : b, horizontal = av ? b : a;
          if (Math.min(horizontal.from[0],horizontal.to[0]) < vertical.from[0] && vertical.from[0] < Math.max(horizontal.from[0],horizontal.to[0]) && Math.min(vertical.from[1],vertical.to[1]) < horizontal.from[1] && horizontal.from[1] < Math.max(vertical.from[1],vertical.to[1])) cost += a.route.edge.kind === 'flow' && b.route.edge.kind === 'flow' ? 3 : 1;
        }
      }
    }
    return cost;
  };
  // Track order matters as much as card order. Swap independent tracks and
  // outer lanes until the actual routed geometry has fewer crossings.
  let cost = crossingCost();
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (const tracks of gaps) {
      for (let a = 0; a < tracks.length; a++) for (let b = a + 1; b < tracks.length; b++) {
        [tracks[a].y,tracks[b].y] = [tracks[b].y,tracks[a].y];
        const next = crossingCost();
        if (next < cost) {cost = next; improved = true;}
        else [tracks[a].y,tracks[b].y] = [tracks[b].y,tracks[a].y];
      }
    }
    const outer = routes.filter(route => route.outerLane !== undefined);
    for (let a = 0; a < outer.length; a++) for (let b = a + 1; b < outer.length; b++) {
      [outer[a].outerLane,outer[b].outerLane] = [outer[b].outerLane,outer[a].outerLane];
      const next = crossingCost();
      if (next < cost) {cost = next; improved = true;}
      else [outer[a].outerLane,outer[b].outerLane] = [outer[b].outerLane,outer[a].outerLane];
    }
    if (!improved) break;
  }
  for (const route of routes) {
    route.path = compactPath(routePoints(route));
    route.fromPoint = point(route,'from'); route.toPoint = point(route,'to');
  }
  return {positions,rows,routes,width:Math.max(1216,1190 + outerCount * 18),graphBottom:cursor};
}

export function renderArchitecture(project) {
  const {nodes,edges,layers} = project.architecture;
  const {positions,rows,routes,width,graphBottom} = layoutArchitecture(project.architecture);
  const markerId = `arrow-${project.id}`;
  const bandMarkup = rows.map((row,index) => `<g data-layer="${escapeXML(row.layer.id)}"><rect x="132" y="${row.y - 12}" width="1016" height="${row.height + 24}" rx="10" fill="#0d1720" fill-opacity=".86" stroke="#263847"/>${textLines([String(index + 1).padStart(2,'0')],24,row.y + 18,10,'#81afcc')}${textLines(wrapText(row.layer.label,96,14),24,row.y + 47,14,'#d0e2ef',20)}${textLines(wrapText(row.layer.caption || '',96,9),24,row.y + row.height - 20,9,'#6f92aa',13)}</g>`).join('');
  const lineMarkup = [...routes].sort((a,b) => Number(a.edge.kind === 'flow') - Number(b.edge.kind === 'flow')).map(route => {
    const {edge,index,path} = route;
    const color = edge.kind === 'flow' ? '#b8dbf2' : '#6d91ac';
    const number = String(index + 1).padStart(2,'0');
    // A dark clearance stroke separates unavoidable perpendicular crossings.
    // Crossing paths never look like an unintended branch or shared junction.
    return `<g data-edge="${number}" data-kind="${escapeXML(edge.kind)}" data-from="${escapeXML(edge.from)}" data-to="${escapeXML(edge.to)}"><path d="${path}" fill="none" stroke="#0a1119" stroke-width="6"/><path class="architecture-route" d="${path}" fill="none" stroke="${color}" stroke-width="${edge.kind === 'flow' ? '1.7' : '1.2'}" stroke-linejoin="round" ${edge.kind === 'flow' ? '' : 'stroke-dasharray="4 6"'} ${edge.bidirectional ? `marker-start="url(#${markerId})"` : ''} marker-end="url(#${markerId})"/>${renderPackets(path,edge,index)}</g>`;
  }).join('');
  const nodeMarkup = nodes.map(node => {
    const {x,y,width:boxWidth,height:boxHeight,titleLines,detailLines,detailY} = positions[node.id];
    const core = node.id === project.architecture.focus;
    const dataGlyph = node.type === 'data' ? `<path d="M${x + 16} ${y + 20} q5 -5 10 0 v9 q-5 5 -10 0 z m0 -5 q5 5 10 0" fill="none" stroke="#85a9c2"/>` : '';
    return `<g data-node="${escapeXML(node.id)}"><rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="8" fill="${core ? '#173244' : '#111f2b'}" stroke="${core ? '#a6d0eb' : '#426278'}" stroke-width="${core ? 1.5 : 1}"/>${dataGlyph}${textLines([types[node.type] || 'COMPONENT'],x + (node.type === 'data' ? 33 : 16),y + 23,10,'#85a9c2')}${textLines(titleLines,x + 16,y + 54,17,'#edf4f8',23)}${textLines(detailLines,x + 16,y + detailY,12,'#a4bacb',18)}</g>`;
  }).join('');
  let legendY = graphBottom + 70;
  const legendHeading = textLines(['CONNECTION MAP'],24,legendY,11,'#85a9c2');
  legendY += 34;
  let legendMarkup = '';
  for (let offset = 0; offset < edges.length; offset += 2) {
    let rowHeight = 0;
    edges.slice(offset,offset + 2).forEach((edge,index) => {
      const number = String(offset + index + 1).padStart(2,'0'), x = 24 + index * (width / 2);
      const from = nodes.find(node => node.id === edge.from), to = nodes.find(node => node.id === edge.to);
      const available = width / 2 - 88;
      const nameLines = wrapText(`${from.label} ${edge.bidirectional ? '↔' : '→'} ${to.label}`,available,13);
      const detailLines = wrapText(relationLabel(edge),available,12);
      const detailY = legendY + nameLines.length * 19 + 3;
      rowHeight = Math.max(rowHeight,nameLines.length * 19 + detailLines.length * 18 + 27);
      legendMarkup += `${textLines([number],x,legendY,10,'#85a9c2')}${textLines(nameLines,x + 30,legendY,13,'#d0e2ef',19)}${textLines(detailLines,x + 30,detailY,12,'#8da9bd',18)}`;
    });
    legendY += rowHeight;
  }
  const height = legendY + 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMin meet" role="img" aria-labelledby="title-${project.id}" aria-describedby="desc-${project.id}" style="font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;background:transparent"><title id="title-${project.id}">${escapeXML(project.title)} · ${escapeXML(project.architecture.title || '技术架构')}</title><desc id="desc-${project.id}">${escapeXML([project.architecture.note,describeArchitecture(project.architecture)].filter(Boolean).join('；'))}</desc><style>.architecture-packet{pointer-events:none}svg[data-motion="paused"] .architecture-packet{visibility:hidden}@media(prefers-reduced-motion:reduce){.architecture-packet{display:none}}</style><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#91bcd7"/></marker></defs>${bandMarkup}${lineMarkup}${nodeMarkup}${legendHeading}${legendMarkup}</svg>`;
}

export function relationLabel(edge) {return edge.label || labels[edge.kind];}
export function componentType(node) {return types[node.type] || 'COMPONENT';}
