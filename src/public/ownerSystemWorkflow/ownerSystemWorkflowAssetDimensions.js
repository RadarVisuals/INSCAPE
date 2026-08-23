function positiveDimension(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function ownerSystemWorkflowAssetDimensions(asset) {
  if (!asset) return null;
  const width = positiveDimension(asset.imageWidth) ?? positiveDimension(asset.width);
  const height = positiveDimension(asset.imageHeight) ?? positiveDimension(asset.height);
  return width && height ? Object.freeze({ width, height }) : null;
}
