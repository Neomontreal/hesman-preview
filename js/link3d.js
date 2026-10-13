// "Le lien": el logo oficial de Hesman se arma en 3D al hacer scroll (window.__linkP, 0→1).
//   0.00–0.34  los dos corchetes del símbolo llegan desde lados opuestos (como dos remolques que se acoplan)
//   0.30–0.38  acople: destello, anillo de luz y chispas
//   0.40–0.75  las letras HESMAN se levantan una por una
//   0.72–1.00  barrido de luz y la cámara se aleja para mostrar el logo completo
// El logo se extruye del SVG original (sin redibujar). Sin WebGL o con movimiento reducido queda el SVG estático.
const section = document.querySelector('[data-link3d]');
const canvas = section?.querySelector('.link3d__canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGL = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();

if (section && canvas && !reduced && hasGL) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    Promise.all([import('/hesman-preview/js/vendor/three.module.min.js'), import('/hesman-preview/js/vendor/SVGLoader.js'), fetch('/hesman-preview/assets/logo/Hesman-Logo_white.svg').then(r => r.text())])
      .then(([THREE, { SVGLoader }, svg]) => init(THREE, SVGLoader, svg))
      .catch(err => console.warn('logo 3D off:', err));
  }, { rootMargin: '800px 0px' });
  io.observe(section);
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const outBack = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

