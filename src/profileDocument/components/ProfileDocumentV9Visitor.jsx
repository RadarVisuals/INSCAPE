import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SceneNavigationProvider } from '../../text/SceneNavigation.jsx';
import { WorkbenchViewProvider, WorkbenchViewControls, useWorkbenchActions } from '../../public/ownerSystemWorkflow/WorkbenchView.jsx';
import { useWorkbenchInspectionAction } from '../../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { useProfileContractFacts, useProfileIdentity } from '../../profileIdentity/index.js';
import LatticeProfileRail from '../../lattice/rendering/LatticeProfileRail.jsx';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import PresentationBoard from '../../public/ownerSystemWorkflow/PresentationBoard.jsx';
import { SharedDisplayToolsProvider, SharedDisplayToolWindows, SharedDisplayToolsLauncher } from '../../public/ownerSystemWorkflow/SharedDisplayTools.jsx';
import useOwnerSystemWorkflowLayout from '../../public/ownerSystemWorkflow/useOwnerSystemWorkflowLayout.js';
import PublishedDisplayModule from './PublishedDisplayModule.jsx';
import { publicDisplayModules } from './profileOverviewModel.js';
import VisitorEntryFocus from './VisitorEntryFocus.jsx';
import '../../lattice/rendering/latticeMenuSurface.css';
import '../../public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import './visitorGridWorld.css';

const IdentityModule = lazy(() => import('../../public/identity/IdentityModule.jsx'));
const MiniAppsWorkbench = lazy(() => import('../../miniApps/MiniAppsWorkbench.jsx'));
const ImageWorkbench = lazy(() => import('../../imageModule/ImageWorkbench.jsx'));
const ShapeWorkbench = lazy(() => import('../../shapes/ShapeWorkbench.jsx'));
const KeeperWorkbench = lazy(() => import('../../keeper/KeeperWorkbench.jsx'));
const TextWorkbench = lazy(() => import('../../text/TextWorkbench.jsx'));
const compactAddress = (address) => `${address.slice(0, 10)}…${address.slice(-6)}`;


export default function ProfileDocumentV9Visitor(props) {
  return <SharedDisplayToolsProvider key={[props.document.profile.address, props.document.documentId, props.document.revision].join(':')}><SceneNavigationProvider><WorkbenchViewProvider groupContent={props.document}><ProfileDocumentV9Session {...props} /><VisitorEntryFocus target={props.entryTarget} /></WorkbenchViewProvider></SceneNavigationProvider></SharedDisplayToolsProvider>;
}

function CanvasDisplay({ item, entryTarget, active, onActivate, navigationHost, reducedMotion, open, onOpenChange, layoutMode, onInspectionChange }) {
  const module = useRef(null);
  const { focusModules } = useWorkbenchActions();
  useWorkbenchInspectionAction(item.id, source => module.current?.inspect(source));
  return <PublishedDisplayModule ref={module} document={item.document} instanceId={item.id}
    Frame={PresentationBoard} frameProps={{ layoutMode }} entryTarget={entryTarget} active={active} onActivate={onActivate}
    onFocusModule={id => focusModules?.([id])} open={open} onOpenChange={onOpenChange}
    onInspectionChange={onInspectionChange} navigationHost={navigationHost} reducedMotion={reducedMotion} />;
}

