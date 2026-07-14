const STORAGE_KEY = 'underneath.mutation-recipes.v1';

export const MUTATION_RECIPE_KEYS = [
  'creatorCharacterId',
  'creatorPatternId',
  'creatorPaletteId',
  'creatorBasePaletteBId',
  'creatorPattern1PaletteAId',
  'creatorPattern1PaletteBId',
  'creatorPattern2Id',
  'creatorPattern2PaletteAId',
  'creatorPattern2PaletteBId',
  'mutationMode',
  'mutationAxisX',
  'mutationAxisY',
  'mutationSourceX',
  'mutationSourceY',
  'mutationPatternMode',
  'mutationRotation',
  'mutationAutoRotate',
  'mutationRotationDirection',
  'mutationRotationSpeed',
  'warpIntensity',
  'warpSpeed',
  'warpMode',
  'warpOrganicRange',
  'warpLayerDivergence',
  'warpCursorInfluence',
  'warpCursorRadius',
  'creatorBaseColorMode',
  'creatorBaseGradientAngle',
  'creatorBaseGradientBalance',
  'creatorBaseOpacity',
  'creatorPattern1ColorMode',
  'creatorPattern1GradientAngle',
  'creatorPattern1GradientBalance',
  'creatorPattern1Opacity',
  'creatorPattern1Scale',
  'creatorPattern2ColorMode',
  'creatorPattern2GradientAngle',
  'creatorPattern2GradientBalance',
  'creatorPattern2Opacity',
  'creatorPattern2Scale',
  'creatorNoiseIntensity',
  'creatorNoiseScale',
  'creatorEyes'
];

function readRecipes() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[MutationRecipes] Could not read saved recipes:', error);
    return [];
  }
}

function persistRecipes(recipes) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  } catch (error) {
    console.warn('[MutationRecipes] Could not persist recipes:', error);
  }
}

function createRecipeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `mutation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const createMutationRecipeSlice = (set, get) => ({
  mutationRecipes: readRecipes(),

  saveMutationRecipe: (requestedName) => {
    const name = requestedName.trim();
    if (!name) return null;

    const state = get();
    const values = Object.fromEntries(MUTATION_RECIPE_KEYS.map((key) => [key, state[key]]));
    const timestamp = new Date().toISOString();
    const existing = state.mutationRecipes.find((recipe) => recipe.name.toLowerCase() === name.toLowerCase());
    const savedRecipe = existing
      ? { ...existing, name, updatedAt: timestamp, values }
      : { id: createRecipeId(), name, createdAt: timestamp, updatedAt: timestamp, values };
    const mutationRecipes = existing
      ? state.mutationRecipes.map((recipe) => recipe.id === existing.id ? savedRecipe : recipe)
      : [...state.mutationRecipes, savedRecipe];

    persistRecipes(mutationRecipes);
    set({ mutationRecipes });
    return savedRecipe.id;
  },

  applyMutationRecipe: (recipeId) => {
    const recipe = get().mutationRecipes.find((candidate) => candidate.id === recipeId);
    if (!recipe?.values) return false;
    const safeValues = Object.fromEntries(
      MUTATION_RECIPE_KEYS
        .filter((key) => Object.prototype.hasOwnProperty.call(recipe.values, key))
        .map((key) => [key, recipe.values[key]])
    );
    // Geometry recipes are source-agnostic. Applying one should not silently
    // replace the currently selected authored actor with a creator seed.
    set({ ...safeValues });
    return true;
  },

  deleteMutationRecipe: (recipeId) => {
    const mutationRecipes = get().mutationRecipes.filter((recipe) => recipe.id !== recipeId);
    persistRecipes(mutationRecipes);
    set({ mutationRecipes });
  }
});
