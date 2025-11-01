// ============ Renderer / Scene / Camera setup ============
const canvas = document.getElementById("scene");

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,      // transparent for overlay
  antialias: true
});
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();

// Perspective camera (fov ~50)
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

// We'll tween camState instead of the camera directly
let camState = { x: 0, y: 0.3, z: 4 };
camera.position.set(camState.x, camState.y, camState.z);

const lookTarget = new THREE.Vector3(0, 0, 0);

// ============ Soft lighting (gives nice plastic/gloss feel) ============
{
  // Ambient: soft pinkish/white
  const amb = new THREE.AmbientLight(0xffcce0, 0.4);
  scene.add(amb);

  // Key light from upper-left/front
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(-1, 1.5, 2);
  scene.add(dir);

  // Rim light from behind in pink/red
  const rim = new THREE.DirectionalLight(0xff4a6a, 0.6);
  rim.position.set(0, 0, -2);
  scene.add(rim);
}

// ============ Helper: load texture onto a plane ============
const loader = new THREE.TextureLoader();

function makeBillboard(texURL, baseWidth = 2.0) {
  const tex = loader.load(texURL);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.transparent = true;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false // helps glow overlay nicely
  });

  // we'll scale after image loads so aspect ratio locks in
  const geo = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geo, mat);

  tex.onceReady = false;
  tex.onUpdate = () => {
    if (tex.onceReady) return;
    tex.onceReady = true;

    // Your PNGs are all 800x800 right now, so aspect = 1
    // but we still calculate it to be safe
    const w = tex.image.width || 800;
    const h = tex.image.height || 800;
    const aspect = h / w;

    // baseWidth controls how big the logo is in world units.
    // Bigger number = bigger on screen.
    mesh.scale.set(baseWidth, baseWidth * aspect, 1);
  };

  return mesh;
}

// ============ Create our planes from your assets ============
//
// IMPORTANT: these PNGs are *already aligned* the way you want the final logo to look.
// So if we just stack them all at position (0,0), they visually line up as the final H4R logo.
//
const bigHeartPlane   = makeBillboard("assets/big-heart.png",   2.0);
const textPlane       = makeBillboard("assets/h4r-text.png",    2.0);
const smallHeartPlane = makeBillboard("assets/small-heart.png", 2.0);

// Optional glow / aura plane
// You can use h4r-logo-heart.png as a glow mask or swap it with any soft radial pink glow PNG.
// If you don't want glow, you can still keep this and just leave its opacity at 0.
const glowPlane       = makeBillboard("assets/h4r-logo-heart.png", 2.5);

// ============ Build scene graph / grouping ============
const fullGroup   = new THREE.Group(); // we spin this in Phase 4
scene.add(fullGroup);

// Separate subgroups so we can animate them differently
const heartGroup  = new THREE.Group();   // just the big heart
heartGroup.add(bigHeartPlane);

const textGroup   = new THREE.Group();   // just the "H4R" text
textGroup.add(textPlane);

// addonGroup is text + small heart together
// (because later they eject together in the break-apart phase)
const addonGroup  = new THREE.Group();
addonGroup.add(textGroup);
addonGroup.add(smallHeartPlane);

const glowGroup   = new THREE.Group();
glowGroup.add(glowPlane);

// Add all main parts under fullGroup
fullGroup.add(heartGroup);   // stays behind in Phase 5
fullGroup.add(addonGroup);   // flies off in Phase 5
fullGroup.add(glowGroup);    // glow fades away in Phase 5

// Z stacking so they render in the right order.
// We keep everything centered (0,0) in world space because your PNGs are pre-aligned.
bigHeartPlane.position.set(0, 0,  0.00); // back/base
textGroup.position.set(0,   0,  0.01);  // slightly in front
smallHeartPlane.position.set(0,0,0.02); // will LAND here; starts offscreen though
glowGroup.position.set(0,   0, -0.05);  // behind for aura

// Helper to set opacity recursively on a group
function setOpacity(obj, value) {
  obj.traverse(child => {
    if (child.isMesh && child.material && "opacity" in child.material) {
      child.material.opacity = value;
    }
  });
}

// ============ INITIAL STATE (Phase 0 / before loop starts) ============

// Big heart starts slightly scaled down + invisible
heartGroup.scale.set(0.8, 0.8, 0.8);
setOpacity(heartGroup, 0);

// Text starts already in final aligned position (no sliding),
// but small scale + invisible.
textGroup.scale.set(0.5, 0.5, 0.5);
setOpacity(textGroup, 0);

