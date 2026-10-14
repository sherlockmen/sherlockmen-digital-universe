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

// A narrow screen gets new geometry, rather than a scaled desktop canvas or
// a second list of duplicated endpoints. Every card and edge is still from
// the original architecture; only their placement and orthogonal routes vary.
export function layoutResponsiveArchitecture(architecture,availableWidth) {
  const width = Math.max(1,Math.floor(Number(availableWidth) || 320));
  const {nodes,edges,layers} = architecture;
  const rows = layers.map(layer => ({layer,nodes:nodes.filter(node => node.layer === layer.id)}));
  const order = rows.flatMap(row => row.nodes);
  const columns = width >= 520 ? 2 : 1;
  const rank = {}, column = {};
  let gridRow = 0;
  rows.forEach(row => {
    row.nodes.forEach((node,index) => {rank[node.id] = gridRow + Math.floor(index / columns); column[node.id] = index % columns;});
    gridRow += Math.ceil(row.nodes.length / columns);
  });
  const layerByNode = Object.fromEntries(order.map(node => [node.id,node.layer]));
  const lanes = {left:[],right:[],center:[]};
  const routes = edges.map((edge,index) => {
    const start = Math.min(rank[edge.from],rank[edge.to]);
    const end = Math.max(rank[edge.from],rank[edge.to]);
    const sameColumn = column[edge.from] === column[edge.to];
    const directAxis = start === end && !sameColumn ? 'horizontal' : end - start === 1 && sameColumn && layerByNode[edge.from] === layerByNode[edge.to] ? 'vertical' : null;
    return {edge,index,start,end,direct:!!directAxis,directAxis};
  });
  // Interval coloring reuses a side lane only after its previous connection
  // has ended. This keeps parallel long dependencies separate without making
  // every short link consume another permanent gutter.
  routes.filter(route => !route.direct).sort((a,b) => a.start - b.start || a.end - b.end || a.index - b.index).forEach(route => {
    const preference = route.edge.kind === 'flow' ? 'right' : 'left';
    const zones = columns === 1 ? ['left','right'] : column[route.edge.from] !== column[route.edge.to] ? ['center'] : [column[route.edge.from] ? 'right' : 'left'];
    const options = zones.map(side => {
      const reuse = lanes[side].findIndex(end => end < route.start);
      const lane = reuse < 0 ? lanes[side].length : reuse;
      const count = Math.max(lanes[side].length,lane + 1);
      return {side,lane,cost:count * 3 + lane + (side === preference ? 0 : .35)};
    });
    options.sort((a,b) => a.cost - b.cost);
    const choice = options[0];
    route.side = choice.side; route.lane = choice.lane;
    lanes[choice.side][choice.lane] = route.end;
  });
  const laneCount = Math.max(lanes.left.length,lanes.right.length,1);
  const gutter = Math.min(Math.max(20,12 + laneCount * 5),Math.floor(width * .14));
  const middle = columns === 2 ? Math.max(28,14 + lanes.center.length * 5) : 0;
  const cardX = gutter, cardWidth = Math.max(1,(width - gutter * 2 - middle) / columns);
  const positions = {};
  let cursor = 10;
  rows.forEach((row,index) => {
    row.headerY = cursor + 12;
    row.titleLines = wrapText(`${String(index + 1).padStart(2,'0')}  ${row.layer.label}`,width - gutter * 2,12);
    row.captionLines = wrapText(row.layer.caption || '',width - gutter * 2,9);
    const headerHeight = row.titleLines.length * 18 + (row.captionLines.length ? row.captionLines.length * 13 + 5 : 0) + 16;
    cursor += headerHeight;
    row.y = cursor - 8;
    for (let offset = 0; offset < row.nodes.length; offset += columns) {
      const line = row.nodes.slice(offset,offset + columns);
      let rowHeight = 0;
      line.forEach(node => {
        const titleLines = wrapText(node.label,cardWidth - 28,15);
        const detailLines = (node.items || []).flatMap(detail => wrapText(detail,cardWidth - 28,12));
        const detailY = 40 + (titleLines.length - 1) * 20 + 22;
        const height = Math.ceil((detailY + Math.max(0,detailLines.length - 1) * 17 + 17) / 2) * 2;
        positions[node.id] = {x:cardX + column[node.id] * (cardWidth + middle),y:cursor,width:cardWidth,height,titleLines,detailLines,detailY};
        rowHeight = Math.max(rowHeight,height);
      });
      line.forEach(node => {positions[node.id].height = rowHeight;});
      cursor += rowHeight + 24;
    }
    row.height = cursor - row.y - 16;
    cursor += 24;
  });
  const sidePorts = new Map(), directPorts = new Map();
  routes.forEach(route => {
    for (const end of ['from','to']) {
      const id = route.edge[end], peer = route.edge[end === 'from' ? 'to' : 'from'];
      const downward = rank[route.edge.from] < rank[route.edge.to];
      const horizontalForward = column[route.edge.from] < column[route.edge.to];
      const face = route.directAxis === 'vertical' ? end === 'from' ? downward ? 'bottom' : 'top' : downward ? 'top' : 'bottom' : route.directAxis === 'horizontal' ? end === 'from' ? horizontalForward ? 'right' : 'left' : horizontalForward ? 'left' : 'right' : route.side === 'center' ? column[id] ? 'left' : 'right' : route.side;
      route[`${end}Face`] = face;
      const collection = ['left','right'].includes(face) ? sidePorts : directPorts;
      const key = `${id}:${face}`;
      if (!collection.has(key)) collection.set(key,[]);
      collection.get(key).push({route,end,peer});
    }
  });
  for (const entries of sidePorts.values()) {
    entries.sort((a,b) => rank[a.peer] - rank[b.peer] || a.route.index - b.route.index);
    entries.forEach((entry,index) => {
      const node = positions[entry.route.edge[entry.end]];
      const step = Math.min(12,(node.height - 40) / Math.max(1,entries.length - 1));
      entry.route[`${entry.end}Offset`] = node.height / 2 + (index - (entries.length - 1) / 2) * step;
    });
  }
  for (const entries of directPorts.values()) {
    entries.sort((a,b) => a.route.index - b.route.index);
    entries.forEach((entry,index) => {
      const node = positions[entry.route.edge[entry.end]];
      entry.route[`${entry.end}Offset`] = node.width / 2 + (index - (entries.length - 1) / 2) * 12;
    });
  }
  const endpoint = (route,end) => {
    const node = positions[route.edge[end]], face = route[`${end}Face`], offset = route[`${end}Offset`];
    return [face === 'left' ? node.x : face === 'right' ? node.x + node.width : node.x + offset,face === 'top' ? node.y : face === 'bottom' ? node.y + node.height : node.y + offset];
  };
  routes.forEach(route => {
    const from = endpoint(route,'from'), to = endpoint(route,'to');
    let points;
    if (route.directAxis === 'vertical') {
      const y = (from[1] + to[1]) / 2;
      points = [from,[from[0],y],[to[0],y],to];
    } else if (route.directAxis === 'horizontal') {
      const x = (from[0] + to[0]) / 2;
      points = [from,[x,from[1]],[x,to[1]],to];
    } else {
      const count = lanes[route.side].length;
      const spacing = (route.side === 'center' ? middle - 14 : gutter - 9) / Math.max(1,count);
      const x = route.side === 'left' ? gutter - 7 - route.lane * spacing : route.side === 'right' ? width - gutter + 7 + route.lane * spacing : gutter + cardWidth + 7 + route.lane * spacing;
      points = [from,[x,from[1]],[x,to[1]],to];
    }
    route.path = compactPath(points);
    route.fromPoint = from; route.toPoint = to;
  });
  return {positions,rows,routes,width,graphBottom:cursor - 24,height:cursor + 12,gutter,columns};
}