function init(THREE, SVGLoader, svgText) {
  const mobile = matchMedia('(max-width: 899px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

  // Entorno de estudio para reflejos (softboxes)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x0b0910);
  const box = (w, h, x, y, z, c, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  box(30, 6, 0, 18, 10, 0xffffff, 2.2); box(8, 26, -20, 0, 6, 0xd9c4ff, 1.4); box(8, 26, 20, 2, 4, 0xffffff, 1.2); box(40, 4, 0, -14, 8, 0x6b2f9b, 1.2);
  scene.environment = pmrem.fromScene(env, 0.02).texture;
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-3, 6, 10); scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const rim = new THREE.PointLight(0xb48ae0, 60, 30); rim.position.set(0, 0, -6); scene.add(rim);

  // ---------- extruir el SVG oficial ----------
  const data = new SVGLoader().parse(svgText);
  const S = 0.06;                                      // unidades por px del SVG (logo ≈ 15 de ancho)
  const CX = 125, CY = 25;
  const violetMat = new THREE.MeshPhysicalMaterial({ color: 0x8a45c8, metalness: 0.2, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, emissive: 0x4a1a78, emissiveIntensity: 0.5 });
  const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.05, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const pieces = [], letterGeos = [];
  for (const path of data.paths) {
    const fill = (path.userData.style.fill || '').toUpperCase();
    const purple = fill.includes('602A8B');
    for (const shape of SVGLoader.createShapes(path)) {
      const g = new THREE.ExtrudeGeometry(shape, { depth: purple ? 9 : 6, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.55, bevelSegments: 4, curveSegments: 12 });
      g.computeBoundingBox();
      const bb = g.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
      g.translate(-cx, -cy, -(purple ? 4.5 : 3));      // cada pieza gira sobre su propio centro
      (purple ? pieces : letterGeos).push({ g, cx, cy });
    }
  }
  const logo = new THREE.Group(); logo.scale.set(S, -S, S); scene.add(logo); // y del SVG hacia abajo → invertir
  const place = (o) => new THREE.Vector3(o.cx - CX, o.cy - CY, 0);

  // Símbolo: dos corchetes (arriba ⊔, abajo ⊓)
  pieces.sort((a, b) => a.cy - b.cy);
  const sym = pieces.map((p, i) => {
    const m = new THREE.Mesh(p.g, violetMat); const home = place(p);
    m.userData = { home, from: new THREE.Vector3(i === 0 ? -150 : 150, i === 0 ? -70 : 70, -60), rot: i === 0 ? 1 : -1 };
    logo.add(m); return m;
  });
  // Letras: agrupar las formas blancas por letra según su x
  const ranges = [[60, 94], [95, 121], [121, 149], [149, 183], [183, 217], [217, 250]];
  const letters = ranges.map(([a, b]) => {
    const g = new THREE.Group();
    const parts = letterGeos.filter(o => o.cx >= a && o.cx < b);
    const lx = parts.reduce((s, o) => s + o.cx, 0) / Math.max(1, parts.length);
    g.userData.home = new THREE.Vector3(lx - CX, 0, 0);
    for (const o of parts) { const m = new THREE.Mesh(o.g, whiteMat); m.position.set(o.cx - lx, o.cy - CY, 0); g.add(m); }
    logo.add(g); return g;
  });

  // ---------- efectos del acople ----------
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(200,150,255,.6)'); gr.addColorStop(1, 'rgba(120,60,200,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const symCenter = new THREE.Vector3(((3.8 + 47.5) / 2 - CX) * S, 0, 0.4);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  flash.position.copy(symCenter); scene.add(flash);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), new THREE.MeshBasicMaterial({ color: 0xc89bff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.position.copy(symCenter); scene.add(ring);
  const N = mobile ? 70 : 140;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(N * 3), sparkVel = [];
  for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, z = (Math.random() - 0.5) * 0.6; sparkVel.push(new THREE.Vector3(Math.cos(a), Math.sin(a), z).multiplyScalar(1.5 + Math.random() * 3.5)); }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xe6d2ff, opacity: 0 }));
  scene.add(sparks);
  // Barrido de luz (franja aditiva que cruza el logo)
  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), new THREE.MeshBasicMaterial({
    map: (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 8; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 8); return new THREE.CanvasTexture(c); })(),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0
  }));
  sweep.rotation.z = -0.35; sweep.position.z = 1.2; scene.add(sweep);

  // ---------- cámara ----------
  let aspect = 1;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); aspect = w / h; camera.aspect = aspect; camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  let visible = true, smoothP = 0, lastP = 0, burstT = -1;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(section);
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();

  function tick() {
    requestAnimationFrame(tick);
    if (!visible || document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    smoothP += ((window.__linkP || 0) - smoothP) * Math.min(1, dt * 5);
    const p = smoothP;

    // 1) los corchetes llegan y se acoplan
    const arrive = smooth(0.02, 0.34, p);
    sym.forEach((m) => {
      const { home, from, rot } = m.userData;
      tmp.lerpVectors(from, home, outBack(arrive));
      m.position.copy(tmp);
      m.rotation.set(rot * (1 - arrive) * 1.6, rot * (1 - arrive) * -2.4, rot * (1 - arrive) * 0.9);
    });
    // destello al cruzar el umbral del acople (también al volver a pasar)
    if (lastP < 0.335 && p >= 0.335) burstT = 0;   // destello cada vez que el acople ocurre bajando
    lastP = p;
    if (burstT >= 0) {
      burstT += dt;
      const b = clamp(burstT / 1.1);
      flash.material.opacity = (1 - b) * 0.95; flash.scale.setScalar(2 + b * 6);
      ring.material.opacity = (1 - b) * 0.8; ring.scale.setScalar(0.6 + b * 7);
      sparks.material.opacity = 1 - b;
      for (let i = 0; i < N; i++) { const v = sparkVel[i], d = 1 - Math.pow(1 - b, 3); sparkPos[i * 3] = symCenter.x + v.x * d; sparkPos[i * 3 + 1] = symCenter.y + v.y * d - b * b * 0.8; sparkPos[i * 3 + 2] = symCenter.z + v.z * d; }
      sparkGeo.attributes.position.needsUpdate = true;
      if (b >= 1) burstT = -1;
    }
    violetMat.emissiveIntensity = 0.5 + (burstT >= 0 ? (1 - clamp(burstT / 0.8)) * 2.2 : 0) + Math.sin(t * 2) * 0.05;

    // 2) las letras se levantan una por una
    letters.forEach((g, i) => {
      const k = outBack(smooth(0.4 + i * 0.05, 0.52 + i * 0.05, p));
      const h = g.userData.home;
      g.position.set(h.x + (1 - k) * 18, h.y + (1 - k) * 60, h.z + (1 - k) * -40);
      g.rotation.x = (1 - k) * -1.6;
      g.scale.setScalar(Math.max(0.001, k));
    });

    // 3) barrido de luz
    const sw = smooth(0.74, 0.96, p);
    sweep.material.opacity = sw > 0 && sw < 1 ? Math.sin(sw * Math.PI) * 0.6 : 0;
    sweep.position.x = -9 + sw * 18;

    // cámara: empieza cerca del símbolo y se aleja hasta encuadrar todo el logo
    const pull = smooth(0.3, 0.85, p);
    // distancia para que el logo (≈15 u de ancho) ocupe ~78 % del ancho visible (fov 30°)
    const fit = Math.max(30, 15 / (0.78 * 2 * Math.tan(Math.PI / 12) * aspect));
    const near = new THREE.Vector3(symCenter.x, 0, aspect < 0.9 ? 22 : 14);
    const far = new THREE.Vector3(0, 0, fit);
    camera.position.lerpVectors(near, far, pull);
    camera.position.x += Math.sin(t * 0.4) * 0.25; camera.position.y += Math.cos(t * 0.5) * 0.12;
    // mirar por debajo del logo: queda en el tercio superior, encima del texto
    camera.lookAt(camera.position.x * 0.92, -camera.position.z * (aspect < 0.9 ? 0.11 : 0.06), 0);
    logo.rotation.y = Math.sin(t * 0.5) * 0.06 * pull; logo.rotation.x = Math.cos(t * 0.4) * 0.04;

    renderer.render(scene, camera);
  }
  tick();
  requestAnimationFrame(() => section.classList.add('is-3d'));
}
