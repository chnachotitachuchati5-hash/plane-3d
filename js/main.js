import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import gsap from "gsap";
import { createPlane } from "./plane.js?v=20261116a";

const canvas = document.getElementById("c");
const card = document.getElementById("info-card");
const cardTitle = document.getElementById("card-title");
const cardEn = document.getElementById("card-en");
const cardFact = document.getElementById("card-fact");
const btnRotate = document.getElementById("btn-rotate");
const btnLights = document.getElementById("btn-lights");
const btnViews = {
  oblique: document.getElementById("btn-view-oblique"),
  side: document.getElementById("btn-view-side"),
  top: document.getElementById("btn-view-top"),
  cockpit: document.getElementById("btn-view-cockpit"),
};
const loader = document.getElementById("loader");

function showFatal(message, err) {
  if (!loader) return;
  loader.classList.add("fatal");
  loader.classList.remove("hide");
  const name = loader.querySelector(".load-name");
  if (name) name.textContent = message;
  const spin = loader.querySelector(".spinner");
  if (spin) spin.style.display = "none";
  let detail = loader.querySelector(".load-detail");
  if (!detail) {
    detail = document.createElement("div");
    detail.className = "load-detail";
    loader.appendChild(detail);
  }
  const text = err && (err.message || String(err));
  detail.textContent = text || "";
  detail.hidden = !text;
}

function isSoftwareGL(renderer) {
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const info = [
      dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "",
      gl.getParameter(gl.RENDERER),
      gl.getParameter(gl.VENDOR),
    ].join(" ");
    return /swiftshader|llvmpipe|softpipe|microsoft basic|virtualbox|angel[ -]?llvm|cpu/i.test(info);
  } catch {
    return false;
  }
}

function probeWebGL() {
  const c = document.createElement("canvas");
  const attrs = { alpha: false, antialias: false, failIfMajorPerformanceCaveat: false };
  try {
    return !!(c.getContext("webgl2", attrs) || c.getContext("webgl", attrs) || c.getContext("experimental-webgl", attrs));
  } catch {
    return false;
  }
}

function createRenderer() {
  if (!probeWebGL()) {
    const err = new Error("WebGL context unavailable");
    err.code = "NO_WEBGL";
    throw err;
  }
  const attempts = [
    { antialias: true, alpha: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false },
    { antialias: false, alpha: false, powerPreference: "default", failIfMajorPerformanceCaveat: false },
    { antialias: false, alpha: false, powerPreference: "low-power", failIfMajorPerformanceCaveat: false },
  ];
  let lastErr = null;
  for (const params of attempts) {
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, ...params });
      if (renderer.getContext()) return renderer;
    } catch (err) {
      lastErr = err;
    }
  }
  try {
    const attrs = {
      alpha: false,
      antialias: false,
      depth: true,
      stencil: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: "default",
    };
    const gl = canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
    if (gl) {
      return new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, alpha: false });
    }
  } catch (err) {
    lastErr = err;
  }
  const err = lastErr || new Error("WebGL context unavailable");
  err.code = "NO_WEBGL";
  throw err;
}

function makeSkyDome(THREE) {
  const geo = new THREE.SphereGeometry(160, 32, 20);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const zenith = new THREE.Color(0x2a6bb0);
  const horizon = new THREE.Color(0xd4e8f7);
  const warm = new THREE.Color(0xe8d8b8);
  const nadir = new THREE.Color(0x7aa8c8);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 160;
    const x = pos.getX(i) / 160;
    if (y >= 0) {
      const t = Math.pow(y, 0.65);
      tmp.copy(horizon).lerp(zenith, t);
      if (x > 0.15) tmp.lerp(warm, (1 - t) * 0.25 * Math.min(1, (x - 0.15) * 1.2));
    } else {
      tmp.copy(horizon).lerp(nadir, Math.pow(-y, 0.85));
    }
    cols[i * 3] = tmp.r;
    cols[i * 3 + 1] = tmp.g;
    cols[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false })
  );
  mesh.frustumCulled = false;
  return mesh;
}

function makeCloudTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(0.7, "rgba(230,240,250,0.18)");
  g.addColorStop(1, "rgba(230,240,250,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeClouds(THREE, software) {
  const group = new THREE.Group();
  const tex = makeCloudTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    color: 0xffffff,
  });
  const geo = new THREE.PlaneGeometry(1, 1);
  const count = software ? 8 : 14;
  const rng = (s) => {
    // tiny deterministic hash so the sky is stable across reloads
    const x = Math.sin(s * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < count; i++) {
    const puff = new THREE.Group();
    const n = 3 + (i % 3);
    const scale = 6 + rng(i + 3) * 9;
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(scale * (0.7 + rng(i * 9 + j) * 0.6), scale * (0.4 + rng(i * 11 + j) * 0.35), 1);
      m.position.set((rng(i * 5 + j) - 0.5) * scale * 0.5, (rng(i * 7 + j) - 0.5) * scale * 0.18, (rng(i * 13 + j) - 0.5) * scale * 0.3);
      m.rotation.y = rng(i * 17 + j) * Math.PI;
      m.rotation.z = (rng(i * 19 + j) - 0.5) * 0.3;
      puff.add(m);
    }
    const below = i % 3 === 0;
    puff.position.set(
      (rng(i + 20) - 0.5) * 90,
      below ? -10 - rng(i + 21) * 8 : 6 + rng(i + 22) * 16,
      (rng(i + 23) - 0.5) * 90
    );
    puff.userData.drift = 0.15 + rng(i + 24) * 0.25;
    puff.userData.baseX = puff.position.x;
    group.add(puff);
  }
  return group;
}

function makeSun(THREE) {
  const g = new THREE.Group();
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff4d2, fog: false, toneMapped: false })
  );
  sun.position.set(70, 48, 40);
  g.add(sun);
  return g;
}

