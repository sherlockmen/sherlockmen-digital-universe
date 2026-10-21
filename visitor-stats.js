(() => {
  'use strict';

  const stats = document.getElementById('visitor-stats');
  if (!stats) return;
  if (location.hostname !== 'sherlockmen.github.io' ||
      !/^\/sherlockmen-digital-universe\/(?:index\.html)?$/.test(location.pathname)) {
    stats.title = '本地预览不计入访问统计';
    return;
  }

  const storageKey = 'sherlockmen-universe:visitor-identity';
  const headers = {
    'x-bsz-referer': 'https://sherlockmen.github.io/sherlockmen-digital-universe/'
  };
  try {
    const identity = localStorage.getItem(storageKey);
    if (identity) headers.Authorization = `Bearer ${identity}`;
  } catch {}

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  fetch('https://bsz.iirose.cn/api', {
    method: 'POST',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers,
    signal: controller.signal
  }).then(async response => {
    if (!response.ok) throw new Error('Statistics unavailable');
    const result = await response.json();
    const { page_pv: views, page_uv: visitors } = result.data || {};
    if (result.success !== true ||
        ![views, visitors].every(value => Number.isSafeInteger(value) && value >= 0)) {
      throw new Error('Invalid statistics');
    }
    const identity = response.headers.get('Set-Bsz-Identity');
    if (identity) {
      try { localStorage.setItem(storageKey, identity); } catch {}
    }
    const format = new Intl.NumberFormat('zh-CN');
    document.getElementById('visit-count').textContent = format.format(views);
    document.getElementById('visitor-count').textContent = format.format(visitors);
  }).catch(() => {
    stats.title = '统计服务暂不可用';
  }).finally(() => clearTimeout(timeout));
})();
