import { openWorkbenchIndex } from '../../systemWorkflow/workbenchIndexSession.js';
import { addMiniApp } from '../../miniApps/miniAppSession.js';
import { MAX_MINI_APPS } from '../../miniApps/domain/miniApps.js';
import { addTextModule } from '../../text/textSession.js';
import { MAX_TEXT_MODULES } from '../../text/domain/article.js';
import { addImageModule } from '../../imageModule/imageModuleSession.js';
import { MAX_IMAGE_MODULES } from '../../imageModule/imageModule.js';
import { MAX_SHAPES, isShapeCommand, SHAPE_COMMAND_KINDS } from '../../shapes/shapes.js';
import { addShape } from '../../shapes/shapeSession.js';
import { MAX_KEEPER_DOCKS } from '../../keeper/keeper.js';
import { addKeeperDock } from '../../keeper/keeperSession.js';
import { removeWorkbenchModule } from '../../systemWorkflow/removeWorkbenchModule.js';
import { textRecoveries, TEXT_RECOVERY_MESSAGE } from '../../text/textEditRecovery.js';

// Receives the active composition's scoped writer and explicit host actions.
// Module sessions keep validation, persistence and undo authority.
export default function workbenchCommands({
  store,
  draft,
  profileAddress,
  workspaceRef,
  setNotice,
  activateArtwork,
  setTextToolsOpen,
  revealInstruments,
  changeTool,
  toggleLibrary,
  openIdentity,
  openDockPanel,
  openPreview,
  togglePublication,
  setWorkbenchPreferences,
  setWorkspaceMenu,
}) {
  const deleteDisplay = expected => {
    try {
      if (textRecoveries(store, profileAddress).length) {
        setNotice(TEXT_RECOVERY_MESSAGE);
        return;
      }
      if (!removeWorkbenchModule(store, profileAddress, 'display', expected)) {
        setNotice('Could not delete this Display. Reopen its menu and try again.');
        return;
      }
      requestAnimationFrame(() => workspaceRef.current?.focus());
    } catch (error) {
      setNotice(error.message || 'Could not delete this Display');
    }
  };
  // One creation menu/dispatcher serves both the context menu and toolbar.
  const addCommands = [
    { id: 'workbench-index', label: draft.workbenchIndex ? 'OPEN INDEX' : 'INDEX' },
    {
      disabled: (draft.miniApps?.length || 0) >= MAX_MINI_APPS,
      id: 'mini-app',
      label: 'MINI APP',
    },
    {
      disabled: (draft.texts?.length || 0) >= MAX_TEXT_MODULES,
      id: 'text',
      label: 'TEXT',
    },
    {
      disabled: (draft.imageModules?.length || 0) >= MAX_IMAGE_MODULES,
      id: 'image',
      label: 'IMAGE',
    },
    { disabled: (draft.shapes?.length || 0) >= MAX_SHAPES, id: 'shape', label: 'SHAPE' },
    {
      disabled: (draft.shapes?.length || 0) >= MAX_SHAPES,
      id: 'shape-grid',
      label: 'GRID SHAPE',
    },
    {
      disabled: (draft.keeperDocks?.length || 0) >= MAX_KEEPER_DOCKS,
      id: 'keeper',
      label: 'KEEPER DOCK',
    },
  ];
  const runCommand = (id, placement) => {
    try {
      switch (id) {
        case 'workbench-index':
          openWorkbenchIndex(store, profileAddress);
          break;
        case 'mini-app':
          addMiniApp(store, profileAddress);
          break;
        case 'text':
          activateArtwork(addTextModule(store, profileAddress, placement));
          setTextToolsOpen(true);
          break;
        case 'keeper':
          addKeeperDock(store, profileAddress);
          break;
        case 'image':
          activateArtwork(addImageModule(store, profileAddress));
          break;
        default:
          if (isShapeCommand(id))
            activateArtwork(
              addShape(store, profileAddress, {
                ...placement,
                kind: SHAPE_COMMAND_KINDS[id],
              })
            );
      }
    } catch (error) {
      setNotice(error.message);
    }
    if (id === 'tool-layers' || id === 'tool-metadata') {
      revealInstruments();
      changeTool({ type: 'open', tab: id === 'tool-metadata' ? 'Info' : 'Layers' });
    }
    if (id === 'library') toggleLibrary();
    if (id === 'identity') openIdentity(workspaceRef.current);
    if (id === 'discover') openDockPanel('discover', workspaceRef.current);
    if (id === 'preview') openPreview(workspaceRef.current);
    if (id === 'publish') togglePublication(workspaceRef.current);
    if (id.startsWith('shape:')) activateArtwork(id);
    if (id === 'toggle-dock') {
      setWorkbenchPreferences(current => ({ ...current, dockVisible: !current.dockVisible }));
      requestAnimationFrame(() => workspaceRef.current?.focus());
    }
    setWorkspaceMenu(null);
  };

  return { addCommands, runCommand, deleteDisplay };
}
