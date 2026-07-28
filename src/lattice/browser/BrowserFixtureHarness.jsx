import { useMemo, useRef, useState } from 'react';
import BrowserWorkspace from './BrowserWorkspace.jsx';

function fixtureAssets(assetSource) {
  return (assetSource?.listAssets?.() || []).map((asset) => ({
    height: asset.height,
    mediaType: 'image',
    src: asset.src,
    stableAssetId: asset.stableAssetId,
    title: asset.accessibleLabel || null,
    width: asset.width,
  }));
}
export default function BrowserFixtureHarness({ activeTable, assetSource, onRequestClose, open, requestPlacement }) {
  const assets = useMemo(() => fixtureAssets(assetSource), [assetSource]);
  const categoryCounterRef = useRef(2);
  const [categories, setCategories] = useState(() => [
    { assetIds: assets[0] ? [assets[0].stableAssetId] : [], id: 'fixture-category-1', name: 'CATEGORY 01', public: true },
    { assetIds: assets[1] ? [assets[1].stableAssetId] : [], id: 'fixture-category-2', name: 'CATEGORY 02', public: false },
  ]);

  const data = { activeTable, assetError: null, assetLoadState: 'ready', assetProgress: { resolved: assets.length, total: assets.length }, assets, categories, fixture: true };
  const commands = {
    createCategory(name) {
      categoryCounterRef.current += 1;
      const id = `fixture-category-${categoryCounterRef.current}`;
      setCategories((current) => [...current, { assetIds: [], id, name, public: false }]);
      return id;
    },
    deleteCategory(id) { setCategories((current) => current.filter((category) => category.id !== id)); },
    renameCategory(id, name) { setCategories((current) => current.map((category) => category.id === id ? { ...category, name } : category)); },
    requestPlacement,
    setCategoryAsset(categoryId, stableAssetId, included) {
      setCategories((current) => current.map((category) => category.id === categoryId ? {
        ...category,
        assetIds: included ? [...new Set([...category.assetIds, stableAssetId])] : category.assetIds.filter((id) => id !== stableAssetId),
      } : category));
    },
    setCategoryPublic(id, isPublic) { setCategories((current) => current.map((category) => category.id === id ? { ...category, public: isPublic } : category)); },
  };
  return <BrowserWorkspace commands={commands} data={data} onRequestClose={onRequestClose} open={open} />;
}
