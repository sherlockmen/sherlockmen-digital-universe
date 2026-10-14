const escapeXML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const labels = {flow:'处理方向',contains:'功能关联',foundation:'参考支撑',integration:'能力连接',feedback:'线索回查'};
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

export function describeArchitecture(architecture) {
  const names = Object.fromEntries(architecture.nodes.map(node => [node.id,node.label]));
  const nodes = architecture.nodes.map(node => [node.label,...(node.items || (node.detail ? [node.detail] : []))].join('：'));
  const edges = architecture.edges.map(edge => `${names[edge.from]} · ${edge.label || labels[edge.kind]} · ${names[edge.to]}`);
  return [...nodes,...edges].join('；');
}

export function renderArchitecture(project) {
  const {nodes,edges} = project.architecture;
  const ranks = Object.fromEntries(nodes.map(node => [node.id,0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    edges.filter(edge => edge.kind !== 'feedback').forEach(edge => {
      const next = Math.min(nodes.length - 1,ranks[edge.from] + 1);
      if (ranks[edge.to] < next) {ranks[edge.to] = next; changed = true;}
    });
    if (!changed) break;
  }
  const positions = {};
  let row = 0;
  const width = 780, boxHeight = 134, gapY = 90, rowHeight = boxHeight + gapY;
  [...new Set(Object.values(ranks))].sort((a,b) => a-b).forEach(rank => {
    const group = nodes.filter(node => ranks[node.id] === rank);
    for (let offset = 0; offset < group.length; offset += 4) {
      const lane = group.slice(offset,offset + 4);
      const gap = 24, boxWidth = Math.min(220,(width - 48 - (lane.length - 1) * gap) / lane.length);
      const start = (width - lane.length * boxWidth - (lane.length - 1) * gap) / 2;
      lane.forEach((node,index) => {positions[node.id] = {x:start + index * (boxWidth + gap),y:24 + row * rowHeight,width:boxWidth};});
      row++;
    }
  });
  const height = (row - 1) * rowHeight + boxHeight + 48;
  const markerId = `arrow-${project.id}`;
  const lineMarkup = edges.map(edge => {
    const from = positions[edge.from], to = positions[edge.to];
    if (edge.kind === 'feedback') {
      const x = from.x + from.width, y1 = from.y + boxHeight * .75, y2 = from.y + boxHeight * .25, bend = x + 84;
      const lines = wrapText(edge.label || labels.feedback,144,12);
      return `<path d="M${x} ${y1} C${bend} ${y1},${bend} ${y2},${x} ${y2}" fill="none" stroke="#bedbf2" stroke-width="1.5" stroke-dasharray="4 6" marker-end="url(#${markerId})"/><text x="${bend + 60}" y="${from.y + boxHeight / 2 - (lines.length - 1) * 9}" fill="#a9bac6" font-size="12" text-anchor="middle">${lines.map((line,index) => `<tspan x="${bend + 60}" dy="${index ? 18 : 0}">${escapeXML(line)}</tspan>`).join('')}</text>`;
    }
    const x1 = from.x + from.width / 2, y1 = from.y + boxHeight, x2 = to.x + to.width / 2, y2 = to.y;
    const middle = (y1 + y2) / 2;
    const flow = edge.kind === 'flow';
    const skipsRow = to.y - from.y > rowHeight;
    const routeX = x1 <= width / 2 ? 12 : width - 12;
    const entryY = y1 + gapY / 2, exitY = y2 - gapY / 2;
    const path = skipsRow
      ? `M${x1} ${y1} V${entryY} H${routeX} V${exitY} H${x2} V${y2}`
      : `M${x1} ${y1} C${x1} ${middle},${x2} ${middle},${x2} ${y2}`;
    const labelX = skipsRow ? (routeX + x2) / 2 : (x1 + x2) / 2;
    const labelY = skipsRow ? exitY - 10 : middle - 10;
    return `<path d="${path}" fill="none" stroke="${flow ? '#bedbf2' : '#657f91'}" stroke-width="1.5" ${flow ? `marker-end="url(#${markerId})"` : 'stroke-dasharray="4 6"'}/><text x="${labelX}" y="${labelY}" fill="#a9bac6" font-size="12" text-anchor="middle" stroke="#0a1015" stroke-width="5" paint-order="stroke">${escapeXML(edge.label || labels[edge.kind])}</text>`;
  }).join('');
  const nodeMarkup = nodes.map(node => {
    const {x,y,width:boxWidth} = positions[node.id];
    const lines = wrapText(node.label,boxWidth - 32,17);
    const core = node.id === project.architecture.focus;
    const details = node.items || (node.detail ? [node.detail] : []);
    const detailLines = details.flatMap(detail => wrapText(detail,boxWidth - 28,12));
    const top = detailLines.length ? 30 : 72 - (lines.length - 1) * 10;
    const detailTop = 36 + lines.length * 23;
    return `<g><rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="4" fill="${core ? '#122332' : '#0c161f'}" stroke="${core ? '#bedbf2' : '#3a5060'}"/><text x="${x + boxWidth / 2}" y="${y + top}" fill="#edf4f8" font-size="17" text-anchor="middle">${lines.map((line,index) => `<tspan x="${x + boxWidth / 2}" dy="${index ? 23 : 0}">${escapeXML(line)}</tspan>`).join('')}</text>${detailLines.length ? `<text x="${x + boxWidth / 2}" y="${y + detailTop}" fill="#99aebd" font-size="12" text-anchor="middle">${detailLines.map((line,index) => `<tspan x="${x + boxWidth / 2}" dy="${index ? 18 : 0}">${escapeXML(line)}</tspan>`).join('')}</text>` : ''}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title-${project.id} desc-${project.id}" style="font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;background:#0a1015"><title id="title-${project.id}">${escapeXML(project.title)} · ${escapeXML(project.architecture.title || '功能关系示意')}</title><desc id="desc-${project.id}">${escapeXML([project.architecture.note,describeArchitecture(project.architecture)].filter(Boolean).join('；'))}</desc><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#bedbf2"/></marker></defs>${lineMarkup}${nodeMarkup}</svg>`;
}

export function relationLabel(edge) {return edge.label || labels[edge.kind];}
