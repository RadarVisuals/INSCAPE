export function createOwnerWorldLayoutDocument(document, objects, assets) {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  return {
    ...document,
    canvasObjects: objects.map((object) => ({
      id: object.id,
      kind: object.kind,
      asset: { stableAssetId: object.stableAssetId, cachedName: assetById.get(object.stableAssetId)?.name },
      placement: { ...object.placement },
      span: { ...object.span },
      order: object.presentationOrder,
      presentation: { ...object.presentation }
    }))
  };
}
