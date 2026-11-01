// One set of bounds/defaults for authored settings, tools and the motion model.
export const KEEPER_SWIM_FIELDS = Object.freeze({
  speed: { label: 'Swim speed', unit: 'px/s', min: 80, max: 900, step: 10, default: 420 },
  gatherSeconds: { label: 'Gather time', unit: 's', min: .1, max: 3, step: .05, default: .4 },
  spreadSeconds: { label: 'Spread time', unit: 's', min: .1, max: 3, step: .05, default: .55 },
  turnSeconds: { label: 'Head turn time', unit: 's', min: .1, max: 2, step: .05, default: .4 },
  staggerSeconds: { label: 'Tentacle stagger', unit: 's apart', min: 0, max: .2, step: .01, default: .06 },
});
export const KEEPER_SWIM_DEFAULTS = Object.freeze(Object.fromEntries(
  Object.entries(KEEPER_SWIM_FIELDS).map(([key, field]) => [key, field.default]),
));
// Older drafts/publications read the new swim defaults without a data rewrite.
export const keeperSwim = record => record.swim ?? KEEPER_SWIM_DEFAULTS;
export const validKeeperSwim = value => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === Object.keys(KEEPER_SWIM_FIELDS).length
  && Object.entries(KEEPER_SWIM_FIELDS).every(([key, field]) => Object.hasOwn(value, key)
    && Number.isFinite(value[key]) && value[key] >= field.min && value[key] <= field.max);
