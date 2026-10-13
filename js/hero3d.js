// Hero 3D: tracteur aérodynamique + remorque frigorifique Hesman sur une autoroute de nuit.
// La cámara sigue el scroll (window.__heroP). Solo con WebGL y sin movimiento reducido; si no, queda la foto real.
const hero = document.querySelector('[data-hero]');
const canvas = hero?.querySelector('.hero__canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (hero && canvas && !reduced && webgl()) {
  const start = () => import('/hesman-preview/js/vendor/three.module.min.js').then(init).catch(err => console.warn('3D off:', err));
  ('requestIdleCallback' in window) ? requestIdleCallback(start, { timeout: 1200 }) : setTimeout(start, 300);
}

const loadImg = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });

async function init(THREE) {
  const mobile = matchMedia('(max-width: 899px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const INK = 0x0a0810;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.Fog(INK, 30, 125);

  // ---------- entorno de reflejos (sin HDR externo) ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 v; void main(){ float h = v.y*.5+.5; gl_FragColor = vec4(mix(vec3(.015,.014,.02), vec3(.22,.2,.27), pow(h,2.)),1.); }'
  })));
  const panel = (w, h, x, y, z, c, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  panel(34, 5, 0, 30, -6, 0xffffff, 2.4);     // softbox cenital: reflejo largo en techos y vidrios
  panel(24, 6, -32, 7, 6, 0xcdb8ec, 0.9);
  panel(24, 6, 32, 5, -16, 0xffe2c2, 0.9);
  scene.environment = pmrem.fromScene(env, 0.03).texture;

  // ---------- luces ----------
  scene.add(new THREE.HemisphereLight(0xdcd8e4, 0x0a0810, 0.5));
  const key = new THREE.DirectionalLight(0xfff7f0, 3.0); key.position.set(-12, 18, -8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xc6a6ef, 1.4); rim.position.set(10, 6, 22); scene.add(rim);

  // ---------- texturas de apoyo ----------
  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t;
  };
  const radial = (rgba) => canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, rgba); gr.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  });
  const glowTex = radial('rgba(255,222,186,.55)');
  const shadowTex = radial('rgba(0,0,0,.9)');

  // ---------- carretera ----------
  const road = new THREE.Mesh(new THREE.PlaneGeometry(26, 260), new THREE.MeshStandardMaterial({ color: 0x18171c, roughness: 0.8, metalness: 0.05, envMapIntensity: 0.35 }));
  road.rotation.x = -Math.PI / 2; road.position.z = -60; scene.add(road);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 260), new THREE.MeshStandardMaterial({ color: 0x0b0a0e, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, -60); scene.add(ground);

  const moving = [];
  const LOOP = 240, FRONT = -180;
  const dashGeo = new THREE.PlaneGeometry(0.18, 3.4);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xcfc9d8 });
  for (const x of [-3.7, 3.7]) for (let i = 0; i < 26; i++) {
    const d = new THREE.Mesh(dashGeo, dashMat); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.01, FRONT + i * 9.2); scene.add(d); moving.push(d);
  }
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x7c7390 });
  for (const x of [-11, 11]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 260), edgeMat); e.rotation.x = -Math.PI / 2; e.position.set(x, 0.01, -60); scene.add(e); }

  // Postes LED modernos con charco de luz (sin luces reales: ligero en el celular)
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x24202c, roughness: 0.45, metalness: 0.7 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff0dc });
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 8; i++) for (const side of [-1, 1]) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 9, 12), poleMat); pole.position.y = 4.5;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 0.1), poleMat); arm.position.set(-side * 1.3, 9, 0);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 0.28), lampMat); lamp.position.set(-side * 2.5, 8.94, 0);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(-side * 2.6, 0.02, 0);
    g.add(pole, arm, lamp, pool);
    g.position.set(side * 12, 0, FRONT + i * 30 + (side > 0 ? 15 : 0));
    scene.add(g); moving.push(g);
  }
  // Resplandor de ciudad en el horizonte
  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(260, 40), new THREE.MeshBasicMaterial({
    map: canvasTex(8, 256, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(150,95,210,.55)'); gr.addColorStop(.35, 'rgba(120,70,180,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }),
    transparent: true, depthWrite: false, fog: false
  }));
  horizon.position.set(0, 14, -140); scene.add(horizon);

  // ---------- materiales del camión ----------
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xf6f5f8, roughness: 0.28, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 });
  const satin = new THREE.MeshStandardMaterial({ color: 0x1b1821, roughness: 0.5, metalness: 0.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0e0c12, roughness: 0.65, metalness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0c0912, roughness: 0.03, metalness: 0.9, clearcoat: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xc9c6d2, roughness: 0.22, metalness: 1 });
  const violet = new THREE.MeshStandardMaterial({ color: 0x6b2f9b, roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ledWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const ledViolet = new THREE.MeshBasicMaterial({ color: 0xc28cff, toneMapped: false });
  const ledRed = new THREE.MeshBasicMaterial({ color: 0xff3048, toneMapped: false });
  const ledAmber = new THREE.MeshBasicMaterial({ color: 0xffb547, toneMapped: false });

  const truck = new THREE.Group(); scene.add(truck);
  const add = (geo, mat, x, y, z, parent = truck) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // ---------- remorque (frente en z=0, 16 m hacia +z) ----------
  const logo = await loadImg('/hesman-preview/assets/logo/Hesman-Logo.svg').catch(() => null);
  await document.fonts?.ready;
  const TL = 16, TW = 2.6, TH = 2.85, TB = 1.32;
  // Livrée. BoxGeometry: en la cara +x la parte trasera queda a la izquierda de la textura; en la cara -x, a la derecha.
  const livery = (rearAt) => canvasTex(4096, 728, (g, w, h) => {
    g.fillStyle = '#F7F6F9'; g.fillRect(0, 0, w, h);
    const flip = rearAt === 'left';
    g.save(); if (flip) { g.translate(w, 0); g.scale(-1, 1); }
    const gr = g.createLinearGradient(w * 0.7, 0, w, 0); gr.addColorStop(0, '#7B3BB0'); gr.addColorStop(1, '#3B1660');
    g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.76, h); g.lineTo(w * 0.84, 0); g.lineTo(w, 0); g.lineTo(w, h); g.closePath(); g.fill();
    g.restore();
    const lw = 1900, lh = lw / 5, lx = flip ? w * 0.42 : w * 0.06;
    if (logo) g.drawImage(logo, lx, h * 0.5 - lh * 0.62, lw, lh);
    g.fillStyle = '#5B5566'; g.font = '600 54px Poppins, Arial, sans-serif';
    g.fillText('TRANSPORT  ·  LOGISTIQUE  ·  RÉFRIGÉRÉ', lx + 20, h * 0.5 + lh * 0.62);
    g.fillStyle = '#ffffff'; g.font = '600 50px Poppins, Arial, sans-serif';
    g.textAlign = flip ? 'left' : 'right';
    g.fillText('hesmantransport.com', flip ? 90 : w - 90, h - 70);
  });
  const doors = canvasTex(1024, 1124, (g, w, h) => {
    g.fillStyle = '#EEEBF2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#D3CDDB'; g.fillRect(w / 2 - 5, 0, 10, h);
    g.fillStyle = '#A9A1B4'; [w * 0.24, w * 0.76].forEach(x => g.fillRect(x - 9, 60, 18, h - 120));
    if (logo) g.drawImage(logo, w * 0.2, h * 0.4, w * 0.6, w * 0.12);
    g.fillStyle = '#6B2F9B'; g.fillRect(0, h - 26, w, 26);
  });
  const sideR = new THREE.MeshPhysicalMaterial({ map: livery('left'), roughness: 0.3, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const sideL = new THREE.MeshPhysicalMaterial({ map: livery('right'), roughness: 0.3, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const rearMat = new THREE.MeshStandardMaterial({ map: doors, roughness: 0.4 });
  add(new THREE.BoxGeometry(TW, TH, TL), [sideR, sideL, paint, satin, rearMat, paint], 0, TB + TH / 2, TL / 2);
  // aristas redondeadas
  const edgeGeo = new THREE.CylinderGeometry(0.07, 0.07, TL, 12); edgeGeo.rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sy of [0, 1]) add(edgeGeo, paint, sx * TW / 2, TB + sy * TH, TL / 2);
  // firma de luz morada + faldones aerodinámicos + gálibos
  const strip = new THREE.BoxGeometry(0.02, 0.05, TL - 0.6);
  for (const sx of [-1, 1]) {
    add(strip, ledViolet, sx * (TW / 2 + 0.01), TB + 0.12, TL / 2);
    add(new THREE.BoxGeometry(0.04, 0.72, 8.6), black, sx * 1.18, 0.86, 7.2);
    for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.03, 0.06, 0.1), ledAmber, sx * (TW / 2 + 0.02), TB + TH - 0.12, 1 + i * 2.8);
  }
  add(new THREE.BoxGeometry(TW - 0.4, 0.3, TL - 1.2), satin, 0, TB - 0.12, TL / 2);
  add(new THREE.BoxGeometry(2.2, 0.06, 0.04), ledRed, 0, TB + 0.25, TL + 0.02);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.4, 0.12, 0.04), ledRed, sx * 0.95, TB - 0.05, TL + 0.02);
  // groupe frigorifique moderne (frente de la remorque)
  add(new THREE.BoxGeometry(2.1, 1.7, 0.42), new THREE.MeshPhysicalMaterial({ color: 0xe9e6ee, roughness: 0.35, metalness: 0.2, clearcoat: 0.6 }), 0, TB + TH - 1.0, -0.21);
  const reeferLed = add(new THREE.BoxGeometry(1.2, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0x6fb7ff }), 0, TB + TH - 0.35, -0.43);
  add(new THREE.BoxGeometry(1.6, 0.7, 0.02), black, 0, TB + TH - 1.15, -0.43);

  // ---------- ruedas ----------
  const wheels = [];
  const tireGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.34, 40); tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.36, 32); rimGeo.rotateZ(Math.PI / 2);
  const capGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.38, 20); capGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.37, 0.05, 0.58);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0a0d, roughness: 0.85 });
  const wheelAt = (x, z) => {
    const w = new THREE.Group(); w.position.set(x, 0.52, z);
    w.add(new THREE.Mesh(tireGeo, tireMat), new THREE.Mesh(rimGeo, alu), new THREE.Mesh(capGeo, violet));
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(spokeGeo, satin); s.rotation.x = k * Math.PI / 3; w.add(s); }
    truck.add(w); wheels.push(w);
  };
  for (const z of [12.9, 14.2]) for (const x of [-1.05, -0.7, 0.7, 1.05]) wheelAt(x, z);

  // ---------- tracteur aérodynamique (perfil extruido con bordes redondeados) ----------
  const CAB_BACK = -0.9, CW = 2.45;
  const U = (u) => CAB_BACK - u; // u = metros hacia adelante desde la parte trasera de la cabina
  const prof = new THREE.Shape();
  prof.moveTo(0, 1.0);
  prof.lineTo(0, 3.95);
  prof.quadraticCurveTo(0.05, 4.12, 0.4, 4.12);
  prof.lineTo(2.5, 4.12);
  prof.quadraticCurveTo(3.25, 4.1, 3.6, 3.72);                 // déflecteur de toit
  prof.lineTo(4.55, 2.72);                                      // pare-brise incliné
  prof.quadraticCurveTo(4.7, 2.58, 5.0, 2.5);
  prof.quadraticCurveTo(6.2, 2.32, 6.75, 2.08);                 // capot plongeant
  prof.quadraticCurveTo(7.05, 1.95, 7.05, 1.55);                // nez arrondi
  prof.lineTo(7.0, 0.82);
  prof.lineTo(6.32, 0.82);
  prof.absarc(5.62, 0.52, 0.7, 0.42, Math.PI - 0.42, false);    // passage de roue avant
  prof.lineTo(4.6, 0.82);
  prof.lineTo(0.4, 0.95);
  prof.lineTo(0, 1.0);
  const cabGeo = new THREE.ExtrudeGeometry(prof, { depth: CW, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 5, curveSegments: 24 });
  cabGeo.translate(0, 0, -CW / 2);
  cabGeo.rotateY(Math.PI / 2);          // x de la forma → -z del mundo
  cabGeo.computeVertexNormals();
  add(cabGeo, paint, 0, 0, CAB_BACK);

  // Vidrios: parabrisas siguiendo la pendiente + laterales
  {
    const a = [3.6, 3.72], b = [4.55, 2.72];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ny = (b[0] - a[0]) / len, nz = -(a[1] - b[1]) / len; // normal hacia adelante-arriba (y, -z)
    const ws = add(new THREE.PlaneGeometry(CW - 0.1, len * 0.94), glass, 0, (a[1] + b[1]) / 2 + ny * 0.13, U((a[0] + b[0]) / 2) + nz * 0.13);
    ws.rotation.x = Math.atan2(-ny, nz);
    const side = new THREE.Shape();
    side.moveTo(2.35, 2.75); side.lineTo(4.38, 2.75); side.lineTo(3.55, 3.66); side.lineTo(2.35, 3.66); side.lineTo(2.35, 2.75);
    const sg = new THREE.ShapeGeometry(side); sg.rotateY(Math.PI / 2);
    for (const sx of [-1, 1]) add(sg, glass, sx * (CW / 2 + 0.135), 0, CAB_BACK);
    // franja de marca bajo las ventanas + extensores de cabina + cámaras-retrovisor
    const band = new THREE.Shape();
    band.moveTo(0.3, 1.55); band.lineTo(6.6, 1.72); band.lineTo(6.6, 1.8); band.lineTo(0.3, 1.63);
    const bg = new THREE.ShapeGeometry(band); bg.rotateY(Math.PI / 2);
    for (const sx of [-1, 1]) {
      add(bg, violet, sx * (CW / 2 + 0.14), 0, CAB_BACK);
      add(new THREE.BoxGeometry(0.06, 2.5, 0.75), paint, sx * (CW / 2 + 0.02), 2.75, CAB_BACK + 0.3);
      add(new THREE.BoxGeometry(0.05, 0.5, 0.2), black, sx * (CW / 2 + 0.32), 3.15, U(4.2));
      add(new THREE.BoxGeometry(0.5, 0.05, 0.05), black, sx * (CW / 2 + 0.12), 3.15, U(4.2));
    }
  }
  // Calandre noire + faros LED en línea
  add(new THREE.BoxGeometry(1.6, 0.5, 0.06), black, 0, 1.12, U(7.19));
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(1.5, 0.025, 0.02), alu, 0, 0.98 + i * 0.14, U(7.23));
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.72, 0.3, 0.02), black, sx * 0.8, 1.53, U(7.245));
    add(new THREE.BoxGeometry(0.62, 0.05, 0.02), ledWhite, sx * 0.8, 1.62, U(7.265));
    add(new THREE.BoxGeometry(0.46, 0.1, 0.02), ledWhite, sx * 0.82, 1.48, U(7.265));
  }
  add(new THREE.BoxGeometry(2.3, 0.05, 0.04), ledViolet, 0, 0.88, U(7.27));
  // halo de los faros (sprites aditivos): da vida a los LED sin post-proceso
  const haloMat = new THREE.SpriteMaterial({ map: radial('rgba(255,248,235,.9)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const sx of [-1, 1]) { const h = new THREE.Sprite(haloMat); h.scale.set(1.3, 0.8, 1); h.position.set(sx * 0.82, 1.54, U(7.35)); truck.add(h); }
  // bas de caisse noir: bicolore moderne
  const skirt = new THREE.Shape();
  skirt.moveTo(0.25, 0.97); skirt.lineTo(4.55, 0.86); skirt.lineTo(4.55, 1.18); skirt.lineTo(0.25, 1.3);
  const skg = new THREE.ShapeGeometry(skirt); skg.rotateY(Math.PI / 2);
  const skMat = new THREE.MeshStandardMaterial({ color: 0x141118, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const sx of [-1, 1]) add(skg, skMat, sx * (CW / 2 + 0.14), 0, CAB_BACK);
  add(new THREE.BoxGeometry(2.55, 0.34, 0.32), black, 0, 0.68, U(7.1));
  // chasis + carenados laterales entre ejes
  add(new THREE.BoxGeometry(1.1, 0.3, 8.6), satin, 0, 0.9, -2.2);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.62, 3.0), paint, sx * 1.2, 0.98, U(2.9));
  wheelAt(-1.05, U(5.62)); wheelAt(1.05, U(5.62));
  for (const z of [0.55, 1.85]) for (const x of [-1.05, -0.7, 0.7, 1.05]) wheelAt(x, z);

  // Faros: conos de luz sobre el asfalto
  for (const sx of [-1, 1]) {
    const spot = new THREE.SpotLight(0xfff4e4, mobile ? 50 : 80, 42, 0.42, 0.65, 1.2);
    spot.position.set(sx * 0.86, 1.72, U(7.1)); spot.target.position.set(sx * 1.3, 0, -24);
    truck.add(spot, spot.target);
  }
  const beam = add(new THREE.PlaneGeometry(7.5, 24), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.03, -20);
  beam.rotation.x = -Math.PI / 2;
  // Sombra de contacto suave (sin shadow maps: bordes limpios, nada pixelado)
  const contact = add(new THREE.PlaneGeometry(5.2, 27), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 }), 0, 0.015, 4.5);
  contact.rotation.x = -Math.PI / 2;
  const glowUnder = add(new THREE.PlaneGeometry(4, 22), new THREE.MeshBasicMaterial({ map: radial('rgba(170,110,240,.28)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.02, 7);
  glowUnder.rotation.x = -Math.PI / 2;

  // ---------- cámara ----------
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const KEYS = [
    { pos: V(-8.2, 1.5, -16.5), look: V(3.4, 2.4, -2.2) },   // 3/4 avant, contre-plongée
    { pos: V(-52, 6.2, -17), look: V(8, 6, -6) },        // profil : livrée complète
    { pos: V(5.5, 7.5, 31), look: V(0, 2, 2) }               // arrière haut : le camion s'éloigne
  ];
  const MOBILE_KEYS = [
    { pos: V(-8.5, 2.2, -20), look: V(0.5, -2.2, -2.5) },
    { pos: V(-24, 5, -4), look: V(0, -3, 4) },
    { pos: V(5, 11, 36), look: V(0, -4.5, 4) }
  ];
  const cur = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  const ease = (t) => t * t * (3 - 2 * t);
  let keys = KEYS;

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    keys = camera.aspect < 0.9 ? MOBILE_KEYS : KEYS;
    camera.fov = camera.aspect < 0.9 ? 58 : camera.aspect < 1.3 ? 46 : 38;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  let mx = 0, my = 0;
  if (!mobile) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

  // ---------- bucle ----------
  let visible = true, smoothP = 0, introT = 0;
  const born = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  const clock = new THREE.Clock();
  const SPEED = 24;

  function tick() {
    requestAnimationFrame(tick);
    if (!visible || document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    introT = Math.min(1, (performance.now() - born) / 2600);

    const ie = 1 - Math.pow(1 - introT, 3);
    truck.position.z = -70 * (1 - ie);
    truck.position.y = Math.sin(t * 9) * 0.01;

    const move = SPEED * dt;
    for (const m of moving) { m.position.z += move; if (m.position.z > FRONT + LOOP) m.position.z -= LOOP; }
    for (const w of wheels) w.rotation.x -= move / 0.52;
    reeferLed.visible = Math.sin(t * 3) > -0.4;

    const target = window.__heroP || 0;
    smoothP += (target - smoothP) * Math.min(1, dt * 4);
    const seg = Math.min(keys.length - 2, Math.floor(smoothP * (keys.length - 1)));
    const lt = ease(smoothP * (keys.length - 1) - seg);
    tmpP.lerpVectors(keys[seg].pos, keys[seg + 1].pos, lt);
    tmpL.lerpVectors(keys[seg].look, keys[seg + 1].look, lt);
    tmpP.x += mx * 1.6 + Math.sin(t * 0.6) * 0.15;
    tmpP.y += -my * 0.8 + Math.sin(t * 0.9) * 0.05;
    cur.pos.lerp(tmpP, introT < 1 ? 1 : 0.12);
    cur.look.lerp(tmpL, introT < 1 ? 1 : 0.12);
    camera.position.copy(cur.pos);
    camera.lookAt(cur.look);

    renderer.render(scene, camera);
  }
  tick();
  requestAnimationFrame(() => hero.classList.add('is-3d'));
}
