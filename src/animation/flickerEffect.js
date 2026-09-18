export default {
  id: 'flicker', label: 'Flicker', description: 'Brief, repeating interruptions in opacity.',
  parameters: [
    { key: 'depth', label: 'Flicker strength · %', min: 0, max: 1, step: .01, initial: .85, displayFactor: 100 },
    { key: 'period', label: 'Flicker cycle · seconds', min: 3, max: 30, step: .5, initial: 6 },
  ],
  motion: value => ({ name: 'inscape-flicker', duration: value.period, style: { '--motion-low': 1 - value.depth } }),
};
