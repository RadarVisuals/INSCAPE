import { imageReferenceCount } from '../imageModule/imageModule.js';

export function compositionReferenceCount(value) {
  const count = node => node?.type === 'artwork' ? 1 : Array.isArray(node?.content) ? node.content.reduce((sum, child) => sum + count(child), 0) : 0;
  return imageReferenceCount(value?.imageModules) + (Array.isArray(value?.texts) ? value.texts : []).reduce((sum, item) => sum + count(item?.article?.content), 0);
}
