export const DEFAULT_PUBLIC_THEME = Object.freeze({
  '--hu-structural-black': '#050606',
  '--hu-surface': 'rgba(13, 16, 20, 0.56)',
  '--hu-surface-elevated': 'rgba(27, 31, 37, 0.68)',
  '--hu-ink': '#020303',
  '--hu-border': 'rgba(241, 234, 219, 0.46)',
  '--hu-glass-highlight': 'rgba(255, 255, 255, 0.18)',
  '--hu-glass-tint': 'rgba(187, 205, 219, 0.08)',
  '--hu-glass-shadow': 'rgba(0, 0, 0, 0.42)',
  '--hu-text': '#f1eadb',
  '--hu-text-muted': '#aaa498',
  '--hu-accent-primary': '#dc6847',
  '--hu-accent-secondary': '#e7c66d',
  '--hu-focus': '#fff0a5',
  '--hu-success': '#8ebf94',
  '--hu-warning': '#e7c66d',
  '--hu-destructive': '#ff765f',
  '--hu-signal': '#dc6847',
  '--spatial-background': '#030405',
  '--spatial-grid-line': 'rgba(224, 226, 218, 0.19)',
  '--spatial-vignette': 'radial-gradient(ellipse at 50% 48%, transparent 0 46%, rgba(0, 0, 0, 0.2) 76%, rgba(0, 0, 0, 0.58) 100%)',
  '--spatial-floor': 'linear-gradient(180deg, rgba(4, 5, 5, 0.9), rgba(0, 0, 0, 0.98))',
  '--spatial-ceiling': 'linear-gradient(180deg, #010202, rgba(5, 6, 6, 0.9))'
});

const ACTOR_ACCENTS = Object.freeze({
  abyssal_eye: Object.freeze({
    '--hu-accent-primary': '#b86af0',
    '--hu-accent-secondary': '#f0c8ff',
    '--hu-focus': '#fff2ff',
    '--hu-signal': '#d85cff'
  }),
  skull_reaper: Object.freeze({
    '--hu-accent-primary': '#dc6847',
    '--hu-accent-secondary': '#f1cf78',
    '--hu-focus': '#fff0a5',
    '--hu-signal': '#ff765f'
  })
});

export function getPublicTheme(actorId) {
  return Object.freeze({
    ...DEFAULT_PUBLIC_THEME,
    ...(ACTOR_ACCENTS[actorId] || {})
  });
}
