(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  const $ = (selector) => document.querySelector(selector);
  const heroTitle = $('#hero-title');
  if (!reduced.matches) heroTitle.dataset.introPhase = 'pending';
  function showCompleteTitle() {
    heroTitle.getAnimations?.({subtree:true}).forEach(animation => animation.cancel());
    heroTitle.dataset.introPhase = 'complete';
    document.documentElement.dataset.heroIntro = 'complete';
  }
  document.querySelector('script[src="galaxy.js"]')?.addEventListener('error', showCompleteTitle);
  const toast = $('#toast');
  let toastTimer;
  function notify(message) {
    clearTimeout(toastTimer); toast.textContent = message; toast.dataset.open = 'true';
    toastTimer = setTimeout(() => { toast.dataset.open = 'false'; }, 3800);
  }
  const menu = $('#mobile-nav');
  const menuToggle = $('.menu-toggle');
  function closeMenu(focus = false) {
    menu.hidden = true; menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', '打开导航');
    if (focus) menuToggle.focus();
  }
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menu.hidden = !open; menuToggle.setAttribute('aria-expanded', String(open)); menuToggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
  });
  menu.addEventListener('click', (event) => {
    const link = event.target.closest('a'); if (!link) return;
    event.preventDefault(); closeMenu();
    const destination = $(link.getAttribute('href'));
    history.pushState(null, '', link.getAttribute('href'));
    destination.scrollIntoView({ behavior: reduced.matches || event.detail === 0 ? 'instant' : 'smooth' });
    destination.querySelector('h1,h2')?.focus({ preventScroll: true });
  });
  document.addEventListener('click', (event) => { if (!menu.hidden && !event.target.closest('.site-header')) closeMenu(); });
  matchMedia('(min-width: 681px)').addEventListener('change', (event) => { if (event.matches) closeMenu(); });

  const projects = [
    { id:'infinity', folder:'interactive', title:'无限之结', english:'INFINITY\nKNOT.', art:'knot', mode:'knot', tags:['交互实验','3D 雕塑','演示项目'], description:'让一段线条，绕过想象力的边界。拖动旋转，发现每一个转角里的新形状。', storyTitle:'把一条线，变成一种可能。', story:'一条连续的线，可以看起来无穷无尽。这个实验用金属质感、缓慢旋转和鼠标互动，探索一个简单形状如何成为一个值得停留的空间。你可以用方向键转动它，也可以按 Home 键恢复视角。' },
    { id:'orbit', folder:'interactive', title:'星环轨道', english:'ORBITAL\nTHOUGHTS.', art:'orbit', mode:'orbit', tags:['交互实验','轨道与空间','演示项目'], description:'让想法围绕一个中心自由运行。换个角度，看到秩序之外的可能。', storyTitle:'在秩序里，留一点自由。', story:'三个不同方向的圆环围绕球体构成一个小小的轨道系统。它们有自己的方向，却共享同一个中心。拖动它，观察环与环之间的关系，或者让它自行缓慢旋转。' },
    { id:'prism', folder:'interactive', title:'棱镜晶体', english:'ANOTHER\nANGLE.', art:'crystal', mode:'crystal', tags:['交互实验','几何与光','演示项目'], description:'同一个物体，因为视角不同，就会呈现不同的表情。', storyTitle:'换个角度，就是新的答案。', story:'一个简单的几何体，被光线分成不同的面。这个实验保留了棱角，也保留了围绕它的一条细线。你不需要找到正确的角度，每一个角度都值得看一看。' },
    { id:'curious', folder:'visual', title:'保持好奇 · 文字海报', english:'STAY\nCURIOUS.', art:'typography', tags:['视觉概念','字体与留白','演示项目'], description:'让简单的两个词，成为一个醒目的提醒。保持好奇，继续创造。', storyTitle:'让文字自己站在舞台上。', story:'这个海报练习只使用大幅文字、低饱和的色彩和明确的留白。它不解释所有事情，而是保留一个可以继续想象的入口。作品中的文字与构图是本次网站的原创演示。' },
    { id:'field', folder:'visual', title:'线条之外 · 图形练习', english:'BETWEEN\nTHE LINES.', art:'field', tags:['视觉概念','线条与节奏','演示项目'], description:'把重复的线条，变成可以呼吸的节奏。', storyTitle:'重复，也可以长出不同。', story:'一组连续的线条，在位置与间距之间形成变化。这个图形练习尝试用很少的元素，构成一个安静而有张力的视觉场。它是一个概念示例，期待被更多真实作品替换。' },
    { id:'note', folder:'notes', title:'一切从一个“为什么”开始', english:'WHAT\nIF?', art:'note', tags:['灵感记录','示例随记'], description:'如果换一种方式，会发生什么？很多有趣的事情，都从这个小问题开始。', storyTitle:'给还没成形的想法留个位置。', story:'不必等一个想法完全成熟，再给它一个名字。先把问题记下来，再做一个小小的实验。这里暂时是一篇示例随记，你的真实思考、过程和故事，可以慢慢填进这个个人空间。' }
  ];
  function artHTML(art) {
    const designs = {knot:'<i class="mini-sculpture"></i>',orbit:'<i class="mini-orbit"></i>',crystal:'<i class="mini-crystal"></i>',typography:'<span class="poster-type">STAY.<br>CURIOUS.</span>',field:'<i class="field-lines"></i>',note:'<span class="note-art">WHAT<br>IF?</span>'};
    return designs[art] || '';
  }
  const dialog = $('#project-dialog');
  let selectedProject = 0;
  let projectTrigger;
  function showProject(index) {
    selectedProject = (index + projects.length) % projects.length;
    const project = projects[selectedProject];
    $('#case-title').replaceChildren(...project.english.split('\n').flatMap((line,i) => i ? [document.createElement('br'),document.createTextNode(line)] : [document.createTextNode(line)]));
    $('#case-description').textContent = project.description;
    $('#case-eyebrow').textContent = project.mode ? 'INTERACTIVE / DEMO PROJECT' : 'CONCEPT / DEMO PROJECT';
    $('#case-index').textContent = `CREATIVE EXPERIMENT / ${String(selectedProject+1).padStart(2,'0')}`;
    $('#case-counter').textContent = `${String(selectedProject+1).padStart(2,'0')} / ${String(projects.length).padStart(2,'0')}`;
    $('#case-tags').replaceChildren(...project.tags.map((tag) => {const span=document.createElement('span');span.textContent=tag;return span;}));
    $('#case-story-title').textContent = project.storyTitle;
    $('#case-story-text').textContent = project.story;
    $('#hero-canvas').hidden = !project.mode;
    $('#case-static-art').hidden = Boolean(project.mode);
    $('#case-controls').hidden = !project.mode;
    $('#scene-status').hidden = !project.mode;
    if (project.mode) { window.SherlockScene?.setMode(project.mode); window.SherlockScene?.reset(); }
    else { $('#case-static-art').className = `case-static-art art-${project.art}`; $('#case-static-art').innerHTML = artHTML(project.art); }
    dialog.scrollTop = 0;
    if (dialog.open) $('#case-title').focus({preventScroll:true});
  }
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-project]'); if (!trigger) return;
    const index = projects.findIndex((project) => project.id === trigger.dataset.project); if (index < 0) return;
    projectTrigger = trigger;
    showProject(index); dialog.showModal(); document.body.style.overflow = 'hidden';
    $('#close-case').focus();
  });
  function closeCase() { dialog.close(); }
  $('#close-case').addEventListener('click', closeCase);
  $('#case-home').addEventListener('click', () => closeCase());
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; projectTrigger?.focus({preventScroll:true}); });
  $('#previous-case').addEventListener('click', () => showProject(selectedProject-1));
  $('#next-case').addEventListener('click', () => showProject(selectedProject+1));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || dialog.open) return;
    if (!menu.hidden) { closeMenu(true); event.preventDefault(); }

  });

  function updatePause() {
    window.SherlockGalaxy?.setPaused(paused);
    window.SherlockScene?.setPaused(paused);
    window.SherlockCollections?.setPaused(paused);

  }
  window.addEventListener('collections-ready', updatePause);
  $('#reset-scene').addEventListener('click', () => window.SherlockScene?.reset());
  document.addEventListener('keydown', (event) => {
    const sceneFocus = event.target.matches?.('#galaxy-canvas,#hero-canvas') || event.target.closest?.('[data-particle-scene]');
    if (!sceneFocus || event.repeat || event.ctrlKey || event.altKey || event.metaKey || (event.key !== ' ' && event.key.toLowerCase() !== 'p')) return;
    event.preventDefault();
    if (reduced.matches) return;
    paused=!paused;updatePause();
  });
  function updateGalaxyStatus() {
    const failed = $('#galaxy-canvas').dataset.galaxyReady === 'false';
    $('#galaxy-status').textContent = failed ? '当前设备无法显示动态星河，仍可浏览完整主页。' : '';
    document.querySelector('.galaxy-stage').classList.toggle('galaxy-unavailable', failed);
    if (failed) showCompleteTitle();
    document.querySelectorAll('[data-particle-scene]').forEach(button => { button.disabled = failed; });
  }
  window.addEventListener('galaxy-ready', () => { updateGalaxyStatus(); updatePause(); });
  window.addEventListener('galaxy-error', updateGalaxyStatus);
  reduced.addEventListener('change', () => { paused=reduced.matches;updatePause();updateProgress(); });
  updatePause();
  if ('IntersectionObserver' in window) {
    const observer=new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('visible');observer.unobserve(entry.target); }
    }),{threshold:.08});
    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
    if (!reduced.matches) document.documentElement.classList.add('motion-ready');
  }
  const progress=$('.scroll-progress');let scrollPending=false;
  const heroCopy = [$('#hero-title'), $('.hero-bottom')];
  const introHeading = $('#particle-intro-title');
  let introParallax = 0;
  function updateCopy() {
    const p = Math.min(1,Math.max(0,-$('#home').getBoundingClientRect().top/200));
    const opacity = 1-p*p*p*(p*(6*p-15)+10);
    heroCopy.forEach(element => {
      element.style.opacity = String(opacity);
      element.style.visibility = opacity < .001 ? 'hidden' : '';
    });
    const bounds = introHeading.getBoundingClientRect();
    const center = bounds.top-introParallax+bounds.height/2-innerHeight/2;
    const span = (innerHeight+bounds.height)/2;
    introParallax = reduced.matches ? 0 : Math.round(Math.min(1,Math.max(-1,center/span)))*(innerWidth<=680 ? 72 : 120);
    document.querySelector('.particle-intro-copy').style.setProperty('--intro-parallax',`${introParallax}px`);
  }
  function updateProgress() { updateCopy();$('.site-header').classList.toggle('is-scrolled',scrollY>24);const distance=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${distance>0?Math.min(scrollY/distance,1):0})`;scrollPending=false; }
  addEventListener('scroll',() => {if(!scrollPending){scrollPending=true;requestAnimationFrame(updateProgress);}},{passive:true});
  addEventListener('resize',updateProgress);updateProgress();
  async function copyLink() {
    try {await navigator.clipboard.writeText(location.origin+location.pathname);notify('主页链接已复制');}
    catch {notify('请复制浏览器地址栏中的主页链接');}
  }
  $('#copy-link').addEventListener('click',copyLink);
  $('#share-page').addEventListener('click',async () => {
    if (!navigator.share) {await copyLink();return;}
    const button=$('#share-page');button.disabled=true;
    try {await navigator.share({title:'SherlockMen — 个人宇宙',text:'从好奇，走向无限。欢迎来到我的个人宇宙。',url:location.origin+location.pathname});}
    catch(error){if(error.name!=='AbortError')await copyLink();}
    finally{button.disabled=false;}
  });
})();
