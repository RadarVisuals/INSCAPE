import { useMemo, useState } from 'react';
import BrowserFixtureHarness from '../browser/BrowserFixtureHarness.jsx';
import LatticeChromeWindowHost from './LatticeChromeWindowHost.jsx';
import { LATTICE_CHROME_REGIONS } from './useLatticeChromeWindows.js';

function fixtureAssets(assetSource) {
  return (assetSource?.listAssets?.() || []).map((asset) => ({
    height: asset.height,
    src: asset.src,
    stableAssetId: asset.stableAssetId,
    title: asset.accessibleLabel || null,
    width: asset.width,
  }));
}

export default function LatticeChromeFixtureHost({ activeTable, assetSource, controller, interfaceState, railCollapsed = false, requestPlacement, themeState }) {
  const assets = useMemo(() => fixtureAssets(assetSource), [assetSource]);
  const [density, setDensity] = useState('comfortable');
  const railData = useMemo(() => ({
    activity: [
      { detail: 'NO RESOLVED RECORD', id: 'signal-unresolved-1', label: 'UNRESOLVED', type: 'ACTIVITY' },
      { detail: 'FIXTURE SHAPE ONLY', id: 'signal-unresolved-2', label: 'UNRESOLVED', type: 'ASSET SIGNAL' },
    ],
    assets,
    categories: [
      { assetIds: assets[0] ? [assets[0].stableAssetId] : [], id: 'public-fixture-1', name: 'CATEGORY 01', public: true },
      { assetIds: assets[1] ? [assets[1].stableAssetId] : [], id: 'private-boundary-fixture', name: 'PRIVATE FIXTURE', public: false },
    ],
  }), [assets]);
  const toolbarData = { ...themeState, ...interfaceState, density };
  const toolbarCommands = { ...themeState.commands, ...interfaceState.commands, setDensity };

  return <>
    <LatticeChromeWindowHost commands={{ toolbar: toolbarCommands }} controller={controller} data={{ rail: railData, toolbar: toolbarData }} railCollapsed={railCollapsed} />
    <BrowserFixtureHarness
      activeTable={activeTable}
      assetSource={assetSource}
      onRequestClose={(reason) => reason === 'escape' ? controller.closeDeepest() : controller.closeRegion(LATTICE_CHROME_REGIONS.TOOLBAR, reason !== 'placement')}
      open={controller.toolbarId === 'browser'}
      requestPlacement={requestPlacement}
    />
  </>;
}
