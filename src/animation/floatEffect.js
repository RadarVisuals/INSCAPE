export default {
  id: 'float', label: 'Float', description: 'A gentle figure-eight movement.',
  parameters: [
    { key: 'horizontal', label: 'Horizontal · canvas units', min: 0, max: 4, step: .05, initial: .35 },
    { key: 'vertical', label: 'Vertical · canvas units', min: 0, max: 4, step: .05, initial: .2 },
    { key: 'period', label: 'Float cycle · seconds', min: 2, max: 60, step: .5, initial: 8 },
  ],
  motion: (value, cellSize) => ({ name: 'inscape-float', duration: value.period,
    style: { '--motion-x': value.horizontal * cellSize + 'px', '--motion-y': value.vertical * cellSize + 'px' } }),
};