export function renderResponsiveArchitecture(project,availableWidth) {
  const architecture = project.architecture;
  const {positions,rows,routes,width,height,gutter} = layoutResponsiveArchitecture(architecture,availableWidth);
  const suffix = `${project.id}-responsive`, markerId = `arrow-${suffix}`;
  const bands = rows.map(row => `<g data-layer="${escapeXML(row.layer.id)}">${textLines(row.titleLines,gutter,row.headerY,12,'#c5dfef',18)}${textLines(row.captionLines,gutter,row.headerY + row.titleLines.length * 18 + 1,9,'#6f92aa',13)}<rect x="${gutter - 6}" y="${row.y}" width="${width - (gutter - 6) * 2}" height="${row.height}" rx="9" fill="#0d1720" fill-opacity=".52" stroke="#243946" stroke-opacity=".6"/></g>`).join('');
  const links = [...routes].sort((a,b) => Number(a.edge.kind === 'flow') - Number(b.edge.kind === 'flow')).map(route => {
    const {edge,index,path} = route;
    const primary = edge.kind === 'flow', focusRelated = edge.from === architecture.focus || edge.to === architecture.focus;
    const color = primary ? '#b8dbf2' : focusRelated ? '#91afc4' : '#6d91ac';
    const title = `${architecture.nodes.find(node => node.id === edge.from).label} ${edge.bidirectional ? '↔' : '→'} ${architecture.nodes.find(node => node.id === edge.to).label}：${relationLabel(edge)}`;
    return `<g class="architecture-edge responsive-edge" data-edge="${String(index + 1).padStart(2,'0')}" data-kind="${escapeXML(edge.kind)}" data-from="${escapeXML(edge.from)}" data-to="${escapeXML(edge.to)}" data-focus-related="${focusRelated}" data-prominence="${primary ? 'primary' : 'secondary'}"><title>${escapeXML(title)}</title><path d="${path}" fill="none" stroke="#08121b" stroke-width="3"/><path class="architecture-route" d="${path}" fill="none" stroke="${color}" stroke-opacity="${primary ? '.95' : focusRelated ? '.65' : '.38'}" stroke-width="${primary ? '1.5' : '1'}" stroke-linejoin="round" ${primary ? '' : 'stroke-dasharray="3 5"'} ${edge.bidirectional ? `marker-start="url(#${markerId})"` : ''} marker-end="url(#${markerId})"/>${renderPackets(path,edge,index)}</g>`;
  }).join('');
  const cards = architecture.nodes.map(node => {
    const {x,y,width:cardWidth,height:cardHeight,titleLines,detailLines,detailY} = positions[node.id];
    const focus = node.id === architecture.focus;
    return `<g class="architecture-node responsive-node" data-node="${escapeXML(node.id)}" data-core="${focus}"><rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="7" fill="${focus ? '#173244' : '#111f2b'}" stroke="${focus ? '#a6d0eb' : '#426278'}" stroke-width="${focus ? '1.4' : '1'}"/>${textLines([types[node.type] || 'COMPONENT'],x + 14,y + 18,9,'#85a9c2')}${textLines(titleLines,x + 14,y + 40,15,'#edf4f8',20)}${textLines(detailLines,x + 14,y + detailY,12,'#a4bacb',17)}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="architecture-responsive-svg" data-responsive="true" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMin meet" role="img" aria-labelledby="title-${suffix}" aria-describedby="desc-${suffix}" style="font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;background:transparent"><title id="title-${suffix}">${escapeXML(project.title)} · ${escapeXML(architecture.title || '技术架构')}</title><desc id="desc-${suffix}">${escapeXML([architecture.note,describeArchitecture(architecture)].filter(Boolean).join('；'))}</desc><style>.architecture-packet{pointer-events:none}svg[data-motion="paused"] .architecture-packet{visibility:hidden}@media(prefers-reduced-motion:reduce){.architecture-packet{display:none}}</style><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#91bcd7"/></marker></defs>${bands}${links}${cards}</svg>`;
}

// Phone overview: inspect one real component and its immediate topology.
// Details stay in the surrounding inspector, so this canvas remains a graph.
export function layoutFocusedArchitecture(architecture,availableWidth,selectedId = architecture.focus) {
  const width = Math.max(1,Math.floor(Number(availableWidth) || 320));
  const {nodes,edges,layers} = architecture;
  const selected = nodes.find(node => node.id === selectedId) || nodes.find(node => node.id === architecture.focus) || nodes[0];
  if (!selected) return {positions:{},routes:[],width,height:0,visibleNodes:[],visibleEdges:[],bands:[],selectedId:null};
  const visibleIds = new Set([selected.id]);
  edges.forEach(edge => {
    if (edge.from === selected.id) visibleIds.add(edge.to);
    if (edge.to === selected.id) visibleIds.add(edge.from);
  });
  const visibleNodes = nodes.filter(node => visibleIds.has(node.id));
  const visibleEdges = edges.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to));
  const layerRank = Object.fromEntries(layers.map((layer,index) => [layer.id,index]));
  const nodeRank = Object.fromEntries(nodes.map((node,index) => [node.id,index]));
  const isUpstream = node => {
    if (layerRank[node.layer] !== layerRank[selected.layer]) return layerRank[node.layer] < layerRank[selected.layer];
    const incoming = visibleEdges.some(edge => edge.from === node.id && edge.to === selected.id && !edge.bidirectional);
    const outgoing = visibleEdges.some(edge => edge.from === selected.id && edge.to === node.id || edge.bidirectional && (edge.from === node.id && edge.to === selected.id));
    return incoming && !outgoing;
  };
  const peers = visibleNodes.filter(node => node.id !== selected.id).sort((a,b) => layerRank[a.layer] - layerRank[b.layer] || nodeRank[a.id] - nodeRank[b.id]);
  const bands = [
    {id:'upstream',label:'UPSTREAM',nodes:peers.filter(isUpstream)},
    {id:'focus',label:'FOCUS',nodes:[selected]},
    {id:'downstream',label:'DOWNSTREAM / SUPPORT',nodes:peers.filter(node => !isUpstream(node))}
  ].filter(band => band.nodes.length);
  const gutter = Math.min(14,width * .06), middle = Math.min(34,width * .13);
  const cardWidth = Math.max(1,(width - gutter * 2 - middle) / 2);
  const coreWidth = Math.min(width - gutter * 2,Math.max(156,Math.min(224,width * .6)));
  const positions = {}, rows = [];
  const makeCard = (node,core,row,column,centered) => {
    const boxWidth = core ? coreWidth : centered ? Math.min(coreWidth,Math.max(cardWidth,width * .46)) : cardWidth;
    let titleSize = core ? 14 : 13;
    let titleLines = wrapText(node.label,boxWidth - 16,titleSize);
    if (titleLines.length > 3) {titleSize = 12; titleLines = wrapText(node.label,boxWidth - 16,titleSize);}
    // Existing component names fit in three lines at phone widths. Preserve
    // the whole name if a future graph has a longer label, rather than crop it.
    const titleStep = core ? 18 : 16;
    const height = Math.max(core ? 60 : 52,28 + titleLines.length * titleStep);
    positions[node.id] = {x:core || centered ? (width - boxWidth) / 2 : gutter + column * (cardWidth + middle),y:0,width:boxWidth,height,titleLines,titleSize,titleStep,row,column,centered,core,selected:core,layer:node.layer};
  };
  bands.forEach(band => {
    for (let index = 0; index < band.nodes.length; index += band.id === 'focus' ? 1 : 2) {
      const line = band.nodes.slice(index,index + (band.id === 'focus' ? 1 : 2));
      const row = {band,nodes:line,first:index === 0,index:rows.length};
      line.forEach((node,column) => makeCard(node,band.id === 'focus',row.index,column,band.nodes.length === 1));
      row.height = Math.max(...line.map(node => positions[node.id].height));
      line.forEach(node => {positions[node.id].height = row.height;});
      rows.push(row);
    }
  });
  const coreRow = positions[selected.id].row;
  const lanes = {center:[],left:[],right:[]}, gapTracks = Array.from({length:rows.length + 1},() => []);
  const routes = edges.flatMap((edge,index) => {
    if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) return [];
    const from = positions[edge.from], to = positions[edge.to];
    const core = edge.from === selected.id || edge.to === selected.id;
    const start = Math.min(from.row,to.row), end = Math.max(from.row,to.row);
    const crossesCore = !core && start < coreRow && end > coreRow;
    return [{edge,index,core,start,end,direct:!core && from.row === to.row,crossesCore}];
  });
  const assignLane = (route,side) => {
    const reuse = lanes[side].findIndex(end => end < route.start);
    route.side = side; route.lane = reuse < 0 ? lanes[side].length : reuse;
    lanes[side][route.lane] = route.end;
  };
  routes.filter(route => !route.direct).sort((a,b) => a.start - b.start || a.end - b.end || a.index - b.index).forEach(route => {
    if (!route.crossesCore) {assignLane(route,'center'); return;}
    const from = positions[route.edge.from], to = positions[route.edge.to];
    const cost = side => {
      const reuse = lanes[side].findIndex(end => end < route.start);
      const lane = reuse < 0 ? lanes[side].length : reuse;
      const distance = Number(from.column !== (side === 'left' ? 0 : 1)) + Number(to.column !== (side === 'left' ? 0 : 1));
      return lane * 2 + distance;
    };
    assignLane(route,cost('left') <= cost('right') ? 'left' : 'right');
    const forward = from.row < to.row;
    route.exit = {gap:forward ? from.row + 1 : from.row,index:0};
    route.entry = {gap:forward ? to.row : to.row + 1,index:0};
    for (const name of ['exit','entry']) {
      const track = route[name]; track.index = gapTracks[track.gap].length;
      gapTracks[track.gap].push(track);
    }
  });
  let cursor = 8;
  const gapStarts = [0];
  rows.forEach(row => {
    if (row.first) {row.band.headerY = cursor + 10; cursor += 22; row.band.y = cursor - 6;}
    row.y = cursor;
    row.nodes.forEach(node => {positions[node.id].y = cursor;});
    cursor += row.height;
    gapStarts[row.index + 1] = cursor;
    const coreConnections = row.index === coreRow - 1 || row.index === coreRow ? routes.filter(route => route.core && (row.index < coreRow ? route.start < coreRow : route.end > coreRow)).length : 0;
    cursor += Math.max(16,10 + gapTracks[row.index + 1].length * 4,coreConnections * 4 + 10 - 22);
    row.band.height = cursor - row.band.y - 8;
  });
  const ports = new Map();
  routes.forEach(route => {
    for (const end of ['from','to']) {
      const id = route.edge[end], peerId = route.edge[end === 'from' ? 'to' : 'from'];
      const node = positions[id], peer = positions[peerId];
      const face = route.core ? id === selected.id ? peer.row < coreRow ? 'top' : 'bottom' : node.centered ? node.row < coreRow ? 'bottom' : 'top' : node.column ? 'left' : 'right' : route.crossesCore ? peer.row > node.row ? 'bottom' : 'top' : node.column ? 'left' : 'right';
      route[`${end}Face`] = face;
      const key = `${id}:${face}`;
      if (!ports.has(key)) ports.set(key,[]);
      ports.get(key).push({route,end,peer});
    }
  });
  for (const [key,entries] of ports) {
    const face = key.split(':').at(-1), side = face === 'left' || face === 'right';
    entries.sort((a,b) => side ? a.peer.row - b.peer.row || a.route.index - b.route.index : a.peer.column - b.peer.column || a.peer.row - b.peer.row || a.route.index - b.route.index);
    entries.forEach((entry,index) => {
      const node = positions[entry.route.edge[entry.end]];
      const extent = side ? node.height : node.width;
      const step = Math.min(side ? 8 : 12,(extent - 24) / Math.max(1,entries.length - 1));
      entry.route[`${entry.end}Offset`] = extent / 2 + (index - (entries.length - 1) / 2) * step;
      if (entry.route.core && entry.route.edge[entry.end] === selected.id) entry.route.branch = index;
    });
  }
  const endpoint = (route,end) => {
    const node = positions[route.edge[end]], face = route[`${end}Face`], offset = route[`${end}Offset`];
    return [face === 'left' ? node.x : face === 'right' ? node.x + node.width : node.x + offset,face === 'top' ? node.y : face === 'bottom' ? node.y + node.height : node.y + offset];
  };
  routes.forEach(route => {
    const from = endpoint(route,'from'), to = endpoint(route,'to');
    const centerX = gutter + cardWidth + 5 + (route.lane ?? 0) * (middle - 10) / Math.max(1,lanes.center.length - 1);
    let points;
    if (route.direct) {
      const x = (from[0] + to[0]) / 2;
      points = [from,[x,from[1]],[x,to[1]],to];
    } else if (route.core) {
      const selectedIsFrom = route.edge.from === selected.id;
      const corePoint = selectedIsFrom ? from : to, peerPoint = selectedIsFrom ? to : from;
      const peer = positions[route.edge[selectedIsFrom ? 'to' : 'from']];
      const trackY = corePoint[1] + (peer.row < coreRow ? -1 : 1) * (8 + route.branch * 4);
      points = peer.centered ? [corePoint,[corePoint[0],trackY],[peerPoint[0],trackY],peerPoint] : [corePoint,[corePoint[0],trackY],[centerX,trackY],[centerX,peerPoint[1]],peerPoint];
      if (!selectedIsFrom) points.reverse();
    } else if (route.crossesCore) {
      const x = route.side === 'left' ? gutter - 5 - route.lane * (gutter - 8) / Math.max(1,lanes.left.length - 1) : width - gutter + 5 + route.lane * (gutter - 8) / Math.max(1,lanes.right.length - 1);
      const exitY = gapStarts[route.exit.gap] + 5 + route.exit.index * 4;
      const entryY = gapStarts[route.entry.gap] + 5 + route.entry.index * 4;
      points = [from,[from[0],exitY],[x,exitY],[x,entryY],[to[0],entryY],to];
    } else points = [from,[centerX,from[1]],[centerX,to[1]],to];
    route.path = compactPath(points); route.fromPoint = from; route.toPoint = to;
  });
  return {positions,routes,width,height:cursor + 4,visibleNodes,visibleEdges,bands,selectedId:selected.id};
}

