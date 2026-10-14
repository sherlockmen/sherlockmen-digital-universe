import {renderArchitecture,relationLabel,componentType} from './portfolio-diagrams.mjs?v=technical-6';

(async () => {
  'use strict';
  const data = await fetch(new URL('./portfolio-data.json?v=technical-6',import.meta.url)).then(response => {
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
    $('#portfolio-architecture').innerHTML = renderArchitecture(project);
    const nodes = new Map(project.architecture.nodes.map(node => [node.id,node]));
    const layerCards = project.architecture.layers.map((layer,index) => {
      const section = create('section','architecture-layer');
      section.append(create('h4','',`${String(index + 1).padStart(2,'0')} / ${layer.label}`),create('span','layer-caption',layer.caption));
      const list = create('ul','architecture-components');
      list.append(...project.architecture.nodes.filter(node => node.layer === layer.id).map(node => {
        const card = create('li',`architecture-component${node.id === project.architecture.focus ? ' component-focus' : ''}`);
        card.append(create('span','component-type',[componentType(node),node.state].filter(Boolean).join(' / ')),create('strong','',node.label),create('span','component-detail',node.items.join(' · ')));
        return card;
      }));
      section.append(list); return section;
    });
    const connections = create('section','architecture-connections');
    connections.append(create('h4','','接口与数据流'));
    const connectionList = create('ol','architecture-connection-list');
    connectionList.append(...project.architecture.edges.map((edge,index) => {
      const item = create('li',`architecture-relation relation-${edge.kind}`);
      item.append(create('span','relation-source',`${String(index + 1).padStart(2,'0')} / ${nodes.get(edge.from).label}`),create('span','relation-connector',`${edge.bidirectional ? '↔' : '↓'} ${relationLabel(edge)}`),create('span','relation-target',nodes.get(edge.to).label));
      return item;
    }));
    connections.append(connectionList);
    $('#portfolio-relations').replaceChildren(...layerCards,connections);
    $('#portfolio-diagram-download').href = new URL(`./architectures/${project.id}.svg?v=technical-6`,import.meta.url).href;
    $('#portfolio-diagram-download').download = `${project.title}技术架构图.svg`;
    dialog.scrollTop = 0;
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
    $('#portfolio-close').focus();
  });
  $('#portfolio-close').addEventListener('click',() => dialog.close());
  dialog.addEventListener('close',() => {document.body.style.overflow = ''; projectTrigger?.focus({preventScroll:true});});
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
