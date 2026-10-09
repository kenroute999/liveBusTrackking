/** WebGL probe kept free of any `three` import so the 3D engine stays out of the
 * initial bundle; the heavy module is loaded on demand by TrackingMap. */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}