import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLibraryStore } from '../../library/state/useLibraryStore.js';
import { useProfileContractFacts, useProfileIdentity } from '../../profileIdentity/index.js';
import ProfileDocumentV9Preview from '../../profileDocument/components/ProfileDocumentV9Preview.jsx';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';
import { createProductionIdentityDossierViewModel } from '../identity/productionIdentityDossierViewModel.js';
import { buildOwnerSystemWorkflowPreviewDocument, preloadOwnerSystemWorkflowPreviewEntryMedia } from '../ownerSystemWorkflowPreviewDocument.js';
import useOwnerLatticeBrowser from '../useOwnerLatticeBrowser.js';
import OwnerSystemWorkflowCanvas from './OwnerSystemWorkflowCanvas.jsx';
import OwnerSystemWorkflowFocusViewer from './OwnerSystemWorkflowFocusViewer.jsx';
import OwnerSystemWorkflowGlobalBar from './OwnerSystemWorkflowGlobalBar.jsx';
import OwnerSystemWorkflowPanelLayer from './OwnerSystemWorkflowPanelLayer.jsx';
import useOwnerSystemWorkflowActivity from './useOwnerSystemWorkflowActivity.js';
import useOwnerSystemWorkflowController from './useOwnerSystemWorkflowController.js';
import useOwnerSystemWorkflowCrop from './useOwnerSystemWorkflowCrop.js';
import useOwnerSystemWorkflowFocusViewer from './useOwnerSystemWorkflowFocusViewer.js';
import useOwnerSystemWorkflowLayout from './useOwnerSystemWorkflowLayout.js';
import useOwnerSystemWorkflowPanels from './useOwnerSystemWorkflowPanels.js';
import useOwnerSystemWorkflowDevelopmentAuthorities from './useOwnerSystemWorkflowDevelopmentAuthorities.js';

function assetMap(assets, records) {
  const map = new Map();
  for (const asset of [...assets, ...records]) {
    const id = asset?.stableAssetId || asset?.id;
    if (id) map.set(id, { ...(map.get(id) || {}), ...asset });
  }
  return map;
}

function reviewIdentity(profileAddress, fixture) {
  if (!fixture) return null;
  return {
    address: profileAddress,
    normalizedAddress: profileAddress,
    name: fixture.name || 'RADAR VISUALS',
    avatarUrl: fixture.avatarUrl || null,
    description: fixture.description || null,
    tags: fixture.tags || [],
    links: fixture.links || [],
    profileImageCandidates: fixture.avatarUrl ? [{ kind: 'URL', url: fixture.avatarUrl, width: 96, source: 'DEVELOPMENT_FIXTURE' }] : [],
    backgroundImageCandidates: [],
    isUniversalProfile: true,
    metadataIntegrity: 'UNVERIFIED',
    status: 'RESOLVED',
    source: 'DEVELOPMENT_FIXTURE',
  };
}

const LAYERS_OPEN_KEY = 'inscape:system-workflow:layers-open';
const initialLayersOpen = () => {
  try { return globalThis.sessionStorage?.getItem(LAYERS_OPEN_KEY) !== 'false'; }
  catch { return true; }
};

