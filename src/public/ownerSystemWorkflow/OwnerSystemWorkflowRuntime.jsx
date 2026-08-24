import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  decodeOwnerSystemWorkflowAssetDimensions,
  ownerSystemWorkflowDecodedAsset,
} from './ownerSystemWorkflowAssetDimensions.js';

const OwnerSystemWorkflowPublicationRack = lazy(() => import('./OwnerSystemWorkflowPublicationRack.jsx'));

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

export default function OwnerSystemWorkflowRuntime({ getWalletPublicationContext, onPreviewDocumentChange,
  onPublicationConfirmed, profileAddress, publishedResolution, onVisitProfile, reviewStorage, reviewAssets,
  reviewCategories, reviewActivity, reviewDiscovery, reviewProfile }) {
  const controller = useOwnerSystemWorkflowController(profileAddress, { storage: reviewStorage });
  const [preview, setPreview] = useState(null);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(initialLayersOpen);
  const [layersExplicitlyOpened, setLayersExplicitlyOpened] = useState(false);
  const [decodedDimensions, setDecodedDimensions] = useState(() => new Map());
  const previewReturnFocus = useRef(null);
  const publicationReturnFocus = useRef(null);
  const layout = useOwnerSystemWorkflowLayout();
  const liveIdentity = useProfileIdentity(profileAddress, { sourceMode: reviewProfile ? 'FIXTURE' : 'LIVE' });
  const contractFacts = useProfileContractFacts(profileAddress, { enabled: !reviewProfile });
  const profileIdentity = reviewIdentity(profileAddress, reviewProfile) || liveIdentity;
  const rawAssets = useLibraryStore((state) => state.profileAddress === profileAddress ? state.assets : []);
  const browserEnabled = !reviewAssets;
  const reviewAuthorities = useOwnerSystemWorkflowDevelopmentAuthorities({ categories: reviewCategories, discovery: reviewDiscovery, enabled: Boolean(reviewAssets) });
  const panels = useOwnerSystemWorkflowPanels({ blocked: Boolean(preview || publicationOpen || dossierOpen) });
  const panel = panels.activePanel;
  const browser = useOwnerLatticeBrowser(profileAddress, panel === 'library' && browserEnabled);
  const assets = reviewAssets || browser.data.assets;
  const records = reviewAssets || rawAssets;
  const refineAsset = useCallback((asset) => ownerSystemWorkflowDecodedAsset(
    asset, decodedDimensions.get(asset?.stableAssetId || asset?.id),
  ), [decodedDimensions]);
  const resolvedAssets = useMemo(() => assets.map(refineAsset), [assets, refineAsset]);
  const canonicalRecords = useMemo(() => records.map(refineAsset), [records, refineAsset]);
  const assetsById = useMemo(() => assetMap(resolvedAssets, canonicalRecords), [canonicalRecords, resolvedAssets]);
  const registerAssetDimensions = useCallback((asset, dimensions) => {
    const id = asset?.stableAssetId || asset?.id;
    const refined = ownerSystemWorkflowDecodedAsset(asset, dimensions);
    if (!id || refined === asset) return null;
    const decoded = Object.freeze({
      source: refined.decodedImageSource,
      width: refined.decodedImageWidth,
      height: refined.decodedImageHeight,
    });
    setDecodedDimensions((current) => {
      const previous = current.get(id);
      if (previous?.source === decoded.source && previous.width === decoded.width && previous.height === decoded.height) return current;
      const next = new Map(current); next.set(id, decoded); return next;
    });
    return decoded;
  }, []);
  const resolveAssetDimensions = useCallback(async (asset) => {
    const decoded = await decodeOwnerSystemWorkflowAssetDimensions(asset);
    return decoded ? registerAssetDimensions(asset, decoded) : null;
  }, [registerAssetDimensions]);
  const crop = useOwnerSystemWorkflowCrop({ assetsById, controller });
  const viewer = useOwnerSystemWorkflowFocusViewer({ assetsById, controller,
    onOpen: () => panels.closePanel({ returnFocus: false }), resolveAssetDimensions });
  const activity = useOwnerSystemWorkflowActivity({ active: panel === 'activity', fixture: reviewActivity, profileAddress });
  const panelOccupied = Boolean(publicationOpen || panel || Object.values(panels.presence).some(({ present }) => present));
  const dismissNotice = useCallback(() => {
    controller.clearError();
    setNotice(null);
  }, [controller.clearError]);
  useEffect(() => {
    if (!controller.error && !notice) return undefined;
    const timeout = globalThis.setTimeout(dismissNotice, 4_500);
    return () => globalThis.clearTimeout(timeout);
  }, [controller.error, dismissNotice, notice]);
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
    assets: resolvedAssets,
    categories: reviewAuthorities.categories || [],
    categoryOrganization: reviewAuthorities.categoryOrganization,
    favorites: [],
    ownerContext: profileAddress,
    readOnly: true,
    rejectedAssetCount: 0,
    status: 'ready',
    usedAssetIds: controller.selectedGrid?.placements.map(({ stableAssetId }) => stableAssetId) || [],
  } : { ...browser.data, assets: resolvedAssets }, [browser.data, controller.selectedGrid, profileAddress, resolvedAssets,
    reviewAssets, reviewAuthorities.categories, reviewAuthorities.categoryOrganization]);
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
      const referencedIds = new Set(controller.draft.grids.flatMap((grid) => grid.placements.map(({ stableAssetId }) => stableAssetId)));
      const decodedEntries = await Promise.all([...referencedIds].map(async (id) => {
        const asset = assetsById.get(id);
        return [id, asset ? await resolveAssetDimensions(asset) : null];
      }));
      const previewDimensions = new Map(decodedEntries.filter(([, dimensions]) => dimensions));
      const previewRecords = records.map((asset) => ownerSystemWorkflowDecodedAsset(
        asset, previewDimensions.get(asset?.id) || decodedDimensions.get(asset?.id),
      ));
      const document = buildOwnerSystemWorkflowPreviewDocument({ assetRecords: previewRecords, profile: publicationProfile,
        profileAddress, systemWorkflowDraft: controller.draft });
      await preloadOwnerSystemWorkflowPreviewEntryMedia(document, reviewAssets ? { timeoutMs: 500 } : undefined);
      setPreview(document);
    } catch (error) {
      previewReturnFocus.current = null;
      setNotice(error?.message || 'Preview unavailable');
    }
  };
  const closePublication = () => {
    setPublicationOpen(false);
    const node = publicationReturnFocus.current;
    publicationReturnFocus.current = null;
    requestAnimationFrame(() => node?.isConnected && node.focus({ preventScroll: true }));
  };
  const togglePublication = (trigger) => {
    if (publicationOpen) {
      closePublication();
      return;
    }
    publicationReturnFocus.current = trigger;
    panels.closePanel({ returnFocus: false });
    setPublicationOpen(true);
  };
  const menuSurface = controller.draft?.appearance.menuSurfaceId;
  const workspaceSurfaceColor = latticeSurfaceColor(controller.draft?.appearance.surfaceId);
  return <><main aria-hidden={preview || publicationOpen || undefined} className="system-workflow" data-canvas-context="canvas" data-layout={layout.mode}
    data-lattice-menu-surface data-menu-surface={menuSurface} data-reduced-motion={layout.reducedMotion || undefined}
    data-surface={controller.draft?.appearance.surfaceId} data-previewing={preview ? true : undefined}
    inert={preview || publicationOpen ? '' : undefined}>
    <OwnerSystemWorkflowCanvas assetsById={assetsById} controller={controller} crop={crop}
      onAssetDimensions={registerAssetDimensions} onChangeGrid={changeGrid}
      interactionDisabled={panelOccupied} onOpenViewer={(placement) => viewer.open(placement.id)}
      onPlacementRef={viewer.registerPlacement} reducedMotion={layout.reducedMotion}
      resolveAssetDimensions={resolveAssetDimensions} viewerPlacementId={viewer.placementId} />
    <OwnerSystemWorkflowPanelLayer activity={activity} assets={assets} assetsById={assetsById} browser={browser}
      controller={controller} crop={crop} layersOpen={layersOpen} layout={layout} libraryData={libraryData} menuSurface={menuSurface} onChangeGrid={changeGrid}
      workspaceSurfaceColor={workspaceSurfaceColor}
      onClose={() => panels.closePanel()} onDossierChange={setDossierOpen} onLayersOpenChange={(open) => {
        setLayersOpen(open);
        if (!open) setLayersExplicitlyOpened(false);
      }} onVisitProfile={onVisitProfile}
      panelOccupied={panelOccupied} panels={panels} profileIdentity={profileIdentity} profileModel={profileModel}
      resolveAssetDimensions={resolveAssetDimensions}
      categoryCommands={reviewAuthorities.categoryCommands || browser.commands} discoveryCommands={reviewAuthorities.discoveryCommands}
      discoveryGroups={reviewAuthorities.discoveryGroups} reviewDiscovery={reviewAuthorities.discovery} />
    {viewer.placementId && <OwnerSystemWorkflowFocusViewer menuSurface={menuSurface} viewer={viewer}
      workspaceSurfaceColor={workspaceSurfaceColor} />}
    <OwnerSystemWorkflowGlobalBar activePanel={panel}
      layersActivated={layersExplicitlyOpened && layersOpen && !panelOccupied}
      layersOpen={layersOpen && !panelOccupied}
      onOpen={(name, trigger) => panels.togglePanel(name, trigger)} onPreview={(event) => startPreview(event.currentTarget)}
      onPublish={(event) => togglePublication(event.currentTarget)} publicationOpen={publicationOpen}
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
    {(controller.error || notice) && <button aria-label="Dismiss notification" className="system-workflow__notice"
      type="button" onClick={dismissNotice}>{controller.error || notice}</button>}
  </main>
  {preview && <ProfileDocumentV9Preview document={preview} onExit={closePreview} onReturn={closePreview}
    onOpenDirectory={() => {
      const trigger = previewReturnFocus.current;
      setPreview(null); previewReturnFocus.current = null;
      requestAnimationFrame(() => panels.openPanel('discover', trigger));
    }} />}
  {publicationOpen && <Suspense fallback={null}><OwnerSystemWorkflowPublicationRack
    assetRecords={canonicalRecords}
    getWalletPublicationContext={getWalletPublicationContext}
    menuSurface={menuSurface}
    onClose={closePublication}
    onPublished={() => onPublicationConfirmed?.()}
    onSnapshotChange={({ document }) => onPreviewDocumentChange?.(document)}
    profile={publicationProfile}
    profileAddress={profileAddress}
    publishedResolution={publishedResolution}
    systemWorkflowDraft={controller.draft}
  /></Suspense>}
  </>;
}