// Small heart: will fly in from offscreen.
// We'll move JUST the smallHeartPlane for that fly-in.
smallHeartPlane.scale.set(1, 1, 1);
// start off way up/right
smallHeartPlane.position.set(2.5, 2.5, 0.02);
setOpacity(smallHeartPlane, 0);

// addonGroup wrapper is at origin,
// because text should reveal exactly where it belongs on the heart.
addonGroup.position.set(0, 0, 0);
addonGroup.scale.set(1, 1, 1);
setOpacity(addonGroup, 1); // children we already faded individually

// Glow starts tiny and off
glowGroup.scale.set(0.6, 0.6, 0.6);
setOpacity(glowGroup, 0);

// Full logo group defaults
fullGroup.rotation.set(0, 0, 0);
fullGroup.scale.set(1, 1, 1);

// Camera hero start
camState = { x: 0, y: 0.3, z: 4 };
camera.position.set(camState.x, camState.y, camState.z);

// ============ GSAP master timeline ============
// This matches your phases: reveal heart → show text → fly in mini heart → spin → break apart → reset
const tl = gsap.timeline({
  repeat: -1,
  repeatDelay: 0,
  defaults: { ease: "power2.out" }
});

/*
PHASE 1 (0s → ~0.6s): Big heart reveal
- heartGroup scale 0.8 → 1.0
- opacity 0 → 1
- camera gentle push in
*/
tl.to(heartGroup.scale, {
  x: 1, y: 1, z: 1,
  duration: 0.6,
  ease: "back.out(1.6)"
}, 0);

tl.to({}, {
  duration: 0.6,
  onUpdate: () => {
    setOpacity(heartGroup, 1);
  }
}, 0);

tl.to(camState, {
  x: 0,
  y: 0.25,
  z: 3.6,
  duration: 0.6,
  ease: "power2.out"
}, 0);

/*
PHASE 2 (~0.6s → ~1.1s): Text appears
- textGroup scales 0.5 → 1.0 in place (already aligned on heart)
- text fades in
- camera shifts slightly left for lighting angle
*/
tl.to(textGroup.scale, {
  x: 1, y: 1, z: 1,
  duration: 0.5,
  ease: "back.out(1.4)"
}, 0.6);

tl.to({}, {
  duration: 0.5,
  onStart: () => { setOpacity(textGroup, 1); }
}, 0.6);

tl.to(camState, {
  x: -0.2,
  y: 0.25,
  z: 3.55,
  duration: 0.5,
  ease: "power1.out"
}, 0.6);

/*
PHASE 3 (~1.1s → ~1.8s): Small heart flies in
- smallHeartPlane moves from offscreen (2.5,2.5) → (0,0) which is its real aligned slot
- fades in
- addonGroup scale gets a little "pop"
- camera recenters and tilts up slightly
- small heart starts a slow spin in place
*/
tl.to(smallHeartPlane.position, {
  x: 0,
  y: 0,
  z: 0.02,
  duration: 0.7,
  ease: "power2.out"
}, 1.1);

tl.to(addonGroup.scale, {
  x: 1, y: 1, z: 1,
  duration: 0.7,
  ease: "back.out(1.4)"
}, 1.1);

tl.to({}, {
  duration: 0.7,
  onStart: () => { setOpacity(smallHeartPlane, 1); }
}, 1.1);

// camera locks back on center / slight push
tl.to(camState, {
  x: 0,
  y: 0.4,
  z: 3.4,
  duration: 0.7,
  ease: "power2.out"
}, 1.1);

// cute slow spin of just the mini heart (4 full turns)
// runs long, overlaps following phases
tl.to(smallHeartPlane.rotation, {
  z: smallHeartPlane.rotation.z + (Math.PI * 2 * 4),
  duration: 3,
  ease: "none"
}, 1.1);

/*
PHASE 3.5 (~1.8s → ~2.2s): Glow fade-in
- only once full logo is assembled
*/
tl.to(glowGroup.scale, {
  x: 1, y: 1, z: 1,
  duration: 0.4,
  ease: "power2.out"
}, 1.8);

tl.to({}, {
  duration: 0.4,
  onStart: () => { setOpacity(glowGroup, 0.6); }
}, 1.8);

/*
PHASE 4 (~1.8s → ~4.3s): Hero spin
- spin the entire fullGroup (heart + text + mini heart + glow) as one
  -> this guarantees the spinning pose is EXACTLY the final logo layout
- do the "scale punch" during the spin
- pull camera back slightly and float up
*/
tl.to(fullGroup.rotation, {
  y: fullGroup.rotation.y + Math.PI * 2, // 360°
  duration: 2.5,
  ease: "power2.inOut",
  onComplete: () => {
    // after spin, face front again
    fullGroup.rotation.y = 0;
  }
}, 1.8);

