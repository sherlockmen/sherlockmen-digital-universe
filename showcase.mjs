export function weightBudget(bits, parameters = 27e9) {
  if (![4, 8, 16].includes(bits)) throw new RangeError('Unsupported weight precision');
  return {gigabytes: parameters * bits / 8 / 1e9, reduction: (1 - bits / 16) * 100};
}

if (typeof document !== 'undefined') {
  const descriptions = {
    16: ['BF16 半精度权重，作为体积与质量对照', '保留半精度权重用于任务评测对照；实际部署仍需为 KV Cache、激活与运行时预留显存。'],
    8: ['INT8 相对 BF16 的理论权重体积减少', '8-bit 是中间体积预算；具体量化算法、硬件与推理算子会影响精度及运行开销。'],
    4: ['INT4 相对 BF16 的理论权重体积减少', 'AWQ / GPTQ 可用于低位宽权重量化；量化后仍需评测规则遵循、证据引用与结构化输出。']
  };
  const buttons = document.querySelectorAll('.showcase-precision');
  buttons.forEach(button => button.addEventListener('click', () => {
    const bits = Number(button.dataset.bits);
    const {reduction} = weightBudget(bits);
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.getElementById('showcase-saving').textContent = String(reduction);
    document.getElementById('showcase-budget-caption').textContent = descriptions[bits][0];
    document.getElementById('showcase-budget-detail').textContent = descriptions[bits][1];
  }));
  // Avoid playing a generated demo while its section is off screen or a project dialog is open.
  const video = document.getElementById('showcase-video');
  if (video) {
    const stopHiddenVideo = () => { if (document.hidden || document.querySelector('dialog[open]')) video.pause(); };
    document.addEventListener('visibilitychange', stopHiddenVideo);
    new MutationObserver(stopHiddenVideo).observe(document.body, {subtree:true, attributes:true, attributeFilter:['open']});
    new IntersectionObserver(entries => { if (!entries[0].isIntersecting) video.pause(); }).observe(video);
  }
}
