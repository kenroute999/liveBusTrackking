import * as THREE from "three";

// A lightweight WebGL overlay that draws the KenRoute 3D bus at the GPS coordinate.
// Leaflet stays the base map and remains fully interactive; this canvas is a transparent
// layer anchored to the bus marker's on-screen position each frame.
//
// Plain Three.js (no react-three-fiber): the scene is tiny and imperative, and owning
// the renderer lifecycle directly lets us dispose it precisely on unmount. The bundle
// cost is a single `three` dependency.

// KenRoute palette, lifted from the app's CSS tokens (styles.css):
//   --navy #0f2a4a body · --green #22c55e stripe · glass/rim/tire from the 2D marker.
const NAVY = 0x0f2a4a;
const NAVY_LIGHT = 0x1b3c63;
const GREEN = 0x22c55e;
const GLASS = 0x0f2233;
const RIM = 0x7dd3fc;
const TIRE = 0x0b1c33;
const HUB = 0xcbd5e1;
const HEAD = 0xfef3c7;
const TAIL = 0xef4444;

/** The handle the map uses to move/turn/scale the bus each frame. */
export interface BusHandle {
  /** Turn the front (+Z) toward a compass heading (radians) and set model scale. */
  setHeadingAndScale: (headingRad: number, scale: number) => void;
  /** Render one frame (called by the shared rAF loop). */
  render: () => void;
}

/** True when this browser can actually run WebGL; otherwise the caller falls back. */

/**
 * The bus as an imperative scene graph, shaped like a modern city transit coach:
 * short and tall rather than long and low, a near-vertical front, one big windshield,
 * a continuous glazed band down each flank, a roof pod, and two close axles.
 * Modelled roughly 1.35 wide x 1.5 tall x 3.0 long. Front faces +Z.
 */
function buildBus(): { group: THREE.Group; setHeadingAndScale: BusHandle["setHeadingAndScale"] } {
  const group = new THREE.Group();
  const box = (w: number, h: number, d: number, mat: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  const navy = new THREE.MeshStandardMaterial({ color: NAVY, metalness: 0.3, roughness: 0.5 });
  const navyLight = new THREE.MeshStandardMaterial({ color: NAVY_LIGHT, metalness: 0.32, roughness: 0.42 });
  const navyDark = new THREE.MeshStandardMaterial({ color: 0x0a1e36, metalness: 0.25, roughness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: GLASS,
    metalness: 0.1,
    roughness: 0.1,
    transmission: 0.3,
    transparent: true,
    opacity: 0.9,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });
  const rim = new THREE.MeshStandardMaterial({ color: RIM, roughness: 0.3 });
  const tire = new THREE.MeshStandardMaterial({ color: TIRE, roughness: 0.85 });
  const hub = new THREE.MeshStandardMaterial({ color: HUB, metalness: 0.65, roughness: 0.3 });
  const head = new THREE.MeshStandardMaterial({ color: HEAD, emissive: HEAD, emissiveIntensity: 0.55 });
  const tail = new THREE.MeshStandardMaterial({ color: TAIL, emissive: TAIL, emissiveIntensity: 0.45 });
  const stripe = new THREE.MeshStandardMaterial({ color: GREEN, metalness: 0.25, roughness: 0.38 });

  const add = (m: THREE.Mesh, x: number, y: number, z: number) => {
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // Lower skirt (bumper line) and main body: tall, boxy, near-vertical front.
  add(box(1.38, 0.44, 3.02, navyDark), 0, -0.54, 0);
  add(box(1.35, 1.5, 3.0, navy), 0, 0, 0);

  // Roof, inset for a bevelled shoulder, plus a roof pod for depth.
  add(box(1.28, 0.16, 2.92, navyLight), 0, 0.8, 0);
  add(box(0.86, 0.14, 1.5, navyLight), 0, 0.95, -0.25);

  // Green accent stripe wrapping the flanks.
  add(box(1.4, 0.09, 2.96, stripe), 0, -0.28, 0);

  // Continuous glazed band down each side, as on a city bus.
  for (const side of [-1, 1]) {
    add(box(0.05, 0.56, 2.5, glass), side * 0.685, 0.2, 0);
  }
  // Door panel line ahead of the rear axle on the left flank.
  add(box(0.06, 1.2, 0.62, navyDark), -0.69, -0.05, 0.72);

  // Big flat windshield at the front, and a rear window.
  add(box(1.16, 0.62, 0.06, glass), 0, 0.22, 1.51);
  add(box(1.05, 0.5, 0.06, rim), 0, 0.22, -1.51);

  // Destination sign panel above the windshield.
  add(box(0.9, 0.16, 0.05, rim), 0, 0.66, 1.52);

  // Two axles, close together, as on a rigid city bus.
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20);
  const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.26, 12);
  for (const [x, z] of [
    [-0.69, 0.95],
    [0.69, 0.95],
    [-0.69, -0.95],
    [0.69, -0.95],
  ]) {
    const g = new THREE.Group();
    g.position.set(x, -0.41, z);
    g.rotation.z = Math.PI / 2; // cylinder axis along X
    const wm = new THREE.Mesh(wheelGeo, tire);
    wm.castShadow = true;
    g.add(wm);
    g.add(new THREE.Mesh(hubGeo, hub));
    group.add(g);
  }

  // Headlights front, tail lights rear.
  for (const x of [-0.44, 0.44]) {
    add(box(0.3, 0.16, 0.06, head), x, -0.42, 1.53);
    add(box(0.26, 0.18, 0.06, tail), x, -0.42, -1.53);
  }

  return {
    group,
    setHeadingAndScale(headingRad, scale) {
      group.rotation.y = headingRad;
      group.scale.setScalar(scale);
    },
  };
}

/**
 * Mounts the 3D bus into `canvas` and returns a handle plus a dispose function that
 * frees every geometry, material and the WebGL renderer.
 */
export function mountBus3d(canvas: HTMLCanvasElement, size: number): { handle: BusHandle; dispose: () => void } {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return { handle: null as unknown as BusHandle, dispose: () => {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size, size, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  // Camera sits on the +Z (south) axis looking north, low enough to show the front and
  // one flank in three-quarter view. Keeping it on +Z also keeps screen-up aligned to
  // compass north, so the bus's rotation maps exactly to the GPS heading.
  camera.position.set(0, 3.1, 6.6);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc6ff, 0.45);
  rim.position.set(-3, 2, -3);
  scene.add(rim);

  // Invisible ground that only catches the bus's shadow, so it reads on the map.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), new THREE.ShadowMaterial({ opacity: 0.3 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.78; // the new body's wheel contact line
  ground.receiveShadow = true;
  scene.add(ground);

  const bus = buildBus();
  scene.add(bus.group);

  const handle: BusHandle = {
    setHeadingAndScale: bus.setHeadingAndScale,
    render: () => renderer.render(scene, camera),
  };

  const dispose = () => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    renderer.dispose();
  };

  return { handle, dispose };
}