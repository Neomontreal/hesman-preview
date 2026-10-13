// Calculador: estimación instantánea con tarifas de ejemplo (content.mjs → RATES). Precio final = soumission del equipo.
const $ = (s, r = document) => r.querySelector(s);
const data = JSON.parse($('#calc-data').textContent);
const R = data.rates;
const config = JSON.parse($('#site-config').textContent);
const T = config.calc;
const form = $('[data-calc]');
const locale = config.lang === 'en' ? 'en-CA' : config.lang === 'es' ? 'es-MX' : 'fr-CA';
const money = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = {
  low: $('[data-price-low]'), high: $('[data-price-high]'), km: $('[data-km]'), hours: $('[data-hours]'), vehicle: $('[data-vehicle]'),
  from: $('[data-from-name]'), to: $('[data-to-name]'), pallets: $('[data-pallets-out]'), route: $('[data-route]'), truck: $('[data-route-truck]'),
  svg: $('.calc__route'), quote: $('[data-quote]')
};

function km(a, b) {
  if (a === b) return R.minKm;
  const [, la1, lo1] = R.cities[a], [, la2, lo2] = R.cities[b];
  const rad = Math.PI / 180, dLa = (la2 - la1) * rad, dLo = (lo2 - lo1) * rad;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(dLo / 2) ** 2;
  return Math.max(R.minKm, 6371 * 2 * Math.asin(Math.sqrt(h)) * R.roadFactor);
}

function compute() {
  const f = new FormData(form);
  const from = Number(f.get('from')), to = Number(f.get('to'));
  const pallets = Number(f.get('pallets')), service = f.get('service'), temp = f.get('temp');
  const d = km(from, to);
  let price, vehicleId;
  if (service === 'ltl') {
    price = Math.max(R.ltl.min, pallets * (R.ltl.perPallet + R.ltl.perPalletKm * d));
    vehicleId = temp === 'dry' ? (pallets <= 14 ? 'porteur-26' : 'semi-53-sec') : (pallets <= 12 ? 'porteur-24-frigo' : 'semi-53-frigo');
  } else {
    const v = R.vehicles.find(v => v.maxPallets >= pallets && (temp === 'dry' ? true : v.id.includes('frigo'))) || R.vehicles.at(-1);
    price = v.base + v.perKm * d;
    vehicleId = temp === 'dry' && v.id === 'semi-53-frigo' ? 'semi-53-sec' : v.id;
  }
  price *= 1 + (R.temp[temp] || 0);
  if (f.get('tailgate')) price += R.tailgate;
  if (f.get('urgent')) price *= 1 + R.urgent;
  price *= 1 + R.fuel;
  const round5 = (n) => Math.round(n / 5) * 5;
  return {
    from: R.cities[from][0], to: R.cities[to][0], km: Math.round(d), pallets, service, temp,
    tailgate: !!f.get('tailgate'), urgent: !!f.get('urgent'), date: f.get('date') || '',
    low: round5(price * (1 - R.spread)), high: round5(price * (1 + R.spread)),
    hours: Math.max(1, Math.round((d / R.avgKmh + R.handlingH) * 2) / 2), vehicleId
  };
}

// Animación de números
const shown = { low: 0, high: 0 };
function animateTo(key, node, to) {
  const from = shown[key]; shown[key] = to;
  if (reduced) { node.textContent = money.format(to); return; }
  const t0 = performance.now();
  const step = (t) => { const p = Math.min(1, (t - t0) / 700), e = 1 - (1 - p) ** 3; node.textContent = money.format(Math.round(from + (to - from) * e)); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// Ruta: la línea se dibuja y el mini camión la recorre
let routeAnim;
function drawRoute() {
  cancelAnimationFrame(routeAnim);
  const len = el.route.getTotalLength();
  const t0 = performance.now();
  const step = (t) => {
    const p = reduced ? 1 : Math.min(1, (t - t0) / 1300), e = 1 - (1 - p) ** 3;
    el.svg.style.setProperty('--draw', String(1 - e));
    const pt = el.route.getPointAtLength(e * len);
    el.truck.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    if (p < 1) routeAnim = requestAnimationFrame(step);
  };
  routeAnim = requestAnimationFrame(step);
}

let last = '';
function update() {
  const r = compute();
  window.__estimate = r;
  el.pallets.textContent = r.pallets;
  el.from.textContent = r.from; el.to.textContent = r.to;
  el.km.textContent = money.format(r.km);
  el.hours.textContent = String(r.hours).replace('.', config.lang === 'en' ? '.' : ',');
  el.vehicle.textContent = data.units[r.vehicleId];
  el.vehicle.href = `${data.fleetUrl}?unit=${r.vehicleId}`;
  animateTo('low', el.low, r.low);
  animateTo('high', el.high, r.high);
  const key = r.from + r.to;
  if (key !== last) { last = key; drawRoute(); }
}

form.addEventListener('input', update);
$('[data-swap]')?.addEventListener('click', () => {
  const a = form.elements.from.value; form.elements.from.value = form.elements.to.value; form.elements.to.value = a; update();
});

// Parámetros desde otras páginas (?service=ltl&temp=cold&vehicle=semi-53-frigo)
const q = new URLSearchParams(location.search);
if (['tl', 'ltl'].includes(q.get('service'))) form.elements.service.value = q.get('service');
if (['dry', 'cold', 'frozen'].includes(q.get('temp'))) form.elements.temp.value = q.get('temp');
const veh = q.get('vehicle');
if (veh) {
  const max = { 'cube-16': 8, 'porteur-24-frigo': 12, 'porteur-26': 14, 'semi-53-frigo': 22, 'semi-53-sec': 22 }[veh];
  if (max) form.elements.pallets.value = max;
  if (veh.includes('frigo')) form.elements.temp.value = 'cold';
}
const date = form.elements.date;
date.min = new Date().toISOString().slice(0, 10);

// Pasar a la soumission con el resumen ya escrito
$('[data-to-quote]').addEventListener('click', () => {
  const r = compute();
  el.quote.hidden = false;
  const msg = el.quote.querySelector('textarea');
  const colon = config.lang === 'fr' ? ' : ' : ': ';
  const svc = r.service === 'ltl' ? T.ltl : T.tl;
  const tmp = { dry: T.dry, cold: T.cold, frozen: T.frozen }[r.temp];
  msg.value = `${r.from} → ${r.to} (${r.km} ${T.km})\n${svc} · ${tmp} · ${r.pallets} ${T.pallets.toLowerCase()}${r.tailgate ? ' · ' + T.tailgate : ''}${r.urgent ? ' · ' + T.urgent : ''}${r.date ? '\n' + T.date + colon + r.date : ''}\n${T.estimate}${colon}${money.format(r.low)}–${money.format(r.high)} $`;
  el.quote.classList.add('is-in');
  el.quote.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  setTimeout(() => el.quote.querySelector('input')?.focus({ preventScroll: true }), 600);
});

update();
