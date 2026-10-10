// Optional additions preserve the meaning and bytes of older Display appearance.
export const DISPLAY_CANVAS_APPEARANCE_KEYS = ['backgroundColor', 'guideVisible', 'snapToGrid'];
export function validDisplayCanvasAppearance(appearance) {
  return (!Object.hasOwn(appearance, 'backgroundColor') || appearance.backgroundColor === null || typeof appearance.backgroundColor === 'string' && /^#[0-9a-f]{6}$/iu.test(appearance.backgroundColor))
    && (!Object.hasOwn(appearance, 'guideVisible') || typeof appearance.guideVisible === 'boolean')
    && (!Object.hasOwn(appearance, 'snapToGrid') || typeof appearance.snapToGrid === 'boolean');
}
export const displayGuideMode = appearance => appearance.guideVisible === false ? 'NONE' : appearance.guideMode;
