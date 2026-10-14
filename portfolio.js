import {renderArchitecture,relationLabel,componentType} from './portfolio-diagrams.mjs?v=showcase-8';

(async () => {
  'use strict';
  const data = await fetch(new URL('./portfolio-data.json?v=showcase-8',import.meta.url)).then(response => {
    if (!response.ok) throw new Error('项目资料读取失败');
    return response.json();
  });
  const $ = selector => document.querySelector(selector);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const projects = data.groups.flatMap(group => group.projects.map(project => ({...project, group:group.title, groupIndex:group.index})));
  const panel = $('#portfolio-panel');
  const dialog = $('#portfolio-dialog');
  let selected = 0;
  let groupTrigger;
  let projectTrigger;
  const create = (tag,className,text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const diagram = dialog.querySelector('.portfolio-diagram');
  const architectureCanvas = $('#portfolio-architecture');
  const motionControls = create('div','diagram-motion-controls');
  const motionCopy = create('span','diagram-motion-copy','光点演示调用与数据流向 · 非实时数据');
  const motionToggle = create('button','diagram-motion-toggle');
  motionToggle.type = 'button';
  motionToggle.setAttribute('aria-label','数据流动动画');
  motionToggle.setAttribute('aria-controls','portfolio-architecture portfolio-relations');
  const motionStatus = create('span','diagram-motion-status');
  const motionActions = create('div','diagram-motion-actions');
  motionActions.append(motionStatus,motionToggle);
  motionControls.append(motionCopy,motionActions);
  diagram.querySelector('.diagram-heading').after(motionControls);
  let userPaused = false;
  let pageSuspended = false;
  let diagramInView = false;
  let svgInView = false;
  let activeSVG = null;
  let svgRunning = null;
  let motionItems = [];
  const visibleItems = new Set();
  function syncMotion() {
    const running = dialog.open && diagramInView && !document.hidden && !pageSuspended && !reduced.matches && !userPaused;
    diagram.dataset.motion = running ? 'running' : 'paused';
    const runSVG = running && svgInView;
    if (activeSVG && svgRunning !== runSVG) {
      activeSVG.dataset.motion = runSVG ? 'running' : 'paused';
      if (runSVG) activeSVG.unpauseAnimations?.();
      else activeSVG.pauseAnimations?.();
      svgRunning = runSVG;
    }
    motionItems.forEach(item => {item.dataset.motion = running && visibleItems.has(item) ? 'running' : 'paused';});
    motionToggle.disabled = reduced.matches;
    motionToggle.setAttribute('aria-pressed',String(!userPaused && !reduced.matches));
    motionToggle.textContent = reduced.matches ? '静态展示' : userPaused ? '▶ 播放流动' : 'Ⅱ 暂停流动';
    motionStatus.textContent = reduced.matches ? '已减少动态效果' : userPaused ? '已暂停' : running ? '流动示意中' : '进入图示后自动播放';
  }
  const motionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (entry.target === diagram) diagramInView = visible;
      else if (entry.target === architectureCanvas) svgInView = visible;
      else if (motionItems.includes(entry.target)) {
        if (visible) visibleItems.add(entry.target);
        else visibleItems.delete(entry.target);
      }
    });
    syncMotion();
  },{root:dialog,threshold:.01});
  function bindMotion() {
    motionObserver.disconnect();
    visibleItems.clear();
    diagramInView = false;
    svgInView = false;
    activeSVG = architectureCanvas.querySelector('svg');
    svgRunning = null;
    motionItems = [...diagram.querySelectorAll('.architecture-component,.architecture-relation')];
    syncMotion();
    motionObserver.observe(diagram);
    motionObserver.observe(architectureCanvas);
    motionItems.forEach(item => motionObserver.observe(item));
  }
  motionToggle.addEventListener('click',() => {userPaused = !userPaused; syncMotion();});
  reduced.addEventListener('change',syncMotion);
  document.addEventListener('visibilitychange',syncMotion);
  window.addEventListener('pagehide',() => {pageSuspended = true; syncMotion();});
  window.addEventListener('pageshow',() => {pageSuspended = false; syncMotion();});
  syncMotion();
  function closeGroup(returnFocus = true) {
    panel.hidden = true;
    document.querySelectorAll('[data-portfolio-folder]').forEach(button => button.setAttribute('aria-expanded','false'));
    if (returnFocus) groupTrigger?.focus({preventScroll:true});
  }
  function showProject(index) {
    selected = (index + projects.length) % projects.length;
    const project = projects[selected];
    $('#portfolio-title').textContent = project.title;
    $('#portfolio-description').textContent = project.summary;
    $('#portfolio-eyebrow').textContent = `PROJECT / ${String(selected + 1).padStart(2,'0')}`;
    $('#portfolio-group').textContent = project.group;
    $('#portfolio-role').textContent = project.role;
    $('#portfolio-counter').textContent = `${String(selected + 1).padStart(2,'0')} / ${String(projects.length).padStart(2,'0')}`;
    $('#portfolio-tags').replaceChildren(...project.tags.map(tag => create('span','',tag)));
    const details = project.sections.map(section => {
      const item = create('div','portfolio-detail');
      item.append(create('h3','',section.label),create('p','',section.text));
      return item;
    });
    (project.links || []).forEach(link => {
      const anchor = create('a','',`${link.label} ↗`);
      anchor.href = link.url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      details.at(-1)?.append(anchor);
    });
    $('#portfolio-details').replaceChildren(...details);
    $('#portfolio-diagram-title').textContent = project.architecture.title || '技术架构';
    const diagramNote = $('#portfolio-diagram-note');
    diagramNote.textContent = project.architecture.note || '';
    diagramNote.hidden = !project.architecture.note;
    activeSVG?.pauseAnimations?.();
    architectureCanvas.innerHTML = renderArchitecture(project);
    const nodes = new Map(project.architecture.nodes.map(node => [node.id,node]));
    const layerCards = project.architecture.layers.map((layer,index) => {
      const section = create('section','architecture-layer');
      section.append(create('h4','',`${String(index + 1).padStart(2,'0')} / ${layer.label}`),create('span','layer-caption',layer.caption));
      const list = create('ul','architecture-components');
      list.append(...project.architecture.nodes.filter(node => node.layer === layer.id).map(node => {
        const card = create('li',`architecture-component${node.id === project.architecture.focus ? ' component-focus' : ''}`);
        card.style.setProperty('--motion-delay',`-${(project.architecture.nodes.indexOf(node) * .27).toFixed(2)}s`);
        card.append(create('span','component-type',[componentType(node),node.state].filter(Boolean).join(' / ')),create('strong','',node.label),create('span','component-detail',node.items.join(' · ')));
        return card;
      }));
      section.append(list); return section;
    });
    const connections = create('section','architecture-connections');
    connections.append(create('h4','','接口与数据流'));
    const connectionList = create('ol','architecture-connection-list');
    connectionList.append(...project.architecture.edges.map((edge,index) => {
      const item = create('li',`architecture-relation relation-${edge.kind}${edge.bidirectional ? ' relation-bidirectional' : ''}`);
      item.style.setProperty('--motion-delay',`-${(index * .43).toFixed(2)}s`);
      item.style.setProperty('--motion-duration',`${edge.kind === 'flow' ? 3.2 : 4.1}s`);
      const track = create('span','relation-motion-track');
      track.setAttribute('aria-hidden','true');
      track.append(create('span','relation-motion-packet packet-forward'));
      if (edge.bidirectional) track.append(create('span','relation-motion-packet packet-reverse'));
      item.append(track);
      item.append(create('span','relation-source',`${String(index + 1).padStart(2,'0')} / ${nodes.get(edge.from).label}`),create('span','relation-connector',`${edge.bidirectional ? '↔' : '↓'} ${relationLabel(edge)}`),create('span','relation-target',nodes.get(edge.to).label));
      return item;
    }));
    connections.append(connectionList);
    $('#portfolio-relations').replaceChildren(...layerCards,connections);
    $('#portfolio-diagram-download').href = new URL(`./architectures/${project.id}.svg?v=showcase-8`,import.meta.url).href;
    $('#portfolio-diagram-download').download = `${project.title}技术架构图.svg`;
    dialog.scrollTop = 0;
    bindMotion();
    if (dialog.open) $('#portfolio-title').focus({preventScroll:true});
  }
  document.querySelectorAll('[data-portfolio-folder]').forEach(button => {
    button.disabled = false;
    button.addEventListener('click', event => {
    if (button.getAttribute('aria-expanded') === 'true') {closeGroup(false); return;}
    groupTrigger = button;
    const group = data.groups.find(item => item.id === button.dataset.portfolioFolder);
    $('#portfolio-panel-label').textContent = `COLLECTION / ${group.index}`;
    $('#portfolio-panel-title').textContent = group.title;
    document.querySelectorAll('[data-portfolio-folder]').forEach(item => item.setAttribute('aria-expanded',String(item === button)));
    $('#portfolio-list').replaceChildren(...group.projects.map(project => {
      const item = document.createElement('button'); item.type = 'button'; item.className = 'portfolio-item';
      item.dataset.portfolioProject = project.id; item.setAttribute('aria-label',`查看${project.title}项目详情`);
      const number = document.createElement('span'); number.className = 'project-number mono'; number.textContent = String(projects.findIndex(p => p.id === project.id) + 1).padStart(2,'0');
      const copy = document.createElement('span'); copy.className = 'project-summary';
      const title = document.createElement('strong'); title.textContent = project.title;
      const summary = document.createElement('span'); summary.textContent = project.summary;
      copy.append(title,summary);
      const arrow = document.createElement('span'); arrow.className = 'project-open'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true');
      item.append(number,copy,arrow); return item;
    }));
    panel.hidden = false;
    panel.scrollIntoView({behavior:reduced.matches || event.detail === 0 ? 'instant' : 'smooth',block:'nearest'});
    $('#portfolio-panel-title').focus({preventScroll:true});
    });
  });
  $('#portfolio-close-group').addEventListener('click',() => closeGroup());
  document.addEventListener('click',event => {
    const trigger = event.target.closest('[data-portfolio-project]'); if (!trigger) return;
    const index = projects.findIndex(project => project.id === trigger.dataset.portfolioProject); if (index < 0) return;
    projectTrigger = trigger; showProject(index); dialog.showModal(); document.body.style.overflow = 'hidden';
    syncMotion();
    $('#portfolio-close').focus();
  });
  $('#portfolio-close').addEventListener('click',() => dialog.close());
  dialog.addEventListener('close',() => {syncMotion(); document.body.style.overflow = ''; projectTrigger?.focus({preventScroll:true});});
  $('#portfolio-previous').addEventListener('click',() => showProject(selected - 1));
  $('#portfolio-next').addEventListener('click',() => showProject(selected + 1));
  document.addEventListener('keydown',event => {
    if (!event.defaultPrevented && event.key === 'Escape' && !dialog.open && !panel.hidden && !$('#project-dialog').open) closeGroup();
  });
})().catch(error => {
  const note = document.querySelector('#portfolio-load-status');
  note.hidden = false; note.textContent = '项目资料加载失败，请刷新后重试。';
  console.error(error);
});
