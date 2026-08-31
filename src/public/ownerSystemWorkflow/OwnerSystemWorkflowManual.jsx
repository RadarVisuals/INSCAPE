import { useState } from 'react';
import { X } from 'lucide-react';

const chapters = Object.freeze([
  {
    id: 'canvas', label: 'Canvas', summary: 'Navigate Grids and arrange what appears in each space.',
    sections: [
      ['Grids', 'Each Grid is a separate profile space. Create, rename, reorder, hide or reveal them from Grids in the dock. Drag across the canvas to move between neighbouring Grids.'],
      ['Arrange', 'Select an item to move or resize it. Shift-click or marquee-select to work with several placements. Crop changes the visible area without distorting the source artwork.'],
      ['Layers', 'Open Layers from the dock to reorder, duplicate, lock or remove placements. Locked placements remain visible while the canvas stays available for selection around them.'],
      ['Appearance', 'Settings separates local Workbench background, grid and shortcut snapping from the Display Module appearance included when you publish. Display Module guide spacing is also the snapping interval used while authoring.'],
    ],
  },
  {
    id: 'library', label: 'Library', summary: 'Find, organise and place assets from your connected collection.',
    sections: [
      ['Place assets', 'Open Library, then hold and drag an asset onto the current Grid. The placement preview shows where it will land before release.'],
      ['Categories', 'Categories organise assets without changing their ownership or removing other memberships. An asset may belong to more than one category.'],
      ['Sections', 'Sections group related categories in the sidebar. Drag categories onto a section to build a clearer personal structure.'],
      ['Browse', 'Search, labels, thumbnail size, filters and sorting change only the current Library view. They do not alter the underlying asset.'],
    ],
  },
  {
    id: 'profile', label: 'Profile', summary: 'Review identity, signals and people without leaving the workspace.',
    sections: [
      ['Profile', 'The compact card keeps your identity close to the canvas. Expand it to inspect profile information, authored links and technical account data.'],
      ['Discover', 'Discover presents people and public profiles. Groups are personal organisation; opening a profile does not add it to a Grid.'],
      ['Activity', 'Activity shows recent profile, asset, social and LYX signals. Open the full history to search, filter, refresh or mark notifications as read.'],
    ],
  },
  {
    id: 'share', label: 'Share', summary: 'Check the visitor experience before anything becomes public.',
    sections: [
      ['Preview', 'Preview renders the visitor-facing projection of the current draft. Use it to verify visible Grids, profile presentation and artwork before publication.'],
      ['Visibility', 'A public Grid may appear in the visitor projection; a private Grid remains owner-only. Library categories and sections are never visitor navigation.'],
      ['Publish', 'Prepare and review one frozen public version 9 snapshot, then upload and verify its exact CID before any separately confirmed wallet publication.'],
    ],
  },
]);

export default function OwnerSystemWorkflowManual({ onClose }) {
  const [chapterId, setChapterId] = useState('index');
  const chapter = chapters.find(({ id }) => id === chapterId);
  const isAbout = chapterId === 'about';
  return <aside aria-label="Docs" className="system-workflow__manual system-workflow__motion-panel" role="dialog">
    <div className="system-workflow__manual-body">
      {chapter ? <>
        <section className="system-workflow__manual-chapter-intro"><h2>{chapter.label}</h2><p>{chapter.summary}</p></section>
        {chapter.sections.map(([title, description]) => <section key={title}><h2>{title}</h2><p>{description}</p></section>)}
      </> : isAbout ? <>
        <section className="system-workflow__manual-index-intro"><h2>What is Inscape?</h2><p>Inscape is a creative environment for shaping how your identity, artwork and digital world are experienced.</p><p>Arrange assets across Grids, build a presentation that feels like your own and decide what visitors can see. Everything begins in this workspace and stays under your control.</p></section>
      </> : <>
        <section className="system-workflow__manual-chapter-intro"><h2>Index</h2><p>Choose a chapter for a clear overview of what each part of Inscape does.</p></section>
        <nav aria-label="Documentation index" className="system-workflow__manual-index">
          {chapters.map(({ id, label, summary }) => <button key={id} onClick={() => setChapterId(id)} type="button"><span><b>{label}</b><em>{summary}</em></span></button>)}
        </nav>
      </>}
    </div>
    <footer aria-label="Documentation chapters">
      <button aria-pressed={chapterId === 'index'} onClick={() => setChapterId('index')} type="button">Index</button>
      <button aria-pressed={isAbout} onClick={() => setChapterId('about')} type="button">What?</button>
      {chapters.map(({ id, label }) => <button aria-pressed={chapterId === id} key={id} onClick={() => setChapterId(id)} type="button">{label}</button>)}
      <button aria-label="Close Docs" className="system-workflow__manual-close" onClick={onClose} title="Close" type="button"><X size={15} /></button>
    </footer>
  </aside>;
}
