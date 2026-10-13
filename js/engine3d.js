// "Sous le capot": motor diésel de 6 cilindros en línea, en rayos X, guiado por el scroll (window.__engineP, 0→1).
// Mecánica real simplificada: cigüeñal con codos a 0/120/240°, orden de encendido 1-5-3-6-2-4, ciclo de 4 tiempos.
// Pasos: 0 vista general · 1 admisión (turbo + aire) · 2 combustión · 3 potencia a las ruedas · 4 escape tratado · 5 seguridad.
const section = document.querySelector('[data-engine3d]');
const canvas = section?.querySelector('.engine__canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGL = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();

if (section && canvas && !reduced && hasGL) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    import('/hesman-preview/js/vendor/three.module.min.js').then(init).catch(err => console.warn('moteur 3D off:', err));
  }, { rootMargin: '900px 0px' });
  io.observe(section);
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function init(THREE) {
  const mobile = matchMedia('(max-width: 959px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 600);
  scene.add(new THREE.HemisphereLight(0xe8e2f2, 0x0a0810, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-6, 10, 8); scene.add(key);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene(); env.background = new THREE.Color(0x0b0910);
  const pl = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  pl(30, 5, 0, 20, 8, 2); pl(6, 20, -18, 2, 6, 1.2); pl(6, 20, 18, 2, -6, 1);
  scene.environment = pmrem.fromScene(env, 0.02).texture;

  // ---------- materiales ----------
  const VIOLET = 0xb48ae0;
  const shell = new THREE.MeshPhysicalMaterial({ color: 0x9a7cc4, transparent: true, opacity: 0.07, roughness: 0.2, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
  const edgeMat = new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.55 });
  const faint = new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.22 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xdcd8e4, metalness: 1, roughness: 0.25 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x8d879a, metalness: 1, roughness: 0.35 });
  const brand = new THREE.MeshStandardMaterial({ color: 0x8a45c8, metalness: 0.4, roughness: 0.3, emissive: 0x3a1360, emissiveIntensity: 0.6 });
  const glow = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();

  const engine = new THREE.Group(); scene.add(engine);
  const xray = (geo, x, y, z, parent = engine, lines = edgeMat) => {
    const m = new THREE.Mesh(geo, shell); m.position.set(x, y, z); parent.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), lines); e.position.copy(m.position); parent.add(e);
    return { m, e };
  };
  const solid = (geo, mat, x, y, z, parent = engine) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const alongX = (g) => { g.rotateZ(Math.PI / 2); return g; };

  // ---------- bloque, culata, cárter ----------
  xray(new THREE.BoxGeometry(9.4, 4.6, 2.9), 0, 1.15, 0);
  xray(new THREE.BoxGeometry(9.6, 1.1, 3.1), 0, 4.0, 0);
  xray(new THREE.BoxGeometry(9.0, 1.2, 2.4), 0, -1.75, 0);
  const CYL_X = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75];
  for (const x of CYL_X) xray(new THREE.CylinderGeometry(0.64, 0.64, 2.7, 28, 1, true), x, 2.25, 0, engine, faint);

  // ---------- cigüeñal, bielas, pistones ----------
  const R = 0.7, L = 2.3;
  const THROW = [0, 120, 240, 240, 120, 0].map(d => d * Math.PI / 180);
  const FIRE = [0, 480, 240, 600, 120, 360].map(d => d * Math.PI / 180); // orden 1-5-3-6-2-4 en un ciclo de 720°
  const crank = new THREE.Group(); engine.add(crank);
  solid(alongX(new THREE.CylinderGeometry(0.32, 0.32, 10.4, 20)), darkMetal, 0, 0, 0, crank);
  CYL_X.forEach((x, i) => {
    const a = THROW[i];
    for (const dx of [-0.42, 0.42]) { const w = solid(new THREE.BoxGeometry(0.16, R + 0.9, 1.0), darkMetal, x + dx, Math.cos(a) * R / 2, Math.sin(a) * R / 2, crank); w.rotation.x = a; }
    solid(alongX(new THREE.CylinderGeometry(0.24, 0.24, 0.9, 16)), metal, x, Math.cos(a) * R, Math.sin(a) * R, crank);
  });
  const fly = new THREE.Group(); fly.position.set(5.5, 0, 0); crank.add(fly);
  solid(alongX(new THREE.CylinderGeometry(1.7, 1.7, 0.32, 48)), darkMetal, 0, 0, 0, fly);
  solid(alongX(new THREE.TorusGeometry(1.72, 0.07, 8, 64)), brand, 0, 0, 0, fly).rotation.set(0, Math.PI / 2, 0);
  const pistons = [], rods = [], flashes = [], injectors = [], valves = [];
  const flashMat = (c) => new THREE.SpriteMaterial({ map: glow, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  CYL_X.forEach((x) => {
    const p = solid(new THREE.CylinderGeometry(0.6, 0.6, 0.85, 32), metal, x, 2.6, 0);
    for (const ry of [0.22, 0.05]) solid(new THREE.TorusGeometry(0.6, 0.025, 6, 32), darkMetal, 0, ry, 0, p).rotation.x = Math.PI / 2;
    pistons.push(p);
    rods.push(solid(new THREE.BoxGeometry(0.2, L, 0.3), metal, x, 1.3, 0));
    const f = new THREE.Sprite(flashMat(0xffa64d)); f.position.set(x, 3.6, 0); f.scale.setScalar(1.6); engine.add(f); flashes.push(f);
    const inj = new THREE.Sprite(flashMat(0xffc24a)); inj.position.set(x, 3.8, 0); inj.scale.setScalar(0.6); engine.add(inj); injectors.push(inj);
    solid(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8), darkMetal, x, 4.1, 0);
    valves.push([-0.32, 0.32].map(z => solid(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), metal, x, 3.95, z)));
  });
  const cam = new THREE.Group(); cam.position.set(0, 4.25, 0); engine.add(cam);
  solid(alongX(new THREE.CylinderGeometry(0.13, 0.13, 9.6, 10)), darkMetal, 0, 0, 0, cam);
  CYL_X.forEach((x, i) => { const lobe = solid(new THREE.BoxGeometry(0.22, 0.42, 0.22), metal, x, 0.12, 0, cam); lobe.rotation.x = FIRE[i] / 2; });

  // ---------- turbo, colectores, intercooler, postratamiento ----------
  const turbo = new THREE.Group(); turbo.position.set(-6.4, 2.7, 1.1); engine.add(turbo);
  for (const [dx, c] of [[-0.7, 0x6fb7ff], [0.7, 0xff7a3d]]) {
    xray(alongX(new THREE.TorusGeometry(0.75, 0.38, 12, 32)).rotateZ(-Math.PI / 2).rotateY(Math.PI / 2), dx, 0, 0, turbo);
    const wheel = new THREE.Group(); wheel.position.x = dx; turbo.add(wheel);
    for (let b = 0; b < 10; b++) { const bl = solid(new THREE.BoxGeometry(0.06, 0.62, 0.16), new THREE.MeshStandardMaterial({ color: c, metalness: 0.6, roughness: 0.3, emissive: c, emissiveIntensity: 0.35 }), 0, 0, 0, wheel); bl.rotation.x = b * Math.PI / 5; bl.position.set(0, Math.cos(b * Math.PI / 5) * 0.3, Math.sin(b * Math.PI / 5) * 0.3); }
    turbo.userData[dx < 0 ? 'comp' : 'turb'] = wheel;
  }
  solid(alongX(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 10)), metal, 0, 0, 0, turbo);
  xray(new THREE.BoxGeometry(0.6, 3.2, 3.6), -8.6, 1.0, 0);                                    // intercooler
  for (let i = 0; i < 8; i++) solid(new THREE.BoxGeometry(0.62, 0.03, 3.5), new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.25 }), -8.6, -0.4 + i * 0.4, 0);
  xray(alongX(new THREE.CylinderGeometry(0.34, 0.34, 9.4, 16, 1, true)), 0, 3.85, -1.75);       // colector de admisión
  xray(alongX(new THREE.CylinderGeometry(0.3, 0.3, 9.4, 16, 1, true)), 0, 3.5, 1.75);           // colector de escape
  xray(alongX(new THREE.CylinderGeometry(0.8, 0.8, 7.4, 28)), 0.2, -3.2, 2.3);                    // DPF + SCR
  for (let i = 0; i < 5; i++) solid(alongX(new THREE.TorusGeometry(0.8, 0.02, 4, 32)).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7ee2c8, transparent: true, opacity: 0.4 }), -2.8 + i * 1.5, -3.2, 2.3);
  xray(new THREE.BoxGeometry(2.6, 2.6, 2.4), 7.5, 0, 0);                                         // caja de cambios

  // ---------- línea de transmisión hasta las ruedas ----------
  const shaft = new THREE.Group(); shaft.position.set(8.8, 0, 0); engine.add(shaft);
  solid(alongX(new THREE.CylinderGeometry(0.22, 0.22, 12, 16)), metal, 6, 0, 0, shaft);
  for (const x of [0.3, 11.7]) solid(new THREE.SphereGeometry(0.34, 16, 12), darkMetal, x, 0, 0, shaft);
  const axle = new THREE.Group(); axle.position.set(21.2, 0, 0); engine.add(axle);
  xray(new THREE.SphereGeometry(1.0, 20, 14), 0, 0, 0, axle);
  solid(new THREE.CylinderGeometry(0.2, 0.2, 7, 12).rotateX(Math.PI / 2), darkMetal, 0, 0, 0, axle);
  const wheels = [];
  for (const z of [-3.6, 3.6]) {
    const w = new THREE.Group(); w.position.z = z; axle.add(w);
    solid(new THREE.TorusGeometry(2.4, 0.7, 14, 40), new THREE.MeshStandardMaterial({ color: 0x1b1821, roughness: 0.8 }), 0, 0, 0, w);
    solid(new THREE.CylinderGeometry(1.7, 1.7, 0.5, 32).rotateX(Math.PI / 2), metal, 0, 0, 0, w);
    for (let k = 0; k < 5; k++) { const s = solid(new THREE.BoxGeometry(0.25, 2.8, 0.55), darkMetal, 0, 0, 0, w); s.rotation.z = k * Math.PI / 5; }
    wheels.push(w);
  }

  // ---------- partículas: aire, escape, potencia, combustible ----------
  function flow(points, n, size, colorAt) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) seed[i] = Math.random();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ map: glow, size, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
    const pts = new THREE.Points(geo, mat); engine.add(pts);
    const c = new THREE.Color(), v = new THREE.Vector3();
    return {
      mat, base: size,
      update(time, speed) {
        for (let i = 0; i < n; i++) {
          const u = (seed[i] + time * speed) % 1;
          curve.getPointAt(u, v);
          const j = (seed[i] * 97) % 1 - 0.5;
          pos[i * 3] = v.x + j * 0.25; pos[i * 3 + 1] = v.y + ((seed[i] * 31) % 1 - 0.5) * 0.25; pos[i * 3 + 2] = v.z + ((seed[i] * 53) % 1 - 0.5) * 0.25;
          colorAt(u, c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
      }
    };
  }
  const AIR = new THREE.Color(0x6fb7ff), HOT = new THREE.Color(0xff7a3d), SOOT = new THREE.Color(0x8a6f66), CLEAN = new THREE.Color(0x7ee2c8), POWER = new THREE.Color(0xc89bff), FUEL = new THREE.Color(0xffc24a);
  const n = mobile ? 0.6 : 1;
  const air = flow([[-11, 4.6, -2.2], [-9.4, 4.0, -0.8], [-7.1, 2.7, 1.1], [-8.6, 0.6, 0.4], [-8.2, 3.4, -1.75], [-4.6, 3.85, -1.75], [4.6, 3.85, -1.75]], Math.round(170 * n), 0.42, (u, c) => c.copy(AIR));
  const exhaust = flow([[4.6, 3.5, 1.75], [-4.6, 3.5, 1.75], [-5.7, 2.7, 1.1], [-5.6, -0.6, 2.1], [-3.6, -3.2, 2.3], [3.9, -3.2, 2.3], [6.6, -3.2, 2.3], [11, -3.0, 2.3]], Math.round(190 * n), 0.42, (u, c) => {
    if (u < 0.42) c.copy(HOT).lerp(SOOT, u / 0.42 * 0.5);
    else if (u < 0.78) c.copy(SOOT).lerp(CLEAN, (u - 0.42) / 0.36);
    else c.copy(CLEAN);
  });
  const power = flow([[5.5, 0, 0], [8.8, 0, 0], [21.2, 0, 0], [21.2, 0, 3.6]], Math.round(90 * n), 0.5, (u, c) => c.copy(POWER));
  const fuel = flow([[-4.6, 4.55, 0.55], [4.6, 4.55, 0.55]], Math.round(50 * n), 0.3, (u, c) => c.copy(FUEL));
  xray(alongX(new THREE.CylinderGeometry(0.1, 0.1, 9.2, 8)), 0, 4.55, 0.55, engine, faint);

  // ---------- seguridad: camión completo en rayos X (escala real: 6 u = 1 m) ----------
  const truck = new THREE.Group(); scene.add(truck);
  const tLine = new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0 });
  const tBox = (w, h, d, x, y, z) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), tLine); e.position.set(x, y, z); truck.add(e); };
  const G = -5.5;                                         // suelo
  tBox(42, 18, 15, 9, G + 15.5, 0);                       // cabina
  tBox(18, 8, 14, -3, G + 7.5, 0);                        // capot
  tBox(96, 17, 15.6, 84, G + 16.4, 0);                    // remolque
  const wheelGeo = new THREE.EdgesGeometry(new THREE.CylinderGeometry(3.1, 3.1, 2, 20).rotateX(Math.PI / 2));
  const sensors = [];
  for (const x of [-3, 26, 33, 112, 119]) for (const z of [-6.5, 6.5]) {
    const w = new THREE.LineSegments(wheelGeo, tLine); w.position.set(x, G + 3.1, z); truck.add(w);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x5be38a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); s.position.set(x, G + 3.1, z * 1.2); s.scale.setScalar(4); truck.add(s); sensors.push(s);
  }
  const radar = new THREE.Mesh(new THREE.ConeGeometry(9, 34, 32, 1, true).rotateZ(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  radar.position.set(-29, G + 6, 0); truck.add(radar);
  const gps = [0, 1, 2].map(() => { const r = new THREE.Mesh(new THREE.TorusGeometry(4, 0.12, 6, 48).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6fb7ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); r.position.set(12, G + 30, 0); truck.add(r); return r; });

  // ---------- cámara por pasos ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const KEYS = [
    { pos: V(-10, 7, 14), look: V(0.5, 1.2, 0) },        // vista general
    { pos: V(-13, 6.5, 6.5), look: V(-6.6, 2.4, 0.6) },  // admisión
    { pos: V(-3.5, 6.8, 11.5), look: V(0, 2.4, 0) },      // combustión
    { pos: V(6, 7, 25), look: V(14, 0, 0) },             // potencia
    { pos: V(-5, -4.6, 14), look: V(1.5, -3.4, 2.3) },      // escape
    { pos: V(-95, 55, 120), look: V(52, 4, 0) }          // seguridad
  ];
  let fullW = 1, fullH = 1, portrait = false;
  function resize() {
    fullW = canvas.clientWidth; fullH = canvas.clientHeight; portrait = fullW / fullH < 1;
    renderer.setSize(fullW, fullH, false);
    camera.aspect = fullW / fullH; camera.fov = portrait ? 52 : 36;
    // desplaza el encuadre: a la derecha del texto (escritorio) o arriba del texto (celular)
    if (portrait) camera.setViewOffset(fullW, fullH, 0, fullH * 0.2, fullW, fullH);
    else camera.setViewOffset(fullW, fullH, -fullW * 0.2, 0, fullW, fullH);
    camera.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  let visible = true, smoothP = 0, theta = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(section);
  const clock = new THREE.Clock();
  const cp = new THREE.Vector3(), cl = new THREE.Vector3(), cur = { p: null, l: null };
  const ease = (t) => t * t * (3 - 2 * t);

  function tick() {
    requestAnimationFrame(tick);
    if (!visible || document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    smoothP += ((window.__engineP || 0) - smoothP) * Math.min(1, dt * 4);
    const sp = smoothP * (KEYS.length - 1);
    const step = Math.round(sp);

    // motor
    theta += dt * 5.5;
    crank.rotation.x = theta;
    cam.rotation.x = theta / 2;
    CYL_X.forEach((x, i) => {
      const a = theta + THROW[i];
      const py = R * Math.cos(a) + Math.sqrt(L * L - R * R * Math.sin(a) ** 2);
      const cy = R * Math.cos(a), cz = R * Math.sin(a);
      pistons[i].position.y = py;
      const rod = rods[i];
      rod.position.set(x, (py + cy) / 2, cz / 2);
      rod.rotation.x = Math.atan2(-cz, py - cy);
      const cyc = (((theta - FIRE[i]) % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI); // 0 = PMH en compresión
      const boost = step === 2 ? 1.6 : 1;
      flashes[i].material.opacity = cyc < 1.2 ? (1 - cyc / 1.2) * boost * 0.95 : 0;
      flashes[i].scale.setScalar((1.2 + (cyc < 1.2 ? (1 - cyc / 1.2) : 0) * 1.6) * (step === 2 ? 1.3 : 1));
      injectors[i].material.opacity = cyc > 4 * Math.PI - 0.35 || cyc < 0.1 ? 1 : 0;
      const ex = cyc > Math.PI && cyc < 2 * Math.PI ? Math.sin(cyc - Math.PI) : 0;
      const ad = cyc > 2 * Math.PI && cyc < 3 * Math.PI ? Math.sin(cyc - 2 * Math.PI) : 0;
      valves[i][0].position.y = 3.95 - ad * 0.22;
      valves[i][1].position.y = 3.95 - ex * 0.22;
    });
    turbo.userData.comp.rotation.x += dt * 40; turbo.userData.turb.rotation.x += dt * 40;
    shaft.rotation.x = theta * 0.6;
    wheels.forEach(w => { w.rotation.z = -theta * 0.18; });

    // flujos, con énfasis según el paso
    air.mat.size = air.base * (step === 1 ? 1.7 : 1);
    exhaust.mat.size = exhaust.base * (step === 4 ? 1.7 : 1);
    power.mat.opacity = smooth(2.4, 3, sp) * (1 - smooth(4.6, 5, sp));
    fuel.mat.size = fuel.base * (step === 2 ? 1.8 : 1);
    air.update(t, 0.12); exhaust.update(t, 0.1); power.update(t, 0.35); fuel.update(t, 0.2);
    brand.emissiveIntensity = 0.6 + Math.sin(t * 3) * 0.2;

    // seguridad
    const safe = smooth(4.3, 5, sp);
    tLine.opacity = safe * 0.6;
    edgeMat.opacity = 0.55 * (1 - safe * 0.3);
    sensors.forEach((s, k) => { s.material.opacity = safe * (0.55 + 0.45 * Math.sin(t * 4 + k)); });
    radar.material.opacity = safe * (0.1 + 0.08 * Math.sin(t * 3));
    radar.scale.set(0.9 + 0.1 * Math.sin(t * 3), 1, 1);
    gps.forEach((r, k) => { const ph = (t * 0.6 + k / 3) % 1; r.scale.setScalar(0.4 + ph * 2.4); r.material.opacity = safe * (1 - ph) * 0.8; });

    // cámara
    const seg = Math.min(KEYS.length - 2, Math.floor(sp));
    const lt = ease(clamp(sp - seg));
    cp.lerpVectors(KEYS[seg].pos, KEYS[seg + 1].pos, lt);
    cl.lerpVectors(KEYS[seg].look, KEYS[seg + 1].look, lt);
    if (portrait) cp.sub(cl).multiplyScalar(1.25).add(cl);
    cp.x += Math.sin(t * 0.35) * 0.4; cp.y += Math.cos(t * 0.3) * 0.25;
    if (!cur.p) { cur.p = cp.clone(); cur.l = cl.clone(); }
    cur.p.lerp(cp, 0.1); cur.l.lerp(cl, 0.1);
    camera.position.copy(cur.p); camera.lookAt(cur.l);

    renderer.render(scene, camera);
  }
  tick();
  requestAnimationFrame(() => section.classList.add('is-3d'));
}