function init() {
  let renderer;
  try {
    renderer = createRenderer();
  } catch (err) {
    console.error("WebGL unavailable:", err);
    showFatal("เบราว์เซอร์นี้ใช้ WebGL ไม่ได้ จึงแสดงภาพ 3 มิติไม่ได้ค่ะ ลองเปิดด้วย Chrome หรือ Edge แล้วเปิดการเร่งกราฟิกในตั้งค่า", err);
    return;
  }

  const software = isSoftwareGL(renderer);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, software ? 1 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !software;
  if (!software) renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8cce8);
  scene.fog = new THREE.Fog(0xb9d4ea, 55, 150);
  scene.add(makeSkyDome(THREE));
  scene.add(makeSun(THREE));
  const clouds = makeClouds(THREE, software);
  scene.add(clouds);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.08, 280);
  const views = {
    oblique: {
      pos: new THREE.Vector3(10.8, 3.6, 11.2),
      target: new THREE.Vector3(0, 0.15, 0.3),
      min: 5,
      max: 42,
    },
    side: {
      pos: new THREE.Vector3(16.5, 2.2, 0.6),
      target: new THREE.Vector3(0, 0.15, 0.2),
      min: 6,
      max: 42,
    },
    top: {
      pos: new THREE.Vector3(0.02, 22, 0.25),
      target: new THREE.Vector3(0, 0, 0),
      min: 8,
      max: 48,
    },
    cockpit: {
      pos: new THREE.Vector3(0.0, 0.62, 5.55),
      target: new THREE.Vector3(0, 0.28, 10.6),
      min: 0.25,
      max: 10,
    },
  };

  function defaultViewName() {
    return "oblique";
  }

  camera.position.copy(views.oblique.pos);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = views.oblique.min;
  controls.maxDistance = views.oblique.max;
  controls.target.copy(views.oblique.target);
  controls.maxPolarAngle = Math.PI * 0.95;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.55;

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(makeSkyDome(THREE));
    envScene.add(new THREE.HemisphereLight(0x9ec8f0, 0xd2c0a0, 1.1));
    envScene.add(new THREE.DirectionalLight(0xfff5e6, 1.4));
    const envTex = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();
  } catch (err) {
    console.warn("Sky environment unavailable, trying RoomEnvironment.", err);
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      pmrem.dispose();
    } catch (err2) {
      console.warn("Environment map unavailable, using lights only.", err2);
      scene.environment = null;
    }
  }

  const hemi = new THREE.HemisphereLight(0x9ec8f0, 0xcbb896, software ? 0.85 : 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff5e6, software ? 2.0 : 1.7);
  sun.position.set(18, 24, 12);
  sun.castShadow = !software;
  if (!software) {
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -20;
    sun.shadow.camera.right = sun.shadow.camera.top = 20;
    sun.shadow.bias = -0.0002;
  }
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa8c4ff, 0.35);
  fill.position.set(-14, 6, -8);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0x6a7a90, software ? 0.45 : 0.22));

  const plane = createPlane(THREE);
  scene.add(plane.group);

  let composer = null;
  let useComposer = false;
  if (!software) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.5, 0.85);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      useComposer = true;
    } catch (err) {
      console.warn("Bloom unavailable, falling back to standard renderer.", err);
      useComposer = false;
      composer = null;
    }
  }

  const state = {
    autoRotate: false,
    lights: true,
    view: defaultViewName(),
    selected: null,
    hovered: null,
    viewTween: null,
  };

  function markView(name) {
    state.view = name;
    for (const [key, btn] of Object.entries(btnViews)) {
      if (btn) btn.classList.toggle("active", key === name);
    }
  }

  function setView(name, animate = true) {
    const v = views[name];
    if (!v) return;
    markView(name);
    if (state.viewTween) state.viewTween.kill();
    controls.minDistance = v.min;
    controls.maxDistance = v.max;
    if (name === "cockpit" && state.autoRotate) {
      controls.autoRotate = false;
    } else {
      controls.autoRotate = state.autoRotate;
    }
    if (!animate) {
      camera.position.copy(v.pos);
      controls.target.copy(v.target);
      controls.update();
      return;
    }
    const fromPos = camera.position.clone();
    const fromTarget = controls.target.clone();
    const proxy = { t: 0 };
    state.viewTween = gsap.to(proxy, {
      t: 1,
      duration: name === "cockpit" ? 1.35 : 1.15,
      ease: "power2.inOut",
      onUpdate: () => {
        camera.position.lerpVectors(fromPos, v.pos, proxy.t);
        controls.target.lerpVectors(fromTarget, v.target, proxy.t);
      },
    });
  }

  btnViews.oblique.addEventListener("click", () => setView("oblique"));
  btnViews.side.addEventListener("click", () => setView("side"));
  btnViews.top.addEventListener("click", () => setView("top"));
  btnViews.cockpit.addEventListener("click", () => setView("cockpit"));

  btnRotate.addEventListener("click", () => {
    state.autoRotate = !state.autoRotate;
    controls.autoRotate = state.autoRotate && state.view !== "cockpit";
    btnRotate.classList.toggle("active", state.autoRotate);
  });

  btnLights.addEventListener("click", () => {
    state.lights = !state.lights;
    plane.setLights(state.lights);
    btnLights.classList.toggle("active", state.lights);
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPos = null;
  let highlighted = null;

  function partFromObject(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.partId) {
        return plane.parts.find((p) => p.id === o.userData.partId) || null;
      }
      o = o.parent;
    }
    return null;
  }

  function eachMaterial(root, fn) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m && fn(m, o));
    });
  }

  function setHighlight(part, on) {
    if (!part) return;
    eachMaterial(part.object, (m) => {
      if (!m.emissive) return;
      if (on) {
        if (!m.userData._e0) {
          m.userData._e0 = m.emissive.clone();
          m.userData._ei0 = m.emissiveIntensity ?? 1;
        }
        m.emissive.setHex(0xc9a24a);
        m.emissiveIntensity = 0.45;
      } else if (m.userData._e0) {
        m.emissive.copy(m.userData._e0);
        m.emissiveIntensity = m.userData._ei0;
      }
    });
  }

  function showCard(part) {
    if (!part) {
      card.classList.remove("visible");
      return;
    }
    cardTitle.textContent = part.nameTh;
    cardEn.textContent = part.nameEn;
    cardFact.textContent = part.fact;
    card.classList.add("visible");
  }

  function selectPart(part) {
    if (highlighted && highlighted !== part) setHighlight(highlighted, false);
    state.selected = part ? part.id : null;
    highlighted = part;
    if (part) setHighlight(part, true);
    showCard(part);
  }

  function pointerToNdc(e) {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  function hitPart(e) {
    pointerToNdc(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(plane.group, true);
    return hits.length ? partFromObject(hits[0].object) : null;
  }

  canvas.addEventListener("pointerdown", (e) => {
    downPos = { x: e.clientX, y: e.clientY };
    canvas.classList.add("is-dragging");
  });

  canvas.addEventListener("pointerup", (e) => {
    canvas.classList.remove("is-dragging");
    if (!downPos) return;
    const dx = e.clientX - downPos.x;
    const dy = e.clientY - downPos.y;
    downPos = null;
    if (dx * dx + dy * dy > 25) return;
    const part = hitPart(e);
    selectPart(part);
  });

  canvas.addEventListener("pointermove", (e) => {
    const part = hitPart(e);
    canvas.classList.toggle("is-hot", !!part);
    if (state.selected) return;
    if (state.hovered === (part && part.id)) return;
    if (state.hovered) {
      const prev = plane.parts.find((p) => p.id === state.hovered);
      if (prev) setHighlight(prev, false);
    }
    state.hovered = part ? part.id : null;
    if (part) {
      setHighlight(part, true);
      showCard(part);
    } else {
      showCard(null);
    }
  });

  canvas.addEventListener("pointerleave", () => {
    canvas.classList.remove("is-hot");
    if (state.selected) return;
    if (state.hovered) {
      const prev = plane.parts.find((p) => p.id === state.hovered);
      if (prev) setHighlight(prev, false);
    }
    state.hovered = null;
    showCard(null);
  });

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    showFatal("การ์ดจอคืนบริบท WebGL ไม่สำเร็จค่ะ ลองรีเฟรชหน้านี้", new Error("webglcontextlost"));
  });

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  let firstFrameOk = false;
  let stopped = false;

  function render() {
    if (stopped) return;
    requestAnimationFrame(render);
    controls.update();
    plane.tick(performance.now());
    const t = performance.now() * 0.001;
    for (const puff of clouds.children) {
      puff.position.x = puff.userData.baseX + Math.sin(t * 0.03 + puff.userData.drift) * 6;
    }
    try {
      if (useComposer && composer) composer.render();
      else renderer.render(scene, camera);
      if (!firstFrameOk) {
        firstFrameOk = true;
        loader.classList.add("hide");
        window.__PLANE_READY__ = true;
      }
    } catch (err) {
      if (useComposer) {
        useComposer = false;
        console.warn("Composer failed, using raw renderer.", err);
        try {
          renderer.render(scene, camera);
        } catch (err2) {
          console.error(err2);
          stopped = true;
          showFatal("แสดงภาพ 3 มิติไม่สำเร็จค่ะ ลองรีเฟรชหน้านี้", err2);
        }
      } else {
        console.error(err);
        stopped = true;
        showFatal("แสดงภาพ 3 มิติไม่สำเร็จค่ะ ลองรีเฟรชหน้านี้", err);
      }
    }
  }

  render();

  window.__PLANE__ = {
    ready: true,
    setView: (name, animate = false) => setView(name, animate),
    setLights: (on) => {
      state.lights = on;
      plane.setLights(on);
      btnLights.classList.toggle("active", on);
    },
    setAutoRotate: (on) => {
      state.autoRotate = on;
      controls.autoRotate = on && state.view !== "cockpit";
      btnRotate.classList.toggle("active", on);
    },
    select: (id) => selectPart(plane.parts.find((p) => p.id === id) || null),
    getState: () => ({ ...state, software }),
    source: window.__PLANE_SOURCE__ || "unknown",
    parts: plane.parts.map((p) => p.id),
  };
}

try {
  init();
} catch (err) {
  console.error(err);
  showFatal("เริ่มแอปไม่สำเร็จค่ะ ลองรีเฟรชหน้านี้", err);
}
