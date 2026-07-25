export const DEFAULT_PUBLIC_THEME = Object.freeze({
  '--color-accent-keeper': '#e87945',
  '--hu-signal': '#e87945'
});

const ACTOR_ACCENTS = Object.freeze({
  abyssal_eye: Object.freeze({
    '--color-accent-keeper': '#d85cff',
    '--hu-signal': '#d85cff'
  }),
  skull_reaper: DEFAULT_PUBLIC_THEME
});

export function getPublicTheme(actorId) {
  return ACTOR_ACCENTS[actorId] || DEFAULT_PUBLIC_THEME;
}
