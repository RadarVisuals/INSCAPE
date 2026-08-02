import { useRef, useState } from 'react';
import Modul8rShell from './Modul8rShell.jsx';
import Modul8rLibraryAdapter from './Modul8rLibraryAdapter.jsx';

export default function Modul8rOwnerLibraryDevelopment({
  arrangeEnabled,
  categoryCommands,
  data,
  menuSurfaceId,
  onArrangeToggle,
  onAssetPointerDown,
  onRenderableAssetsChange,
}) {
  const [open, setOpen] = useState(true);
  const reopenRef = useRef(null);
  const libraryFaceplateAccessoryRef = useRef(null);
  const moduleContent = {
    library: <Modul8rLibraryAdapter categoryCommands={categoryCommands} data={data}
      faceplateTargetRef={libraryFaceplateAccessoryRef} onAssetPointerDown={onAssetPointerDown}
      onRenderableAssetsChange={onRenderableAssetsChange} />,
  };
  return open ? <Modul8rShell masterAccessory={<button aria-pressed={arrangeEnabled}
    onClick={onArrangeToggle} type="button">ARRANGE</button>}
    menuSurfaceId={menuSurfaceId} moduleContent={moduleContent}
    moduleFaceplateAccessoryRefs={{ library: libraryFaceplateAccessoryRef }}
    onRequestClose={() => setOpen(false)} returnFocusRef={reopenRef} />
    : <button className="modul8r-development-reopen" data-lattice-chrome onClick={() => setOpen(true)} ref={reopenRef} type="button">
      OPEN MODUL-8R{arrangeEnabled ? ' / ARRANGE ON' : ''}
    </button>;
}
