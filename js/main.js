// Hesman — interacciones comunes. Sin librerías: IntersectionObserver + un solo bucle de scroll con rAF.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const config = JSON.parse($('#site-config')?.textContent || '{}');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const fmt = new Intl.NumberFormat(config.lang === 'en' ? 'en-CA' : config.lang === 'es' ? 'es-MX' : 'fr-CA');

// ---------- idioma: recordar la elección manual ----------
$$('[data-lang]').forEach(a => a.addEventListener('click', () => {
  document.cookie = `site_lang=${a.dataset.lang}; path=/; max-age=31536000; SameSite=Lax`;
}));

// ---------- texto palabra por palabra ----------
function splitWords(el, cls) {
  const walk = (node, k) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement('span');
          if (cls === 'w') { w.className = 'w'; const i = document.createElement('i'); i.textContent = part; i.style.setProperty('--k', Math.min(14, k.n++)); w.append(i); }
          else { w.className = 'sw'; w.textContent = part; }
          frag.append(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) walk(child, k);
    }
  };
  walk(el, { n: 0 });
}
if (!reduced) {
  $$('[data-split]').forEach(el => splitWords(el, 'w'));
  $$('[data-scrub]').forEach(el => splitWords(el, 'sw'));
}

// ---------- aparición ----------
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('is-in');
  if (e.target.matches('[data-count]')) countUp(e.target);
  io.unobserve(e.target);
}), { rootMargin: '0px 0px -12% 0px' });
$$('.reveal, [data-split], [data-map], .facts [data-count], .quote').forEach(el => io.observe(el));

function countUp(el, to = Number(el.dataset.count), from = 0, ms = 1400) {
  const suffix = el.dataset.suffix || '';
  if (reduced) { el.textContent = fmt.format(to) + suffix; return; }
  const t0 = performance.now();
  const tick = (t) => {
    const p = clamp((t - t0) / ms), e = 1 - Math.pow(1 - p, 4);
    el.textContent = fmt.format(Math.round(from + (to - from) * e)) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
window.hesmanCountUp = countUp;

// ---------- encabezado, progreso, menú ----------
const header = $('.site-header');
const bar = $('.progress');
const dock = $('.dock');
const sheet = $('#sheet');
if (sheet) {
  const open = () => { sheet.showModal(); requestAnimationFrame(() => sheet.classList.add('is-open')); };
  const close = () => { sheet.classList.remove('is-open'); setTimeout(() => sheet.close(), 420); };
  $('.dock__menu')?.addEventListener('click', open);
  $$('[data-sheet-close], [data-sheet-link]', sheet).forEach(b => b.addEventListener('click', close));
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
  sheet.addEventListener('cancel', e => { e.preventDefault(); close(); });
}

// ---------- escenas por scroll ----------
const hero = $('[data-hero]');
const heroCopies = $$('.hero__copy');
const meters = $$('[data-meter]');
const story = $('[data-pin="story"]');
const storySteps = $$('.story__step');
const storyDots = $$('[data-dot]');
const storyIcons = $$('.mt');
const storyCount = $('[data-story-count]');
const zones = $('[data-pin="zones"]');
const zoneItems = $$('[data-zone]');
const bays = $$('[data-bay]');
const crosses = $$('[data-cross]');
const scrubs = $$('[data-scrub]');
const cards = $$('[data-card]');
const link = $('[data-link3d]');
const linkLines = $$('[data-lstep]');
const engine = $('[data-engine3d]');
const engineSteps = $$('[data-estep]');
const engineDots = $$('[data-edot]');
let linkStep = 0, engineStep = 0;
// Red de seguridad: si el párrafo ya quedó arriba (scroll rápido, anclas), se muestra completo
const scrubIO = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting && e.boundingClientRect.top < 0) { e.target.querySelectorAll('.sw').forEach(w => w.classList.add('on')); scrubIO.unobserve(e.target); }
}));
scrubs.forEach(el => scrubIO.observe(el));

const pinProgress = (el) => { const r = el.getBoundingClientRect(), span = r.height - innerHeight; return span > 1 ? clamp(-r.top / span) : 0; };

let heroStage = 0, storyStep = -1, zoneStep = -1, lastY = scrollY, shownCount = 1;

// Reproduce la entrada del primer título
if (heroCopies[0] && !reduced) { heroCopies[0].classList.remove('is-active'); requestAnimationFrame(() => requestAnimationFrame(() => heroCopies[0].classList.add('is-active'))); }

function setHeroStage(i) {
  if (i === heroStage) return;
  heroCopies.forEach((c, k) => { c.classList.toggle('is-active', k === i); c.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
  heroStage = i;
}

function setStoryStep(i) {
  if (i === storyStep) return;
  storyStep = i;
  storySteps.forEach((s, k) => s.classList.toggle('is-active', k === i));
  storyDots.forEach((d, k) => d.classList.toggle('on', k <= i));
  const step = storySteps[i];
  const target = Number(step.dataset.count);
  story.classList.toggle('is-cold', step.hasAttribute('data-cold'));
  storyIcons.forEach((ic, k) => { ic.style.setProperty('--d', Math.abs(k - shownCount) * 18); ic.classList.toggle('on', k < target); });
  if (storyCount && target !== shownCount) countUp(storyCount, target, shownCount, 900);
  const unit = storyCount?.nextElementSibling;
  if (unit) unit.textContent = target === 1 ? unit.dataset.unitOne : unit.dataset.unitMany;
  shownCount = target;
}

function setZone(i) {
  if (i === zoneStep) return;
  zoneStep = i;
  zoneItems.forEach((z, k) => z.classList.toggle('on', k === i));
  bays.forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('past', k < i); });
}