export default function OwnerSystemWorkflowRuntime({ profileAddress, onVisitProfile, reviewStorage, reviewAssets,
  reviewCategories, reviewActivity, reviewDiscovery, reviewProfile }) {
  const controller = useOwnerSystemWorkflowController(profileAddress, { storage: reviewStorage });
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(initialLayersOpen);
  const [layersExplicitlyOpened, setLayersExplicitlyOpened] = useState(false);
  const previewReturnFocus = useRef(null);
  const layout = useOwnerSystemWorkflowLayout();
  const liveIdentity = useProfileIdentity(profileAddress, { sourceMode: reviewProfile ? 'FIXTURE' : 'LIVE' });
  const contractFacts = useProfileContractFacts(profileAddress, { enabled: !reviewProfile });
  const profileIdentity = reviewIdentity(profileAddress, reviewProfile) || liveIdentity;
  const rawAssets = useLibraryStore((state) => state.profileAddress === profileAddress ? state.assets : []);
  const browserEnabled = !reviewAssets;
  const reviewAuthorities = useOwnerSystemWorkflowDevelopmentAuthorities({ categories: reviewCategories, discovery: reviewDiscovery, enabled: Boolean(reviewAssets) });
  const panels = useOwnerSystemWorkflowPanels({ blocked: Boolean(preview || dossierOpen) });
  const panel = panels.activePanel;
  const browser = useOwnerLatticeBrowser(profileAddress, panel === 'library' && browserEnabled);
  const assets = reviewAssets || browser.data.assets;
  const records = reviewAssets || rawAssets;
  const assetsById = useMemo(() => assetMap(assets, records), [assets, records]);
  const crop = useOwnerSystemWorkflowCrop({ assetsById, controller });
  const viewer = useOwnerSystemWorkflowFocusViewer({ assetsById, controller, onOpen: () => panels.closePanel({ returnFocus: false }) });
  const activity = useOwnerSystemWorkflowActivity({ active: panel === 'activity', fixture: reviewActivity, profileAddress });
  const panelOccupied = Boolean(panel || Object.values(panels.presence).some(({ present }) => present));
  useEffect(() => {
    try { globalThis.sessionStorage?.setItem(LAYERS_OPEN_KEY, String(layersOpen)); }
    catch { /* Session preference is optional. */ }
  }, [layersOpen]);
  const gridTransitionRef = useRef(null);
  const changeGrid = (gridId, directionHint = null, options = {}) => {
    if (!gridId || gridId === controller.selectedGridId || gridTransitionRef.current) return false;
    const grids = controller.draft?.grids || [];
    const currentIndex = grids.findIndex(({ id }) => id === controller.selectedGridId);
    const nextIndex = grids.findIndex(({ id }) => id === gridId);
    if (nextIndex < 0) return false;
    const direction = directionHint || (nextIndex > currentIndex ? 'next' : 'previous');
    const commit = () => flushSync(() => controller.changeGrid(gridId));
    const transitionDocument = globalThis.document;
    if (options.animate === false || layout.reducedMotion || typeof transitionDocument?.startViewTransition !== 'function') {
      commit();
      return true;
    }
    const root = transitionDocument.documentElement;
    root.dataset.systemWorkflowGridDirection = direction;
    const transition = transitionDocument.startViewTransition(commit);
    gridTransitionRef.current = transition;
    const cleanup = () => {
      if (gridTransitionRef.current === transition) gridTransitionRef.current = null;
      delete root.dataset.systemWorkflowGridDirection;
    };
    transition.finished.then(cleanup, cleanup);
    return true;
  };
  const libraryData = useMemo(() => reviewAssets ? {
    assets: reviewAssets,
    categories: reviewAuthorities.categories || [],
    categoryOrganization: reviewAuthorities.categoryOrganization,
    favorites: [],
    ownerContext: profileAddress,
    readOnly: true,
    rejectedAssetCount: 0,
    status: 'ready',
    usedAssetIds: controller.selectedGrid?.placements.map(({ stableAssetId }) => stableAssetId) || [],
  } : browser.data, [browser.data, controller.selectedGrid, profileAddress, reviewAssets,
    reviewAuthorities.categories, reviewAuthorities.categoryOrganization]);
  const profileModel = useMemo(() => createProductionIdentityDossierViewModel({
    assetRecords: assetsById,
    contractFacts,
    identity: profileIdentity,
    identityPresentation: controller.draft?.identityPresentation,
  }), [assetsById, contractFacts, controller.draft?.identityPresentation, profileIdentity]);
  const publicationProfile = useMemo(() => ({
    name: profileIdentity?.status === 'RESOLVED' ? profileIdentity.name : null,
    avatarUrl: profileIdentity?.status === 'RESOLVED' ? profileIdentity.avatarUrl : null,
  }), [profileIdentity]);
  const closePreview = () => {
    setPreview(null);
    const node = previewReturnFocus.current;
    previewReturnFocus.current = null;
    requestAnimationFrame(() => node?.isConnected && node.focus({ preventScroll: true }));
  };
  const startPreview = async (trigger) => {
    previewReturnFocus.current = trigger;
    panels.closePanel({ returnFocus: false });
    try {
      const document = buildOwnerSystemWorkflowPreviewDocument({ assetRecords: records, profile: publicationProfile,
        profileAddress, systemWorkflowDraft: controller.draft });
      await preloadOwnerSystemWorkflowPreviewEntryMedia(document, reviewAssets ? { timeoutMs: 500 } : undefined);
      setPreview(document);
    } catch (error) {
      previewReturnFocus.current = null;
      setNotice(error?.message || 'Preview unavailable');
    }
  };
  const menuSurface = controller.draft?.appearance.menuSurfaceId;
  const workspaceSurfaceColor = latticeSurfaceColor(controller.draft?.appearance.surfaceId);
  return <><main aria-hidden={preview || undefined} className="system-workflow" data-canvas-context="canvas" data-layout={layout.mode}
    data-lattice-menu-surface data-menu-surface={menuSurface} data-reduced-motion={layout.reducedMotion || undefined}
    data-surface={controller.draft?.appearance.surfaceId} data-previewing={preview ? true : undefined} inert={preview ? '' : undefined}>
    <OwnerSystemWorkflowCanvas assetsById={assetsById} controller={controller} crop={crop} onChangeGrid={changeGrid}
      interactionDisabled={panelOccupied} onOpenViewer={(placement) => viewer.open(placement.id)}
      onPlacementRef={viewer.registerPlacement} reducedMotion={layout.reducedMotion} viewerPlacementId={viewer.placementId} />
    <OwnerSystemWorkflowPanelLayer activity={activity} assets={assets} assetsById={assetsById} browser={browser}
      controller={controller} crop={crop} layersOpen={layersOpen} layout={layout} libraryData={libraryData} menuSurface={menuSurface} onChangeGrid={changeGrid}
      workspaceSurfaceColor={workspaceSurfaceColor}
      onClose={() => panels.closePanel()} onDossierChange={setDossierOpen} onLayersOpenChange={(open) => {
        setLayersOpen(open);
        if (!open) setLayersExplicitlyOpened(false);
      }} onVisitProfile={onVisitProfile}
      panelOccupied={panelOccupied} panels={panels} profileIdentity={profileIdentity} profileModel={profileModel}
      categoryCommands={reviewAuthorities.categoryCommands || browser.commands} discoveryCommands={reviewAuthorities.discoveryCommands}
      discoveryGroups={reviewAuthorities.discoveryGroups} reviewDiscovery={reviewAuthorities.discovery} />
    {viewer.placementId && <OwnerSystemWorkflowFocusViewer menuSurface={menuSurface} viewer={viewer}
      workspaceSurfaceColor={workspaceSurfaceColor} />}
    <OwnerSystemWorkflowGlobalBar activePanel={panel}
      layersActivated={layersExplicitlyOpened && layersOpen && !panelOccupied}
      layersOpen={layersOpen && !panelOccupied}
      onOpen={(name, trigger) => panels.togglePanel(name, trigger)} onPreview={(event) => startPreview(event.currentTarget)}
      onToggleLayers={() => {
        if (panelOccupied) {
          panels.closePanel({ returnFocus: false });
          setLayersOpen(true);
          setLayersExplicitlyOpened(true);
          return;
        }
        const nextOpen = !layersOpen;
        setLayersOpen(nextOpen);
        setLayersExplicitlyOpened(nextOpen);
      }}
      unreadCount={activity.unreadCount} />
    {(controller.error || notice) && <button className="system-workflow__notice" onClick={() => setNotice(null)}>{controller.error || notice}</button>}
  </main>
  {preview && <ProfileDocumentV9Preview document={preview} onExit={closePreview} onReturn={closePreview}
    onOpenDirectory={() => {
      const trigger = previewReturnFocus.current;
      setPreview(null); previewReturnFocus.current = null;
      requestAnimationFrame(() => panels.openPanel('discover', trigger));
    }} />}
  </>;
}
