export function resolvePublicCanvasTarget(document, target) {
  const moduleId = target?.moduleId;
  if (!moduleId) return null;
  const published = document.texts?.some(text => text.id === moduleId)
    || document.imageModules?.some(image => image.id === moduleId);
  return published ? { moduleId } : null;
}