function frame() {
  const y = scrollY, vh = innerHeight;
  const doc = document.documentElement.scrollHeight - vh;
  bar?.style.setProperty('--p', doc > 0 ? y / doc : 0);
  header?.classList.toggle('is-scrolled', y > 40);
  header?.classList.toggle('is-hidden', y > 400 && y > lastY + 4);
  if (y < lastY - 4) header?.classList.remove('is-hidden');
  lastY = y;

  if (reduced) return;
  if (hero) {
    const p = pinProgress(hero);
    window.__heroP = p;
    const st = Math.min(heroCopies.length - 1, Math.floor(p * heroCopies.length * 0.999));
    setHeroStage(st);
    meters.forEach((m, k) => m.classList.toggle('on', k === st));
  }
  if (link) {
    const p = pinProgress(link); window.__linkP = p;
    const i = p < 0.34 ? 0 : p < 0.6 ? 1 : 2;
    if (i !== linkStep) { linkStep = i; linkLines.forEach((l, k) => l.classList.toggle('is-active', k === i)); }
    link.classList.toggle('is-last', i === linkLines.length - 1);
  }
  if (engine) {
    const p = pinProgress(engine); window.__engineP = p;
    const i = Math.min(engineSteps.length - 1, Math.floor(p * engineSteps.length * 0.999));
    if (i !== engineStep) { engineStep = i; engineSteps.forEach((st, k) => st.classList.toggle('is-active', k === i)); }
    engineDots.forEach((d, k) => d.classList.toggle('on', k === i));
  }
  if (story) setStoryStep(Math.min(storySteps.length - 1, Math.floor(pinProgress(story) * storySteps.length * 0.999)));
  if (zones) setZone(Math.min(zoneItems.length - 1, Math.floor(clamp(pinProgress(zones) * 1.08) * zoneItems.length * 0.999)));

  for (const c of crosses) {
    const r = c.getBoundingClientRect();
    if (r.bottom < -50 || r.top > vh + 50) continue;
    const x = clamp((vh - r.top) / (vh + r.height));
    c.style.setProperty('--x', x.toFixed(4));
    c.style.setProperty('--rot', `${(x * 1440).toFixed(1)}deg`);
  }
  // Tarjetas apiladas: la de abajo se encoge y oscurece cuando la siguiente la cubre
  for (let i = 0; i < cards.length - 1; i++) {
    const a = cards[i].getBoundingClientRect(), b = cards[i + 1].getBoundingClientRect();
    cards[i].style.setProperty('--cover', clamp(1 - (b.top - a.top) / a.height).toFixed(3));
  }
  for (const el of scrubs) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) continue;
    const words = el._w || (el._w = $$('.sw', el));
    const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35));
    const n = Math.round(p * words.length);
    for (let k = 0; k < n; k++) words[k].classList.add('on'); // se encienden y se quedan: el texto nunca vuelve a atenuarse
  }
}
let ticking = false;
const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame(); }); } };
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
frame();

// ---------- carrusel del equipo: arrastre + parallax ----------
$$('[data-rail]').forEach(rail => {
  let down = false, sx = 0, sl = 0;
  rail.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = rail.scrollLeft; rail.style.scrollSnapType = 'none'; });
  addEventListener('pointerup', () => { if (down) { down = false; rail.style.scrollSnapType = ''; } });
  rail.addEventListener('pointermove', e => { if (down) rail.scrollLeft = sl - (e.clientX - sx); });
  const imgs = $$('[data-parallax-x]', rail);
  const par = () => {
    const w = innerWidth;
    imgs.forEach(im => { const r = im.getBoundingClientRect(); im.style.setProperty('--px', (((r.left + r.width / 2) / w - 0.5) * -12).toFixed(2)); });
  };
  rail.addEventListener('scroll', () => requestAnimationFrame(par), { passive: true });
  par();
});

// ---------- teaser: precio que cambia ----------
const ticker = $('[data-ticker]');
if (ticker && !reduced) {
  const vals = [1284, 465, 2190, 890, 1645, 320];
  let k = 0;
  setInterval(() => { const from = vals[k % vals.length]; k++; countUp(ticker, vals[k % vals.length], from, 900); }, 3200);
}

// ---------- formularios de solicitud ----------
$$('[data-lead-form]').forEach(form => {
  const t = config.form;
  const status = $('.form-status', form);
  const btn = $('button[type=submit]', form);
  const setErr = (input, msg) => {
    const p = input.parentElement.querySelector('.error');
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (p) { p.textContent = msg || ''; p.hidden = !msg; }
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let bad = null;
    for (const input of $$('[required]', form)) {
      const v = input.value.trim();
      const msg = !v ? t.required : (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? t.invalidEmail : '');
      setErr(input, msg);
      if (msg && !bad) bad = input;
    }
    if (bad) { bad.focus(); return; }
    const data = Object.fromEntries(new FormData(form));
    data.kind = form.dataset.kind; data.lang = config.lang;
    if (data.kind === 'quote' && window.__estimate) data.estimate = window.__estimate;
    btn.disabled = true; const label = btn.innerHTML; btn.textContent = t.sending;
    status.className = 'form-status'; status.textContent = '';
    try {
      const r = await fetch('/api/soumission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error(r.status);
      form.reset(); status.classList.add('ok'); status.textContent = t.success;
    } catch {
      status.classList.add('err'); status.textContent = t.error;
    } finally { btn.disabled = false; btn.innerHTML = label; }
  });
});
