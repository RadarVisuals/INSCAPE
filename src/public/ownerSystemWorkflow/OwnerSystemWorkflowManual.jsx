import { useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

const chapters = [
  { id: 'workbench', label: 'Workbench', summary: 'Your desktop for composing and presenting your work.', sections: [
    ['Modules', 'Display holds your artwork compositions. Identity holds your custom profile card. Each opens in its own window on the Workbench.'],
    ['Windows and shortcuts', 'Drag a window by its header to move it. Minimize Display to its shortcut, then double-click the shortcut to reopen it. Closing Identity keeps its content; open it again from your profile controls.'],
    ['Your tools', 'Library, Layers and Activity belong to your private workspace. Discover lets you visit other profiles. Settings includes local Workbench preferences and the Display appearance used in your presentation.'],
  ] },
  { id: 'display', label: 'Display', summary: 'Compose artwork across Grids inside the Display Module.', sections: [
    ['Grids', 'Use Grids to create, name and order scenes within Display. Mark each Grid public or private. Visitors can navigate the public scenes.'],
    ['Arrange artwork', 'Drag an asset from Library onto the Stage. Select a placement to move or resize it. Shift-click or drag a selection rectangle to select several. Crop adjusts the visible area of the artwork.'],
    ['Layers', 'Open Layers from Display to reorder, duplicate, lock or remove placements. Removing a placement leaves the source asset in your Library.'],
    ['Stage and window', 'The Stage keeps its composition proportions when the Display window changes size. Moving the window changes its position on the Workbench; it does not move artwork within a Grid.'],
  ] },
  { id: 'identity', label: 'Identity', summary: 'Give your profile its own presentation.', sections: [
    ['Edit on the card', 'Use the cogwheel to edit the card in place. Choose its artwork and background, write your bio and tags, and add text or list cells. Save applies your changes; Cancel discards that edit.'],
    ['Expand', 'The chevron reveals the information cells in one step. The card fits the content shown, and its animated background continues as you open and close the details.'],
    ['Profile and account', 'The dock shows your Universal Profile identity. The custom card is your authored presentation inside Identity. Editing it does not rename your Universal Profile.'],
    ['Share an address', 'The copy and QR controls share your profile address. The QR currently contains the address itself, rather than a link that opens your INSCAPE page.'],
  ] },
  { id: 'library', label: 'Library', summary: 'Find and organise the assets you work with.', sections: [
    ['Place assets', 'Drag an asset onto the Display Stage to create a placement. The placement preview shows where it will land.'],
    ['Categories and sections', 'Categories organise assets without changing ownership. An asset may belong to several categories. Sections group related categories in the sidebar.'],
    ['Browse', 'Search, filters, sorting and thumbnail size change the Library view. Your Library organisation stays private when you publish.'],
  ] },
  { id: 'publish', label: 'Publish', summary: 'Review the experience visitors will enter.', sections: [
    ['Preview', 'Preview shows your current public Display content and custom Identity card, with the current window arrangement. Check both expanded content and smaller screens.'],
    ['Prepare', 'Arrange the windows and decide which should start open. Prepare Publication saves that starting setup and freezes a snapshot for review, including the Display name and shortcut. Preparing does not upload or ask your wallet to publish.'],
    ['Make it public', 'The next action uploads and verifies the prepared presentation. Publishing the verified result to your profile is a separate wallet action. Later edits need a new preparation and publication.'],
    ['What visitors receive', 'Public Grids, the Identity card and the prepared Workbench setup are included. Private Grids, Library organisation, Layers tools and Activity stay private. Visitors can explore and rearrange their session without changing your saved work.'],
  ] },
];

export default function OwnerSystemWorkflowManual({ onClose }) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const tabs = useRef([]);
  const id = useId();
  const chapter = chapters[chapterIndex];
  const selectWithKeyboard = (event, index) => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? chapters.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % chapters.length
        : event.key === 'ArrowLeft' ? (index + chapters.length - 1) % chapters.length : null;
    if (next === null) return;
    event.preventDefault();
    setChapterIndex(next);
    tabs.current[next]?.focus();
  };
  return <aside aria-label="Docs" className="system-workflow__manual system-workflow__motion-panel" role="dialog">
    <header className="system-workflow__manual-header">
      <div aria-label="Documentation chapters" role="tablist">
        {chapters.map(({ id: chapterId, label }, index) => <button
          aria-controls={`${id}-panel`} aria-selected={index === chapterIndex} id={`${id}-${chapterId}`}
          key={chapterId} onClick={() => setChapterIndex(index)} onKeyDown={event => selectWithKeyboard(event, index)}
          ref={node => { tabs.current[index] = node; }} role="tab" tabIndex={index === chapterIndex ? 0 : -1} type="button">{label}</button>)}
      </div>
      <button aria-label="Close Docs" className="system-workflow__manual-close" onClick={onClose} type="button"><X size={15} /></button>
    </header>
    <div aria-labelledby={`${id}-${chapter.id}`} className="system-workflow__manual-body" id={`${id}-panel`} key={chapter.id} role="tabpanel" tabIndex={0}>
      <section className="system-workflow__manual-chapter-intro"><h2>{chapter.label}</h2><p>{chapter.summary}</p></section>
      {chapter.sections.map(([title, description]) => <section key={title}><h2>{title}</h2><p>{description}</p></section>)}
    </div>
  </aside>;
}