function ProfileDocumentV9Session({ document, onExit, onOpenDirectory, onReturn, onConnect, entryTarget }) {
  useStartupDestinationReady();
  const rootRef = useRef(null), identityControlRef = useRef(null), profileDockControlRef = useRef(null);
  const [navigationHost, setNavigationHost] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  useEffect(() => { rootRef.current?.focus({ preventScroll: true }); }, []);
  const [activeDisplay, setActiveDisplay] = useState(entryTarget?.moduleId?.startsWith('display:') ? entryTarget.moduleId : 'display:primary');
  const displays = useMemo(() => publicDisplayModules(document), [document]);
  const [openDisplays, setOpenDisplays] = useState(() => Object.fromEntries(displays.map(item => [item.id,
    entryTarget?.moduleId === item.id || item.document.workbench?.display.open !== false])));
  const setOpen = (id, value) => setOpenDisplays(current => ({ ...current, [id]: value }));
  const layout = useOwnerSystemWorkflowLayout();
  const [profileVisible, setProfileVisible] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(Boolean(document.workbench?.identity.open));
  const [identityWindow, setIdentityWindow] = useState(document.workbench?.identity.window);
  const changeIdentityWindow = useCallback(({ left, top, width }) => setIdentityWindow(current =>
    current?.left === left && current?.top === top && current?.width === width ? current : { left, top, width }), []);
  const profileIdentity = useProfileIdentity(document.profile.address);
  const profileContractFacts = useProfileContractFacts(document.profile.address, { enabled: identityOpen });
  const identityRack = useMemo(() => createPublishedIdentityRackViewModel({
    contractFacts: profileContractFacts, document, identity: profileIdentity,
  }), [document, profileContractFacts, profileIdentity]);
  const officialIdentity = useMemo(() => ({
    avatarUrl: identityRack?.profile.avatarUrl || document.profile.cachedIdentity.avatarUrl || null,
    displayName: identityRack?.profile.displayName || document.profile.cachedIdentity.name
      || document.identityPresentation.alias || 'UNNAMED PROFILE',
    secondaryLabel: compactAddress(document.profile.address),
  }), [document, identityRack]);

  const closeProfile = useCallback(({ returnFocus = false } = {}) => {
    setProfileVisible(false);
    if (returnFocus) queueMicrotask(() => profileDockControlRef.current?.focus({ preventScroll: true }));
  }, []);
  const toggleProfile = useCallback(() => {
    if (profileVisible) closeProfile();
    else setProfileVisible(true);
  }, [closeProfile, profileVisible]);
  useEffect(() => {
    if (!profileVisible) return undefined;
    const handlePointerDown = (event) => {
      if (event.target?.closest?.('.lattice-profile-rail, .identity-module, [data-visitor-profile-trigger]')) return;
      closeProfile();
    };
    const handleEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault(); closeProfile({ returnFocus: true });
    };
    globalThis.addEventListener?.('pointerdown', handlePointerDown);
    globalThis.addEventListener?.('keydown', handleEscape);
    return () => {
      globalThis.removeEventListener?.('pointerdown', handlePointerDown);
      globalThis.removeEventListener?.('keydown', handleEscape);
    };
  }, [closeProfile, profileVisible]);

  const openIdentityRack = () => { if (identityRack) { setIdentityOpen(true); setProfileVisible(false); } };
  return <main ref={rootRef} tabIndex={-1} className="visitor-grid-world system-workflow" data-workbench data-layout={layout.mode}
    aria-label="Published INSCAPE Grid visitor" data-lattice-menu-surface data-guide-mode={document.appearance.guideMode}
    data-menu-surface={document.appearance.menuSurfaceId} data-surface={document.appearance.surfaceId}>
    <WorkbenchViewControls entryTarget={entryTarget} hostRef={rootRef} />
    {displays.map(item => <CanvasDisplay key={item.id} item={item} entryTarget={entryTarget}
      active={activeDisplay === item.id} onActivate={() => setActiveDisplay(item.id)}
      open={openDisplays[item.id]} onOpenChange={value => setOpen(item.id, value)}
      navigationHost={activeDisplay === item.id ? navigationHost : null} reducedMotion={layout.reducedMotion}
      layoutMode={layout.mode} onInspectionChange={activeDisplay === item.id ? setInspecting : undefined} />)}
    <SharedDisplayToolWindows readOnly menuSurface={document.appearance.menuSurfaceId} />
    {profileVisible && <LatticeProfileRail blocked={inspecting} identityDisabled={inspecting} collapsed entries={[]} identityControlRef={identityControlRef} identityOnly
      identityExpanded={identityOpen} officialIdentity={officialIdentity} onIdentityActivate={openIdentityRack} />}
    <footer className="visitor-grid-world__dock"><nav aria-label="Published profile navigation">
      <SharedDisplayToolsLauncher readOnly menuSurface={document.appearance.menuSurfaceId} />
      <button aria-expanded={document.workbench ? identityOpen : profileVisible} aria-label="Profile" data-visitor-profile-trigger
        disabled={inspecting}
        onClick={document.workbench ? () => setIdentityOpen(current => !current) : toggleProfile} ref={profileDockControlRef} type="button">PROFILE</button>
      {displays.filter(item => !openDisplays[item.id]).map(item => <button key={item.id} aria-label={item.id === 'display:primary' ? 'Open Display' : 'Open ' + item.title}
        onClick={() => { setOpen(item.id, true); setActiveDisplay(item.id); }} type="button">{item.title}</button>)}
      <div className="visitor-grid-world__display-navigation" ref={setNavigationHost} />
      {(onOpenDirectory || onReturn || onExit) && <div className="visitor-grid-world__actions">
        {onOpenDirectory && <button onClick={onOpenDirectory} type="button">DISCOVER</button>}
        {onReturn && <button onClick={onReturn} type="button">RETURN</button>}
        {onExit && <button onClick={onExit} type="button">EXIT</button>}
      </div>}
    </nav><strong aria-label="INSCAPE" className="visitor-grid-world__brand"><span aria-hidden="true" /></strong></footer>
    {identityOpen && identityRack && <div hidden={inspecting}><Suspense fallback={<p role="status">Opening Identity…</p>}>
      <IdentityModule key={document.profile.address} model={identityRack} menuSurface={document.appearance.menuSurfaceId}
        initialWindow={identityWindow} onWindowChange={document.workbench ? changeIdentityWindow : undefined}
        onClose={() => setIdentityOpen(false)} returnFocus={profileDockControlRef.current} />
    </Suspense></div>}
    {document.keeperDocks?.length > 0 && <Suspense fallback={null}>
      <KeeperWorkbench records={document.keeperDocks} presentations={document.workbench?.keeperDocks} profileAddress={document.profile.address}
        hostRef={rootRef} reducedMotion={layout.reducedMotion} />
    </Suspense>}
    {document.shapes?.length > 0 && <Suspense fallback={null}>
      <ShapeWorkbench records={document.shapes} presentations={document.workbench?.shapes} profileAddress={document.profile.address} />
    </Suspense>}
    {document.imageModules?.length > 0 && <Suspense fallback={<p role="status">Opening Image…</p>}>
      <ImageWorkbench initiallyOpenId={entryTarget?.moduleId} records={document.imageModules} presentations={document.workbench?.imageModules} profileAddress={document.profile.address} />
    </Suspense>}
    {document.texts?.length > 0 && <Suspense fallback={<p role="status">Opening Text…</p>}>
      <TextWorkbench initiallyOpenId={entryTarget?.moduleId} records={document.texts} presentations={document.workbench?.texts} profileAddress={document.profile.address} />
    </Suspense>}
    {document.miniApps?.length > 0 && <Suspense fallback={<p role="status">Opening mini apps…</p>}>
      <MiniAppsWorkbench records={document.miniApps} presentations={document.workbench?.miniApps}
        profileAddress={document.profile.address} onConnect={onConnect} />
    </Suspense>}

  </main>;
}
