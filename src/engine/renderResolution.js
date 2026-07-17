export const MAX_RENDER_RESOLUTION = 1.5;

export function getRenderResolution(devicePixelRatio = globalThis.devicePixelRatio) {
  const ratio = Number(devicePixelRatio);
  return Math.min(Number.isFinite(ratio) && ratio > 0 ? ratio : 1, MAX_RENDER_RESOLUTION);
}
