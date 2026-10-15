import {renderArchitecture,renderResponsiveArchitecture,renderFocusedArchitecture,layoutFocusedArchitecture,componentType} from './portfolio-diagrams.mjs?v=technical-21';
import {createDialogStarfield} from './dialog-background.js?v=technical-21';

(async () => {
  'use strict';
  const data = await fetch(new URL('./portfolio-data.json?v=technical-22',import.meta.url)).then(response => {
    if (!response.ok) throw new Error('项目资料读取失败');
    return response.json();
  });
  const $ = selector => document.querySelector(selector);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const projects = data.groups.flatMap(group => group.projects.map(project => ({...project, group:group.title, groupIndex:group.index})));
  const panel = $('#portfolio-panel');
  const dialog = $('#portfolio-dialog');
  const starfield = createDialogStarfield(dialog,reduced);
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
  const intro = dialog.querySelector('.case-intro');
  const detailsContainer = $('#portfolio-details');
  const overview = create('section','portfolio-overview');
  overview.setAttribute('aria-label','项目概述与实现');
  intro.before(overview);
  overview.append(intro);
  const background = create('section','portfolio-background');
  background.setAttribute('aria-label','项目背景');
  overview.append(background);
  const implementation = create('section','portfolio-implementation');
  implementation.setAttribute('aria-label','技术组件与实现要点');
  overview.append(implementation);
  const modelEngineering = create('section','portfolio-diagram portfolio-model-engineering');
  modelEngineering.hidden = true;
  modelEngineering.setAttribute('aria-label','模型工程与运行架构');
  diagram.after(modelEngineering);
  let pageSuspended = false;
  const activeSVGs = new Map();
  const narrowArchitecture = matchMedia('(max-width: 999px)');
  const architectureSources = new WeakMap();
  function renderPhoneCanvas(canvas,source,width) {
    const {project} = source, architecture = project.architecture;
    const layout = layoutFocusedArchitecture(architecture,width,source.anchorId);
    const inspected = architecture.nodes.find(node => node.id === source.inspectedId);
    const toolbar = create('div','architecture-focus-toolbar');
    toolbar.append(create('span','mono',`FOCUS MAP · ${layout.visibleNodes.length} / ${architecture.nodes.length}`));
    const home = create('button','architecture-core-link','回到核心');
    home.type = 'button'; home.dataset.architectureCore = '';
    home.hidden = source.anchorId === architecture.focus;
    toolbar.append(home);
    const stage = create('div','architecture-focus-stage');
    stage.innerHTML = renderFocusedArchitecture(project,width,source.anchorId);
    const targets = create('div','architecture-node-targets');
    layout.visibleNodes.forEach(node => {
      const box = layout.positions[node.id];
      const target = create('button','architecture-node-target');
      target.type = 'button'; target.dataset.architectureInspect = node.id;
      target.setAttribute('aria-label',`查看 ${node.label} 技术细节`);
      target.setAttribute('aria-pressed',String(node.id === source.inspectedId));
      target.style.cssText = `left:${box.x / width * 100}%;top:${box.y / layout.height * 100}%;width:${box.width / width * 100}%;height:${box.height / layout.height * 100}%`;
      targets.append(target);
    });
    stage.append(targets);
    const inspector = create('section','architecture-inspector');
    inspector.setAttribute('aria-label','选中组件的技术细节');
    inspector.setAttribute('aria-live','polite');
    const caption = create('div','architecture-inspector-heading');
    caption.append(create('span','mono',componentType(inspected)),create('h4','',inspected.label));
    const items = create('ul','architecture-inspector-items');
    items.append(...(inspected.items || []).map(item => create('li','',item)));
    inspector.append(caption,items);
    const navigation = create('nav','architecture-component-nav');
    navigation.setAttribute('aria-label','按技术层浏览全部架构组件');
    navigation.append(create('p','architecture-nav-caption',`浏览全部 ${architecture.nodes.length} 个组件`));
    const layers = create('div','architecture-layer-tabs');
    architecture.layers.forEach((layer,index) => {
      const button = create('button','architecture-layer-tab');
      button.type = 'button'; button.dataset.architectureLayer = layer.id;
      button.setAttribute('aria-pressed',String(source.layerId === layer.id));
      button.append(create('span','mono',String(index + 1).padStart(2,'0')),create('span','',layer.label));
      layers.append(button);
    });
    const nodes = create('div','architecture-component-options');
    architecture.nodes.filter(node => node.layer === source.layerId).forEach(node => {
      const button = create('button','architecture-component-option',node.label);
      button.type = 'button'; button.dataset.architectureFocus = node.id;
      button.setAttribute('aria-pressed',String(source.anchorId === node.id));
      nodes.append(button);
    });
    navigation.append(layers,nodes);
    canvas.replaceChildren(toolbar,stage,inspector,navigation);
  }
  function syncMotion() {
    starfield.sync(pageSuspended);
    const running = dialog.open && !document.hidden && !pageSuspended && !reduced.matches;
    activeSVGs.forEach(state => {
      const runSVG = running && state.visible;
      if (!state.svg || state.running === runSVG) return;
      state.svg.dataset.motion = runSVG ? 'running' : 'paused';
      if (runSVG) state.svg.unpauseAnimations?.();
      else state.svg?.pauseAnimations?.();
      state.running = runSVG;
    });
  }
  const motionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (activeSVGs.has(entry.target)) activeSVGs.get(entry.target).visible = visible;
    });
    syncMotion();
  },{root:dialog,threshold:.01});
  function renderCanvas(canvas,width = canvas.clientWidth) {
    const source = architectureSources.get(canvas);
    if (!source || width <= 0) return;
    const measuredWidth = Math.floor(width);
    const phone = narrowArchitecture.matches && measuredWidth < 520;
    const key = phone ? `focus:${measuredWidth}:${source.anchorId}:${source.inspectedId}:${source.layerId}` : narrowArchitecture.matches ? `responsive:${measuredWidth}` : 'desktop';
    if (source.key === key) return;
    const focused = document.activeElement;
    const focusAttribute = canvas.contains(focused) ? ['data-architecture-inspect','data-architecture-focus','data-architecture-layer','data-architecture-core'].find(attribute => focused.hasAttribute(attribute)) : null;
    const focusValue = focusAttribute ? focused.getAttribute(focusAttribute) : null;
    const previous = activeSVGs.get(canvas);
    previous?.svg?.pauseAnimations?.();
    canvas.dataset.layout = phone ? 'focus' : narrowArchitecture.matches ? 'responsive' : 'desktop';
    if (phone) renderPhoneCanvas(canvas,source,measuredWidth);
    else canvas.innerHTML = narrowArchitecture.matches
        ? renderResponsiveArchitecture(source.project,measuredWidth)
        : renderArchitecture(source.project);
    source.key = key;
    if (focusAttribute) {
      if (phone) canvas.querySelector(`[${focusAttribute}="${focusValue}"]`)?.focus({preventScroll:true});
      else $('#portfolio-title').focus({preventScroll:true});
    }
    if (previous) {
      activeSVGs.set(canvas,{svg:canvas.querySelector('svg'),visible:previous.visible,running:null});
      syncMotion();
    }
  }
  const canvasResizeObserver = new ResizeObserver(entries => {
    entries.forEach(({target,contentRect}) => renderCanvas(target,contentRect.width));
  });
  function setArchitecture(canvas,project) {
    const core = project.architecture.nodes.find(node => node.id === project.architecture.focus) || project.architecture.nodes[0];
    architectureSources.set(canvas,{project,key:null,anchorId:core.id,inspectedId:core.id,layerId:core.layer});
    // Opening the dialog gives ResizeObserver its first real content width.
    canvas.innerHTML = '';
    renderCanvas(canvas);
  }
  dialog.addEventListener('click',event => {
    const button = event.target.closest('[data-architecture-inspect],[data-architecture-focus],[data-architecture-layer],[data-architecture-core]');
    if (!button) return;
    const canvas = button.closest('.architecture-canvas'), source = architectureSources.get(canvas);
    if (!source) return;
    let selector;
    if (button.hasAttribute('data-architecture-inspect')) {
      source.inspectedId = button.dataset.architectureInspect;
      selector = `[data-architecture-inspect="${source.inspectedId}"]`;
    } else if (button.hasAttribute('data-architecture-layer')) {
      source.layerId = button.dataset.architectureLayer;
      selector = `[data-architecture-layer="${source.layerId}"]`;
    } else {
      const id = button.hasAttribute('data-architecture-core') ? source.project.architecture.focus : button.dataset.architectureFocus;
      const node = source.project.architecture.nodes.find(node => node.id === id);
      source.anchorId = source.inspectedId = node.id;
      source.layerId = node.layer;
      selector = button.hasAttribute('data-architecture-core') ? `[data-architecture-inspect="${node.id}"]` : `[data-architecture-focus="${node.id}"]`;
    }
    renderCanvas(canvas);
    canvas.querySelector(selector)?.focus({preventScroll:true});
  });
  function bindMotion() {
    motionObserver.disconnect();
    canvasResizeObserver.disconnect();
    activeSVGs.forEach(state => state.svg?.pauseAnimations?.());
    activeSVGs.clear();
    dialog.querySelectorAll('.architecture-canvas').forEach(canvas => {
      const svg = canvas.querySelector('svg');
      activeSVGs.set(canvas,{svg,visible:false,running:null});
      motionObserver.observe(canvas);
      canvasResizeObserver.observe(canvas);
    });
    syncMotion();
  }
  narrowArchitecture.addEventListener('change',() => {
    activeSVGs.forEach((state,canvas) => renderCanvas(canvas));
  });
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
    dialog.dataset.project = project.id;
    $('#portfolio-title').textContent = project.title;
    $('#portfolio-description').textContent = project.summary;
    $('#portfolio-eyebrow').textContent = `PROJECT / ${String(selected + 1).padStart(2,'0')} · ENGINEERING`;
    $('#portfolio-group').textContent = project.group;
    $('#portfolio-role').textContent = project.role;
    $('#portfolio-counter').textContent = `${String(selected + 1).padStart(2,'0')} / ${String(projects.length).padStart(2,'0')}`;
    const backgroundHeading = create('div','portfolio-section-heading');
    backgroundHeading.append(create('p','mono','CONTEXT / WHY THIS PROJECT'),create('h3','','项目背景'));
    background.replaceChildren(backgroundHeading,create('p','',project.background?.text));
    background.hidden = !project.background?.text;
    const stack = project.implementation?.stack || [];
    const highlights = project.implementation?.highlights || [];
    const tags = $('#portfolio-tags');
    tags.replaceChildren(...project.tags.map(tag => create('span','',tag)));
    tags.hidden = stack.length > 0;
    const implementationParts = [];
    if (stack.length) {
      const components = create('div','portfolio-stack');
      components.append(create('h3','mono','TECH STACK'));
      const list = create('ul','portfolio-stack-list');
      list.setAttribute('role','list');
      list.append(...stack.map(name => create('li','',name)));
      components.append(list);
      implementationParts.push(components);
    }
    if (highlights.length) {
      const index = create('div','portfolio-implementation-index');
      const heading = create('div','portfolio-section-heading');
      heading.append(create('p','mono','ENGINEERING CHALLENGES'),create('h3','','实现要点'));
      index.append(heading);
      const list = create('dl','portfolio-highlights');
      highlights.forEach((highlight,highlightIndex) => {
        const item = create('div','portfolio-highlight');
        const number = create('span','portfolio-highlight-index mono',String(highlightIndex + 1).padStart(2,'0'));
        number.setAttribute('aria-hidden','true');
        const term = create('dt','');
        term.append(number,create('span','portfolio-highlight-label',highlight.label));
        item.append(term,create('dd','',highlight.text));
        list.append(item);
      });
      index.append(list);
      implementationParts.push(index);
    }
    implementation.replaceChildren(...implementationParts);
    implementation.hidden = implementationParts.length === 0;
    const detailsHeading = create('div','portfolio-details-heading portfolio-section-heading');
    detailsHeading.append(create('p','mono','IMPLEMENTATION NOTES'),create('h3','','项目与实现'));
    const details = project.sections.map((section,index) => {
      const item = create('section','portfolio-detail');
      const copy = create('div','portfolio-detail-copy');
      const heading = create('h3','',section.label);
      heading.id = `portfolio-detail-${project.id}-${index}`;
      item.setAttribute('aria-labelledby',heading.id);
      copy.append(heading,create('p','',section.text));
      item.append(create('span','portfolio-detail-index mono',String(index + 1).padStart(2,'0')),copy);
      return item;
    });
    const referenceLinks = create('nav','portfolio-reference-links');
    referenceLinks.setAttribute('aria-label','相关技术资料');
    (project.links || []).forEach(link => {
      const anchor = create('a','',`${link.label} ↗`);
      anchor.href = link.url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      referenceLinks.append(anchor);
    });
    detailsContainer.replaceChildren(detailsHeading,...details,...(referenceLinks.childElementCount ? [referenceLinks] : []));
    $('#portfolio-diagram-title').textContent = project.architecture.title || '技术架构';
    const diagramNote = $('#portfolio-diagram-note');
    diagramNote.textContent = project.architecture.note || '';
    diagramNote.hidden = !project.architecture.note;
    activeSVGs.forEach(state => state.svg?.pauseAnimations?.());
    setArchitecture(architectureCanvas,project);
    modelEngineering.replaceChildren();
    const infra = project.modelEngineering;
    modelEngineering.hidden = !infra;
    if (!modelEngineering.hidden) {
      const heading = create('div','portfolio-section-heading');
      heading.append(create('p','mono','ALGORITHM / MODEL / INFRA'),create('h3','',infra.title));
      const stack = create('ul','portfolio-stack-list model-engineering-stack');
      stack.setAttribute('role','list');
      stack.setAttribute('aria-label','Model Engineering Tech Stack');
      stack.append(...infra.stack.map(name => create('li','',name)));
      const canvas = create('div','architecture-canvas');
      setArchitecture(canvas,infra);
      const notes = create('div','model-engineering-details');
      (infra.sections || []).forEach(section => {
        const item = create('section','model-engineering-detail');
        item.append(create('h4','',section.label),create('p','',section.text));
        notes.append(item);
      });
      modelEngineering.append(heading,create('p','',infra.summary),stack,notes,create('p','model-engineering-note',infra.architecture.note),canvas);
    }
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
    projectTrigger = trigger; showProject(index); dialog.dataset.entry = event.detail === 0 ? 'instant' : 'pointer'; dialog.showModal(); document.body.style.overflow = 'hidden';
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