tl.to(fullGroup.scale, {
  x: 1.15,
  y: 1.15,
  z: 1.15,
  duration: 1.0,
  ease: "power2.out"
}, 1.8);

tl.to(fullGroup.scale, {
  x: 1.0,
  y: 1.0,
  z: 1.0,
  duration: 1.5,
  ease: "power2.inOut"
}, 2.8);

// camera float back while it spins
tl.to(camState, {
  y: 0.5,
  z: 3.8,
  duration: 2.5,
  ease: "power1.inOut"
}, 1.8);

/*
PHASE 5 (~5.0s → ~5.6s): Break apart / eject
- addonGroup (text + mini heart) blasts up/right and shrinks
- glow scales up and fades out
- big heart stays
- camera reacts/pulls back
*/
tl.to(addonGroup.position, {
  x: 1.5,
  y: 1.5,
  z: 0.5,
  duration: 0.6,
  ease: "power2.in"
}, 5.0);

tl.to(addonGroup.scale, {
  x: 0.4,
  y: 0.4,
  z: 0.4,
  duration: 0.6,
  ease: "power2.in"
}, 5.0);

tl.to(addonGroup.rotation, {
  z: addonGroup.rotation.z + Math.PI / 4,
  y: addonGroup.rotation.y + Math.PI,
  duration: 0.6,
  ease: "power2.in"
}, 5.0);

// fade addonGroup out while it ejects
tl.to({}, {
  duration: 0.6,
  onUpdate: () => {
    setOpacity(addonGroup, 0);
  }
}, 5.0);

// glow puff out/fade
tl.to(glowGroup.scale, {
  x: 1.2,
  y: 1.2,
  z: 1.2,
  duration: 0.6,
  ease: "power2.in"
}, 5.0);

tl.to({}, {
  duration: 0.6,
  onStart: () => { setOpacity(glowGroup, 0.0); }
}, 5.0);

// camera reacts
tl.to(camState, {
  x: 0.2,
  y: 0.45,
  z: 4.0,
  duration: 0.6,
  ease: "power2.inOut"
}, 5.0);

/*
PHASE 6 (~5.6s → ~6.6s): Hold on just the big heart
- camera drifts back to hero angle
*/
tl.to(camState, {
  x: 0,
  y: 0.3,
  z: 4.0,
  duration: 1.0,
  ease: "power2.out"
}, 5.6);

tl.to({}, {
  duration: 1.0,
  onStart: () => {
    heartGroup.scale.set(1,1,1);
    setOpacity(heartGroup, 1);
  }
}, 5.6);

/*
PHASE 7 (~6.6s → ~6.8s): Reset
- put everything back to the Phase 0 starting positions
- so the loop can run forever
*/
tl.to({}, {
  duration: 0.2,
  onStart: () => {
    // hide + shrink heart
    heartGroup.scale.set(0.8,0.8,0.8);
    setOpacity(heartGroup, 0);

    // text small & invisible (already aligned at 0,0 so next loop it fades in-place)
    textGroup.scale.set(0.5,0.5,0.5);
    textGroup.rotation.set(0,0,0);
    setOpacity(textGroup, 0);

    // mini heart back offscreen
    smallHeartPlane.position.set(2.5,2.5,0.02);
    smallHeartPlane.rotation.set(0,0,0);
    setOpacity(smallHeartPlane, 0);

    // addonGroup reset so it can eject again next loop
    addonGroup.position.set(0,0,0);
    addonGroup.scale.set(1,1,1);
    addonGroup.rotation.set(0,0,0);
    setOpacity(addonGroup, 1);

    // glow reset (small + invisible behind heart)
    glowGroup.scale.set(0.6,0.6,0.6);
    glowGroup.position.set(0,0,-0.05);
    setOpacity(glowGroup, 0);

    // master group reset
    fullGroup.rotation.set(0,0,0);
    fullGroup.scale.set(1,1,1);

    // camera reset
    camState.x = 0;
    camState.y = 0.3;
    camState.z = 4;
  }
}, 6.6);

// ============ Render loop ============
function animate() {
  requestAnimationFrame(animate);

  // Update camera each frame from camState
  camera.position.set(camState.x, camState.y, camState.z);
  camera.lookAt(lookTarget);

  renderer.render(scene, camera);
}
animate();

// ============ Handle browser resize ============
window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});
