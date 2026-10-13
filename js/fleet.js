// Flota: pestañas accesibles + entrada del camión + vista de carga (rayos X).
const tabs = [...document.querySelectorAll('[data-unit-tab]')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let timers = [];

function show(id, focus = false) {
  timers.forEach(clearTimeout); timers = [];
  tabs.forEach(t => { const on = t.dataset.unitTab === id; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
  document.querySelectorAll('[data-unit]').forEach(p => {
    const on = p.dataset.unit === id;
    p.hidden = !on;
    p.classList.remove('is-driving', 'is-xray');
    if (!on) return;
    const n = p.querySelector('[data-count]');
    if (n && window.hesmanCountUp) window.hesmanCountUp(n, Number(n.dataset.count), 0, 1200);
    if (reduced) return;
    void p.offsetWidth;
    p.classList.add('is-driving');
    timers.push(setTimeout(() => p.classList.add('is-xray'), 1500));
    timers.push(setTimeout(() => p.classList.remove('is-xray'), 6200));
    timers.push(setTimeout(() => p.classList.remove('is-driving'), 1700));
  });
}

tabs.forEach((t, i) => {
  t.addEventListener('click', () => show(t.dataset.unitTab));
  t.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    show(tabs[(i + d + tabs.length) % tabs.length].dataset.unitTab, true);
  });
});

// Clic en el camión: volver a ver la carga
document.querySelectorAll('.unit__stage').forEach(s => s.addEventListener('click', () => {
  const p = s.closest('[data-unit]');
  p.classList.add('is-xray');
  setTimeout(() => p.classList.remove('is-xray'), 4200);
}));

const want = new URLSearchParams(location.search).get('unit');
show(tabs.some(t => t.dataset.unitTab === want) ? want : tabs[0]?.dataset.unitTab);
