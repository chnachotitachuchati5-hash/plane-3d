/**
 * Procedural twin-engine passenger jet built from Three.js primitives.
 * No external model files.
 */

export function createPlane(THREE) {
  const root = new THREE.Group();
  const group = new THREE.Group();
  root.add(group);

  const parts = [];
  const fans = [];
  const strobeMats = [];
  const navLights = [];
  const landingLights = [];
  const cabinGlow = [];
  const heatMats = [];

  const colors = {
    white: 0xf3f5f8,
    metal: 0xdfe5ec,
    metalDark: 0x8a919a,
    navy: 0x0b1f3a,
    navyDeep: 0x071018,
    gold: 0xc9a24a,
    goldBright: 0xf0d4a0,
    glass: 0x0d2436,
    rubber: 0x1a1a1c,
    titanium: 0xb7bec7,
    intake: 0x14161a,
    heat: 0x3a2218,
  };

  function phys(opts) {
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.6,
      roughness: 0.3,
      envMapIntensity: 1.15,
      ...opts,
    });
  }

  const mat = {
    skin: () =>
      phys({
        color: colors.white,
        metalness: 0.38,
        roughness: 0.28,
        clearcoat: 0.55,
        clearcoatRoughness: 0.22,
      }),
    metal: () => phys({ color: colors.metal, metalness: 0.72, roughness: 0.32, clearcoat: 0.25 }),
    metalDark: () => phys({ color: colors.metalDark, metalness: 0.85, roughness: 0.28 }),
    navy: () => phys({ color: colors.navy, metalness: 0.35, roughness: 0.4, clearcoat: 0.3 }),
    gold: () => phys({ color: colors.gold, metalness: 0.9, roughness: 0.22, clearcoat: 0.4 }),
    glass: () =>
      phys({
        color: 0x17344a,
        metalness: 0.12,
        roughness: 0.06,
        transparent: true,
        opacity: 0.46,
        envMapIntensity: 1.5,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        depthWrite: false,
      }),
    window: () =>
      phys({
        color: 0x081520,
        metalness: 0.2,
        roughness: 0.08,
        transparent: true,
        opacity: 0.82,
        envMapIntensity: 1.2,
        clearcoat: 0.8,
        clearcoatRoughness: 0.06,
        emissive: new THREE.Color(0x7ec8ff),
        emissiveIntensity: 0.18,
      }),
    titanium: () => phys({ color: colors.titanium, metalness: 0.95, roughness: 0.18 }),
    intake: () => phys({ color: colors.intake, metalness: 0.4, roughness: 0.55 }),
    rubber: () => phys({ color: colors.rubber, metalness: 0.05, roughness: 0.85 }),
    heat: () =>
      phys({
        color: colors.heat,
        metalness: 0.2,
        roughness: 0.55,
        emissive: new THREE.Color(0xff6a2a),
        emissiveIntensity: 0.18,
      }),
    light: (hex, intensity = 2.2) =>
      new THREE.MeshStandardMaterial({
        color: hex,
        emissive: new THREE.Color(hex),
        emissiveIntensity: intensity,
        roughness: 0.3,
        metalness: 0.1,
      }),
    black: () => phys({ color: 0x111111, metalness: 0.4, roughness: 0.4 }),
  };

  function addPart(id, nameTh, nameEn, fact, object) {
    object.name = id;
    object.userData.partId = id;
    object.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.partId = id;
      }
    });
    group.add(object);
    const rec = { id, nameTh, nameEn, fact, object };
    parts.push(rec);
    return rec;
  }

  function nacaThickness(x, thick) {
    const t = Math.max(0, Math.min(1, x));
    return (
      5 *
      thick *
      (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4)
    );
  }

  function makeAirfoilWing({
    span,
    rootChord,
    tipChord,
    leSweep,
    rootThick,
    tipThick,
    segsSpan = 12,
    segsChord = 10,
    twist = 0,
    dir = 1,
  }) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const side = dir < 0 ? -1 : 1;

    function station(s) {
      const x = s * span * side;
      const chord = rootChord + (tipChord - rootChord) * s;
      const thick = rootThick + (tipThick - rootThick) * s;
      const le = -leSweep * s;
      const twistA = twist * s;
      return { x, chord, thick, le, twistA };
    }

    const rows = segsSpan + 1;
    const cols = segsChord + 1;
    // Top surface then bottom surface, each rows*cols verts
    for (let surf = 0; surf < 2; surf++) {
      const sign = surf === 0 ? 1 : -1;
      for (let i = 0; i < rows; i++) {
        const st = station(i / segsSpan);
        for (let j = 0; j < cols; j++) {
          const c = j / segsChord;
          const z = st.le - c * st.chord;
          let y = sign * nacaThickness(c, st.thick);
          if (st.twistA) {
            const xc = st.le - 0.25 * st.chord;
            const dz = z - xc;
            const ca = Math.cos(st.twistA);
            const sa = Math.sin(st.twistA);
            const z2 = xc + dz * ca - y * sa;
            const y2 = dz * sa + y * ca;
            positions.push(st.x, y2, z2);
          } else {
            positions.push(st.x, y, z);
          }
          uvs.push(c, i / segsSpan);
        }
      }
    }

    function addSurf(offset, flip) {
      for (let i = 0; i < segsSpan; i++) {
        for (let j = 0; j < segsChord; j++) {
          const a = offset + i * cols + j;
          const b = a + 1;
          const c = a + cols;
          const d = c + 1;
          if (!flip) {
            indices.push(a, c, b, b, c, d);
          } else {
            indices.push(a, b, c, b, d, c);
          }
        }
      }
    }
    const topOff = 0;
    const botOff = rows * cols;
    addSurf(topOff, side < 0);
    addSurf(botOff, side >= 0);

    // Cap root (x=0) and tip (x=span), and leading/trailing are already sharp-ish
    function cap(i, flip) {
      // i is span index 0 or segsSpan
      for (let j = 0; j < segsChord; j++) {
        const t0 = topOff + i * cols + j;
        const t1 = t0 + 1;
        const b0 = botOff + i * cols + j;
        const b1 = b0 + 1;
        if (!flip) indices.push(t0, b0, t1, t1, b0, b1);
        else indices.push(t0, t1, b0, t1, b1, b0);
      }
    }
    cap(0, side >= 0);
    cap(segsSpan, side < 0);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  function makeWingTexture() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#e6ebf1";
    ctx.fillRect(0, 0, 1024, 512);
    // leading-edge shield (u ~ 0)
    const lg = ctx.createLinearGradient(0, 0, 140, 0);
    lg.addColorStop(0, "#9aa3ad");
    lg.addColorStop(1, "#e6ebf1");
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, 140, 512);
    // flap band
    ctx.fillStyle = "#d5dbe3";
    ctx.fillRect(760, 0, 264, 512);
    ctx.strokeStyle = "rgba(20,30,40,0.18)";
    ctx.lineWidth = 2;
    // panel lines
    for (let i = 1; i < 10; i++) {
      const x = (i / 10) * 1024;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let i = 1; i < 6; i++) {
      const y = (i / 6) * 512;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(20,30,40,0.28)";
    ctx.beginPath();
    ctx.moveTo(760, 0);
    ctx.lineTo(760, 512);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  function makeFuselageTexture() {
    const w = 2048;
    const h = 1024;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");

    // v is along body: 0 tail → 1 nose, drawn bottom → top so we flipY or fill accordingly.
    // Canvas y=0 is top; we'll set texture.flipY = true (default) and treat v=0 as bottom of canvas
    // so we fill from y=h (tail) to y=0 (nose)? Default flipY means uv v=0 is bottom of image.
    // So y = (1-v)*h in usual (flipY true): v=0 → y=h (bottom). We'll paint with y = (1-v)*h.

    function yv(v) {
      return (1 - v) * h;
    }

    // Upper white
    ctx.fillStyle = "#f4f6f8";
    ctx.fillRect(0, 0, w, h);

    // Belly navy — u=0 and u=1 are belly, u=0.5 is top
    // u is x / w
    function fillBelly() {
      const mid = 0.17;
      ctx.fillStyle = "#0b1f3a";
      ctx.fillRect(0, 0, mid * w, h);
      ctx.fillRect((1 - mid) * w, 0, mid * w, h);
      // fade into white
      const fade = 0.05 * w;
      let g = ctx.createLinearGradient(mid * w, 0, mid * w + fade, 0);
      g.addColorStop(0, "#0b1f3a");
      g.addColorStop(1, "rgba(244,246,248,0)");
      ctx.fillStyle = g;
      ctx.fillRect(mid * w, 0, fade, h);
      g = ctx.createLinearGradient((1 - mid) * w, 0, (1 - mid) * w - fade, 0);
      g.addColorStop(0, "#0b1f3a");
      g.addColorStop(1, "rgba(244,246,248,0)");
      ctx.fillStyle = g;
      ctx.fillRect((1 - mid) * w - fade, 0, fade, h);
    }
    fillBelly();

    // Gold pinstripe along the navy/white join
    ctx.fillStyle = "#c9a24a";
    const stripeU = 0.185;
    const sw = 0.01 * w;
    ctx.fillRect(stripeU * w, 0, sw, h);
    ctx.fillRect((1 - stripeU) * w - sw, 0, sw, h);

    // Thin navy cheatline above the gold
    ctx.fillStyle = "#0b1f3a";
    ctx.fillRect(stripeU * w + sw, yv(0.82), 0.007 * w, yv(0.22) - yv(0.82));
    ctx.fillRect((1 - stripeU) * w - sw - 0.007 * w, yv(0.82), 0.007 * w, yv(0.22) - yv(0.82));

    // Fade the navy belly before the radome so the nose stays smooth
    const fadeV0 = 0.86;
    const fadeV1 = 0.93;
    const rg = ctx.createLinearGradient(0, yv(fadeV0), 0, yv(fadeV1));
    rg.addColorStop(0, "rgba(244,246,248,0)");
    rg.addColorStop(1, "#e8edf2");
    ctx.fillStyle = rg;
    ctx.fillRect(0, yv(fadeV1), w, yv(fadeV0) - yv(fadeV1));
    ctx.fillStyle = "#e8edf2";
    ctx.fillRect(0, yv(1), w, yv(fadeV1) - yv(1));

    // Nose radome slightly darker
    const ng = ctx.createLinearGradient(0, yv(0.93), 0, yv(1));
    ng.addColorStop(0, "rgba(180,190,200,0)");
    ng.addColorStop(1, "rgba(150,160,170,0.55)");
    ctx.fillStyle = ng;
    ctx.fillRect(0, yv(1), w, yv(0.93) - yv(1));

    // Passenger windows painted as backup (3D windows sit on top)
    function paintWindows(uCenter) {
      const v0 = 0.30;
      const v1 = 0.78;
      const n = 22;
      for (let i = 0; i < n; i++) {
        const v = v0 + ((v1 - v0) * (i + 0.5)) / n;
        const x = uCenter * w;
        const y = yv(v);
        const rw = 0.018 * w;
        const rh = 0.012 * h;
        ctx.fillStyle = "#0a1824";
        roundRect(ctx, x - rw, y - rh, rw * 2, rh * 2, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(200,210,220,0.55)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    function roundRect(ctx, x, y, rw, rh, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + rw - r, y);
      ctx.quadraticCurveTo(x + rw, y, x + rw, y + r);
      ctx.lineTo(x + rw, y + rh - r);
      ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
      ctx.lineTo(x + r, y + rh);
      ctx.quadraticCurveTo(x, y + rh, x, y + rh - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
    paintWindows(0.30);
    paintWindows(0.70);

    // Doors
    function door(u, v, tw, th) {
      const x = u * w;
      const y = yv(v);
      ctx.strokeStyle = "rgba(20,30,45,0.45)";
      ctx.lineWidth = 2;
      roundRect(ctx, x - (tw * w) / 2, y - (th * h) / 2, tw * w, th * h, 4);
      ctx.stroke();
    }
    door(0.30, 0.81, 0.04, 0.035);
    door(0.70, 0.81, 0.04, 0.035);
    door(0.30, 0.27, 0.04, 0.035);
    door(0.70, 0.27, 0.04, 0.035);

    // Cockpit windshields (upper nose, u=0.5 is the crown)
    function windshield(u0, u1, v0, v1) {
      const x0 = u0 * w, x1 = u1 * w;
      const ya = yv(v0), yb = yv(v1);
      const yy = Math.min(ya, yb);
      const hh = Math.abs(yb - ya);
      ctx.fillStyle = "#0a1824";
      ctx.strokeStyle = "rgba(30,40,50,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      // slight trapezoid
      const inset = (x1 - x0) * 0.08;
      ctx.moveTo(x0 + inset, yy);
      ctx.lineTo(x1 - inset, yy);
      ctx.lineTo(x1, yy + hh);
      ctx.lineTo(x0, yy + hh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(180,200,215,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // two front panes (near the crown, farther forward) and two side panes
    windshield(0.44, 0.495, 0.905, 0.955);
    windshield(0.505, 0.56, 0.905, 0.955);
    windshield(0.36, 0.43, 0.88, 0.93);
    windshield(0.57, 0.64, 0.88, 0.93);

    // Registration HS-NOY on rear sides
    ctx.font = "bold 52px Kanit, sans-serif";
    ctx.fillStyle = "#0b1f3a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Right side: facing it, nose is on the left → text reads nose-to-tail.
    ctx.save();
    ctx.translate(0.28 * w, yv(0.225));
    ctx.rotate(Math.PI / 2);
    ctx.fillText("HS-NOY", 0, 0);
    ctx.restore();
    // Left side: facing it, tail is on the left → text reads tail-to-nose.
    ctx.save();
    ctx.translate(0.72 * w, yv(0.225));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("HS-NOY", 0, 0);
    ctx.restore();

    // Fine panel lines
    ctx.strokeStyle = "rgba(20,30,40,0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 16; i++) {
      const v = i / 16;
      ctx.beginPath();
      ctx.moveTo(0, yv(v));
      ctx.lineTo(w, yv(v));
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  function makeTailTexture() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0b1f3a";
    ctx.fillRect(0, 0, 512, 512);
    // gold bar
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(0, 430, 512, 18);
    ctx.fillRect(0, 64, 512, 8);
    // monogram N
    ctx.fillStyle = "#f0d4a0";
    ctx.font = "bold 220px Kanit, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", 256, 250);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  function makeDashTexture() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#1a1e24";
    ctx.fillRect(0, 0, 1024, 256);
    const screens = [
      [80, 36, 280, 180, "#0a2a20"],
      [390, 36, 240, 180, "#0a1a2a"],
      [660, 36, 280, 180, "#0a2a20"],
    ];
    for (const [x, y, w, h, col] of screens) {
      ctx.fillStyle = "#0a0c10";
      ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, col);
      g.addColorStop(1, "#041014");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(80, 180, 140, 0.45)";
      ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
      ctx.fillStyle = "rgba(120, 220, 180, 0.7)";
      ctx.font = "12px sans-serif";
      ctx.fillText("PFD", x + 16, y + 28);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const fuselageTex = makeFuselageTexture();
  const wingTex = makeWingTexture();
  const tailTex = makeTailTexture();

  // ---------- Fuselage ----------
  const fuse = new THREE.Group();

  const profile = [
    [0.02, -8.35],
    [0.16, -8.12],
    [0.42, -7.7],
    [0.7, -7.15],
    [0.95, -6.4],
    [1.12, -5.45],
    [1.22, -4.4],
    [1.27, -3.2],
    [1.29, -1.6],
    [1.30, 0.0],
    [1.30, 1.8],
    [1.29, 3.4],
    [1.26, 4.7],
    [1.18, 5.55],
    [1.05, 6.15],
    [0.92, 6.48],
    [0.80, 6.72],
    [0.66, 6.95],
    [0.52, 7.15],
    [0.38, 7.32],
    [0.24, 7.48],
    [0.12, 7.60],
    [0.04, 7.70],
    [0.02, 7.76],
  ];
  // Resample at equal y so texture V matches body station.
  const profileEven = [];
  {
    const n = 40;
    const y0 = profile[0][1];
    const y1 = profile[profile.length - 1][1];
    for (let i = 0; i < n; i++) {
      const y = y0 + ((y1 - y0) * i) / (n - 1);
      let r = profile[0][0];
      for (let k = 0; k < profile.length - 1; k++) {
        const a = profile[k];
        const b = profile[k + 1];
        if (y >= a[1] && y <= b[1]) {
          const t = (y - a[1]) / (b[1] - a[1] || 1);
          r = a[0] + (b[0] - a[0]) * t;
          break;
        }
      }
      profileEven.push([r, y]);
    }
  }
  const fusePts = profileEven.map(([r, y]) => new THREE.Vector2(r, y));
  const fuseGeo = new THREE.LatheGeometry(fusePts, 64);
  const fuseMat = phys({
    color: 0xffffff,
    map: fuselageTex,
    metalness: 0.38,
    roughness: 0.28,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.2,
  });
  const fuseMesh = new THREE.Mesh(fuseGeo, fuseMat);
  fuseMesh.rotation.x = Math.PI / 2; // nose (+Y) → +Z
  fuse.add(fuseMesh);

  // Belly fairing at wing root
  const fairing = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 24, 16),
    phys({ color: colors.navy, metalness: 0.4, roughness: 0.38, clearcoat: 0.2 })
  );
  fairing.scale.set(2.6, 0.55, 1.15);
  fairing.position.set(0, -0.85, 0.15);
  fuse.add(fairing);

  // 3D cabin windows
  const winMat = mat.window();
  cabinGlow.push(winMat);
  const winGeo = new THREE.BoxGeometry(0.05, 0.16, 0.22);
  const v0 = 0.30;
  const v1 = 0.78;
  const nWin = 22;
  const yMin = profile[0][1];
  const yMax = profile[profile.length - 1][1];
  function radiusAt(y) {
    for (let i = 0; i < profile.length - 1; i++) {
      const y0 = profile[i][1];
      const y1 = profile[i + 1][1];
      if ((y >= y0 && y <= y1) || (y >= y1 && y <= y0)) {
        const t = (y - y0) / (y1 - y0);
        return profile[i][0] + (profile[i + 1][0] - profile[i][0]) * t;
      }
    }
    return 1.28;
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < nWin; i++) {
      const v = v0 + ((v1 - v0) * (i + 0.5)) / nWin;
      const z = yMin + v * (yMax - yMin);
      const r = radiusAt(z);
      const ang = side * 0.32; // slightly above the side equator (after rot, side is ±X, up is +Y)
      // Before fuselage rotation the axis is Y; after rot.x=PI/2, axis is Z.
      // Windows are added in world/group space (after rotation), so place in X/Y/Z directly.
      const x = side * Math.cos(0.32) * (r + 0.01);
      const y = Math.sin(0.32) * (r + 0.01);
      const mesh = new THREE.Mesh(winGeo, winMat);
      mesh.position.set(x, y, z);
      fuse.add(mesh);
    }
  }

  // Cockpit windshield — a thin glass band parented to fuseMesh (Y-up),
  // sitting just above the skin. Frames are painted on the fuselage texture.
  const wsGroup = new THREE.Group();
  const glassMat = mat.glass();
  const wsPts = [
    new THREE.Vector2(1.07, 6.12),
    new THREE.Vector2(0.94, 6.48),
    new THREE.Vector2(0.82, 6.72),
    new THREE.Vector2(0.68, 6.95),
    new THREE.Vector2(0.54, 7.15),
  ];
  const wsMesh = new THREE.Mesh(
    new THREE.LatheGeometry(wsPts, 48, Math.PI - 1.05, 2.10),
    glassMat
  );
  wsGroup.add(wsMesh);
  fuseMesh.add(wsGroup);

  // Simple cockpit interior (visible from ห้องนักบิน)
  const cockpitIn = new THREE.Group();
  const dashTex = makeDashTexture();
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.28, 0.55),
    phys({ map: dashTex, color: 0xffffff, metalness: 0.2, roughness: 0.5, emissive: new THREE.Color(0x0a2a20), emissiveIntensity: 0.15 })
  );
  dash.position.set(0, 0.18, 6.15);
  dash.rotation.x = -0.25;
  cockpitIn.add(dash);
  const shield = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.12, 0.7),
    mat.black()
  );
  shield.position.set(0, 0.38, 6.28);
  shield.rotation.x = -0.15;
  cockpitIn.add(shield);
  // seats
  for (const sx of [-0.42, 0.42]) {
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.55, 0.42),
      phys({ color: 0x1a2430, metalness: 0.08, roughness: 0.7 })
    );
    seat.position.set(sx, 0.05, 5.45);
    cockpitIn.add(seat);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.28, 0.1),
      phys({ color: 0x1a2430, metalness: 0.08, roughness: 0.7 })
    );
    head.position.set(sx, 0.45, 5.28);
    cockpitIn.add(head);
  }
  fuse.add(cockpitIn);

  addPart(
    "fuselage",
    "ลำตัวเครื่อง",
    "Fuselage",
    "รูปทรงกระบอกช่วยให้แรงดันอากาศในห้องโดยสารกระจายสม่ำเสมอ ผิวโลหะบางแต่แข็งแรง รับทั้งแรงดันและความกดอากาศภายนอกที่สูง",
    fuse
  );

  // ---------- Wings ----------
  const wings = new THREE.Group();
  const wingMat = phys({
    color: 0xffffff,
    map: wingTex,
    metalness: 0.42,
    roughness: 0.34,
    clearcoat: 0.25,
    envMapIntensity: 1.05,
  });

  function buildHalfWing(sign) {
    const half = new THREE.Group();
    const geo = makeAirfoilWing({
      span: 7.6,
      rootChord: 3.15,
      tipChord: 1.05,
      leSweep: 2.35,
      rootThick: 0.42,
      tipThick: 0.14,
      segsSpan: 14,
      segsChord: 12,
      twist: -0.04,
      dir: sign,
    });
    const mesh = new THREE.Mesh(geo, wingMat);
    half.add(mesh);

    // Flap-track fairings
    const podMat = mat.metal();
    for (const [px, pz, sc] of [
      [2.2, -1.7, 1],
      [3.5, -1.55, 0.9],
      [4.8, -1.4, 0.8],
    ]) {
      const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.09 * sc, 0.7 * sc, 4, 8), podMat);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(sign * px, -0.22, pz);
      half.add(pod);
    }

    // Winglet
    const winglet = new THREE.Mesh(
      makeAirfoilWing({
        span: 1.15,
        rootChord: 1.05,
        tipChord: 0.38,
        leSweep: 0.45,
        rootThick: 0.12,
        tipThick: 0.05,
        segsSpan: 6,
        segsChord: 6,
        dir: sign,
      }),
      wingMat
    );
    winglet.position.set(sign * 7.55, 0.05, -2.35);
    winglet.rotation.z = sign * 1.15;
    winglet.rotation.y = sign * 0.12;
    half.add(winglet);

    // Nav light at tip
    const navCol = sign < 0 ? 0xff2a2a : 0x2aff6a;
    const navMat = mat.light(navCol, 2.4);
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), navMat);
    nav.position.set(sign * 7.62, 0.06, -2.15);
    half.add(nav);
    navLights.push({ mat: navMat, base: 2.4 });

    const strobeMat = mat.light(0xffffff, 0);
    strobeMats.push(strobeMat);
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), strobeMat);
    strobe.position.set(sign * 7.62, 0.14, -2.05);
    half.add(strobe);

    // Landing light in leading edge near root
    const landMat = mat.light(0xfff6d8, 3.2);
    const land = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), landMat);
    land.position.set(sign * 1.7, -0.04, -0.48);
    half.add(land);
    const landPt = new THREE.SpotLight(0xfff4dd, 0, 28, 0.35, 0.5, 0.6);
    landPt.position.copy(land.position);
    landPt.target.position.set(sign * 1.7, -1.2, 6);
    half.add(landPt);
    half.add(landPt.target);
    landingLights.push({ mat: landMat, light: landPt, base: 3.2, lightBase: 2.4 });

    half.position.set(sign * 1.15, -0.15, 0.35);
    half.rotation.z = sign * 0.08; // dihedral
    return half;
  }
  wings.add(buildHalfWing(1));
  wings.add(buildHalfWing(-1));

  addPart(
    "wings",
    "ปีก",
    "Wings",
    "แรงยกเกิดจากความต่างของความดันอากาศระหว่างบนปีกกับใต้ปีก เมื่ออากาศไหลผ่านมุมปะทะ ปีกนกที่ปลายปีกช่วยลดกระแสวนและประหยัดเชื้อเพลิง",
    wings
  );

  // ---------- Engines ----------
  const engines = new THREE.Group();

  function makeEngine(sign) {
    const eng = new THREE.Group();

    // Nacelle lathe (Y-up, then rotate to Z)
    const nacellePts = [
      new THREE.Vector2(0.58, -1.25),
      new THREE.Vector2(0.62, -1.05),
      new THREE.Vector2(0.64, -0.6),
      new THREE.Vector2(0.62, 0.1),
      new THREE.Vector2(0.6, 0.7),
      new THREE.Vector2(0.58, 1.05),
      new THREE.Vector2(0.52, 1.2),
      new THREE.Vector2(0.48, 1.28),
    ];
    const nacelle = new THREE.Mesh(
      new THREE.LatheGeometry(nacellePts, 40),
      phys({ color: 0xd8dee6, metalness: 0.7, roughness: 0.26, clearcoat: 0.3 })
    );
    nacelle.rotation.x = Math.PI / 2;
    eng.add(nacelle);

    // Intake lip
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.08, 12, 32),
      mat.metalDark()
    );
    lip.position.z = 1.28;
    eng.add(lip);

    // Intake interior
    const interior = new THREE.Mesh(
      new THREE.CylinderGeometry(0.50, 0.50, 0.6, 32, 1, true),
      mat.intake()
    );
    interior.rotation.x = Math.PI / 2;
    interior.position.z = 0.95;
    eng.add(interior);

    // Fan
    const fan = new THREE.Group();
    const bladeMat = mat.titanium();
    const bladeGeo = new THREE.BoxGeometry(0.045, 0.46, 0.09);
    bladeGeo.translate(0, 0.26, 0);
    for (let i = 0; i < 18; i++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.z = (i / 18) * Math.PI * 2;
      blade.rotation.y = 0.28;
      fan.add(blade);
    }
    const spinner = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mat.metal());
    spinner.scale.set(1, 1, 1.35);
    fan.add(spinner);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 20), mat.metalDark());
    hub.rotation.x = Math.PI / 2;
    hub.position.z = -0.05;
    fan.add(hub);
    // stator disc
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 32),
      mat.intake()
    );
    disc.position.z = -0.12;
    fan.add(disc);
    fan.position.z = 0.95;
    eng.add(fan);
    fans.push(fan);

    // Exhaust / chevrons
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.46, 0.35, 24, 1, true),
      mat.metalDark()
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = -1.22;
    eng.add(nozzle);

    const heatMat = mat.heat();
    heatMats.push(heatMat);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 16), heatMat);
    core.rotation.x = Math.PI / 2;
    core.position.z = -1.05;
    eng.add(core);

    // Chevron ring
    const chev = new THREE.Group();
    const chevMat = mat.metalDark();
    const chevGeo = new THREE.ConeGeometry(0.07, 0.16, 3);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const t = new THREE.Mesh(chevGeo, chevMat);
      t.position.set(Math.cos(a) * 0.44, Math.sin(a) * 0.44, -1.38);
      t.rotation.x = Math.PI / 2;
      chev.add(t);
    }
    eng.add(chev);

    // Pylon — only up to the wing underside so it does not pierce the top skin
    const pylon = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.52, 1.05),
      mat.metal()
    );
    pylon.position.set(0, 0.58, 0.12);
    eng.add(pylon);
    const pylonFair = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.1, 1.25),
      mat.metal()
    );
    pylonFair.position.set(0, 0.82, 0.08);
    eng.add(pylonFair);

    // Navy intake ring stripe
    const stripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.025, 8, 32),
      mat.navy()
    );
    stripe.position.z = 1.05;
    eng.add(stripe);

    eng.position.set(sign * 3.55, -1.15, 0.55);
    return eng;
  }
  engines.add(makeEngine(1));
  engines.add(makeEngine(-1));

  addPart(
    "engines",
    "เครื่องยนต์ไอพ่น",
    "Turbofan engines",
    "พัดลมด้านหน้าดูดอากาศ ส่วนหนึ่งไหลผ่านแกนเผาไหม้ ส่วนหนึ่งไหลรอบนอก แรงขับเกิดตามกฎข้อสามของนิวตันเมื่อไอร้อนและอากาศถูกพ่นออกด้านหลัง",
    engines
  );

  // ---------- Tail ----------
  const tail = new THREE.Group();
  const tailPaint = phys({
    color: 0xffffff,
    map: tailTex,
    metalness: 0.35,
    roughness: 0.38,
    clearcoat: 0.25,
  });
  const stabMat = phys({
    color: colors.white,
    metalness: 0.4,
    roughness: 0.32,
    clearcoat: 0.25,
  });

  const vStab = new THREE.Mesh(
    makeAirfoilWing({
      span: 2.7,
      rootChord: 2.4,
      tipChord: 1.05,
      leSweep: 1.55,
      rootThick: 0.22,
      tipThick: 0.08,
      segsSpan: 8,
      segsChord: 8,
    }),
    tailPaint
  );
  vStab.rotation.z = Math.PI / 2;
  vStab.position.set(0, 0.15, -6.05);
  tail.add(vStab);

  function hStab(sign) {
    const geo = makeAirfoilWing({
      span: 2.55,
      rootChord: 1.55,
      tipChord: 0.7,
      leSweep: 0.85,
      rootThick: 0.14,
      tipThick: 0.06,
      segsSpan: 7,
      segsChord: 7,
      dir: sign,
    });
    const m = new THREE.Mesh(geo, stabMat);
    m.position.set(sign * 0.15, 0.55, -6.85);
    m.rotation.z = sign * 0.06;
    tail.add(m);
  }
  hStab(1);
  hStab(-1);

  // APU exhaust
  const apu = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), mat.intake());
  apu.position.set(0, 0.15, -8.32);
  tail.add(apu);

  // Tail strobe / beacon
  const beaconMat = mat.light(0xff2222, 0);
  strobeMats.push(beaconMat);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), beaconMat);
  beacon.position.set(0, 2.85, -7.15);
  tail.add(beacon);
  const tailWhite = mat.light(0xffffff, 1.6);
  navLights.push({ mat: tailWhite, base: 1.6 });
  const tailLamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), tailWhite);
  tailLamp.position.set(0, 0.2, -8.2);
  tail.add(tailLamp);

  addPart(
    "tail",
    "หางเสือ",
    "Empennage",
    "ครีบตั้งช่วยให้เครื่องบินไม่หมุนซ้ายขวาเอง และมีหางเสือทิศทางสำหรับหันเห ครีบนอนควบคุมการพยศ คือการเงยหรือก้มหัวเครื่อง",
    tail
  );

  // ---------- Cockpit as clickable (windshield group already in fuselage).
  // Give the windshield a separate part by cloning reference? It's parented to fuse.
  // Use a dedicated invisible-ish wrapper in front for picking, plus we can also
  // set windshield userData after the fact.
  wsGroup.traverse((o) => {
    o.userData.partId = "cockpit";
  });
  cockpitIn.traverse((o) => {
    o.userData.partId = "cockpit";
  });
  parts.push({
    id: "cockpit",
    nameTh: "ห้องนักบิน",
    nameEn: "Cockpit",
    fact: "กระจกห้องนักบินต้องทนทั้งแรงดันและนกชน นักบินอ่านจอแสดงเส้นทางและทัศนียภาพ แล้วสั่งระบบควบคุมการบินผ่านคอมพิวเตอร์",
    object: wsGroup,
  });

  let lightsOn = true;

  function applyLights(on) {
    lightsOn = on;
    for (const n of navLights) n.mat.emissiveIntensity = on ? n.base : 0.04;
    for (const L of landingLights) {
      L.mat.emissiveIntensity = on ? L.base : 0.05;
      if (L.light) L.light.intensity = on ? L.lightBase : 0;
    }
    for (const m of cabinGlow) m.emissiveIntensity = on ? 0.18 : 0.02;
    for (const m of heatMats) m.emissiveIntensity = on ? 0.18 : 0.04;
  }

  function tick(now) {
    const t = now * 0.001;
    root.position.y = Math.sin(t * 0.7) * 0.16;
    root.rotation.z = Math.sin(t * 0.55) * 0.018;
    root.rotation.x = Math.sin(t * 0.45) * 0.012;
    for (const f of fans) f.rotation.z += 0.62;
    // Strobe: short flash twice, then pause (approx airliner pattern)
    const cycle = t % 1.15;
    const flash = lightsOn && ((cycle > 0 && cycle < 0.07) || (cycle > 0.16 && cycle < 0.23));
    for (const m of strobeMats) m.emissiveIntensity = flash ? 4.5 : 0;
  }

  applyLights(true);

  return {
    group: root,
    parts,
    tick,
    setLights: applyLights,
    getLights: () => lightsOn,
  };
}