export function renderFocusedArchitecture(project,availableWidth,selectedId = project.architecture.focus) {
  const architecture = project.architecture;
  const layout = layoutFocusedArchitecture(architecture,availableWidth,selectedId);
  const {positions,routes,width,height,visibleNodes,visibleEdges,bands} = layout;
  const suffix = `${project.id}-focused`, markerId = `arrow-${suffix}`, coreId = layout.selectedId;
  const bandMarkup = bands.map(band => `<g data-band="${band.id}"><rect x="7" y="${band.y}" width="${width - 14}" height="${band.height}" rx="10" fill="#10202b" fill-opacity="${band.id === 'focus' ? '.3' : '.1'}"/>${textLines([band.label],14,band.headerY,8,'#7c9bab')}</g>`).join('');
  const links = [...routes].sort((a,b) => Number(a.core) - Number(b.core) || Number(a.edge.kind === 'flow') - Number(b.edge.kind === 'flow')).map(route => {
    const {edge,index,path,core} = route, primary = edge.kind === 'flow';
    return `<g class="architecture-edge focused-edge" data-edge="${String(index + 1).padStart(2,'0')}" data-kind="${escapeXML(edge.kind)}" data-from="${escapeXML(edge.from)}" data-to="${escapeXML(edge.to)}" data-focus-related="${core}"><title>${escapeXML(relationLabel(edge))}</title><path d="${path}" fill="none" stroke="#08121b" stroke-width="4"/><path class="architecture-route" d="${path}" fill="none" stroke="${primary ? '#bfeaff' : core ? '#bfa783' : '#7d94a5'}" stroke-opacity="${core ? primary ? '.95' : '.7' : '.35'}" stroke-width="${core && primary ? '1.6' : '1.1'}" stroke-linejoin="round" ${primary ? '' : 'stroke-dasharray="3 4"'} ${edge.bidirectional ? `marker-start="url(#${markerId})"` : ''} marker-end="url(#${markerId})"/>${renderPackets(path,edge,index)}</g>`;
  }).join('');
  const cards = visibleNodes.map(node => {
    const position = positions[node.id], {x,y,width:boxWidth,height:boxHeight,titleLines,titleSize,titleStep} = position;
    const selected = node.id === coreId, core = node.id === architecture.focus;
    const centerX = x + boxWidth / 2;
    return `<g class="architecture-node focused-node" data-node="${escapeXML(node.id)}" data-core="${core}" data-selected="${selected}">${selected ? `<rect x="${x - 3}" y="${y - 3}" width="${boxWidth + 6}" height="${boxHeight + 6}" rx="11" fill="#a4dfff" opacity=".1"/>` : ''}<rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="8" fill="${selected ? '#163548' : '#101e2a'}" stroke="${selected ? '#a9e0f7' : '#456376'}" stroke-width="${selected ? '1.6' : '1'}"/>${textLines([`${selected ? '● ' : ''}${types[node.type] || 'COMPONENT'}`],centerX,y + 14,8,selected ? '#addff3' : '#829dac',11,'middle')}${textLines(titleLines,centerX,y + 32,titleSize,selected ? '#f0faff' : '#e0edf4',titleStep,'middle')}</g>`;
  }).join('');
  const partial = {...architecture,nodes:visibleNodes,edges:visibleEdges};
  return `<svg xmlns="http://www.w3.org/2000/svg" class="architecture-focused-svg" data-focused="true" data-selected="${escapeXML(coreId)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMin meet" role="img" aria-labelledby="title-${suffix}" aria-describedby="desc-${suffix}" style="font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;background:transparent"><title id="title-${suffix}">${escapeXML(project.title)} · ${escapeXML(visibleNodes.find(node => node.id === coreId)?.label)} · 技术连接</title><desc id="desc-${suffix}">${escapeXML(describeArchitecture(partial))}</desc><style>.architecture-packet{pointer-events:none}@media(prefers-reduced-motion:reduce){.architecture-packet{display:none}}</style><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#9cbecf"/></marker></defs>${bandMarkup}${links}${cards}</svg>`;
}

export function relationLabel(edge) {return edge.label || labels[edge.kind];}
export function componentType(node) {return types[node.type] || 'COMPONENT';}
