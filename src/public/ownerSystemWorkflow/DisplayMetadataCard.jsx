import { useId, useRef, useState } from 'react';
import { Settings, FileText, Tag, Layers3, ExternalLink } from '../InscapeIcons.jsx';
import { MetadataCreator } from './OwnerSystemWorkflowMetadataModule.jsx';
import './displayMetadataCard.css';
import useDisplayCueGesture from './useDisplayCueGesture.js';

const tabs = ['Info', 'Attributes', 'Details'];
const tabIcons = { Info: FileText, Attributes: Tag, Details: Layers3 };

export default function DisplayMetadataCard({ dossier, collapseControl, collapseSide = 'left', upward = false, movement, settings }) {
  const gesture = useDisplayCueGesture(movement);
  const [tab, setTab] = useState('Info');
  const [expanded, setExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const id = useId();
  const buttons = useRef({});
  const description = dossier?.description || 'No description provided.';
  const long = description.length > 180;
  const excerpt = long ? description.slice(0, 180).replace(/\s+\S*$/, '') : description;
  const technical = [
    ...(dossier?.title ? [{ label: 'Artwork', value: dossier.title }] : []),
    ...(dossier?.collection ? [{ label: 'Collection', value: dossier.collection }] : []),
    ...(dossier?.creators || []).filter(creator => creator.address).map(creator => ({ label: 'Creator address', value: creator.address })),
    ...(dossier?.technical || []),
  ];
  const switchTab = value => { setTab(value); setSettingsOpen(false); };
  const navigateTabs = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const index = tabs.indexOf(tab);
    const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1)
      : tabs[(index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length];
    switchTab(next); buttons.current[next]?.focus();
  };
  return <div className="display-metadata" data-upward={upward || undefined}>
    <header className="display-metadata__controls" data-collapse-side={collapseSide} data-movable={movement.editable || undefined}
      {...gesture}
      onPointerDown={event => {
        if (!event.target.closest('button, a, input, select')) gesture.onPointerDown(event);
      }}
      onKeyDown={event => {
        if (event.target === event.currentTarget) gesture.onKeyDown(event);
      }}>
      {collapseControl}
      <nav className="display-metadata__tabs" role="tablist" aria-label="Artwork information">
        {tabs.map(value => {
          const Icon = tabIcons[value];
          return <button key={value} type="button" role="tab" id={`${id}-${value}-tab`} aria-label={value} title={value}
            aria-selected={!settingsOpen && value === tab} aria-controls={`${id}-${value}`} tabIndex={value === tab ? 0 : -1}
            ref={node => { buttons.current[value] = node; }} onClick={() => switchTab(value)} onKeyDown={navigateTabs}><Icon /></button>;
        })}
      </nav>
      {settings && <button type="button" aria-label="Metadata cue settings" aria-expanded={settingsOpen}
        title="Cue settings" aria-controls={`${id}-settings`} onClick={() => setSettingsOpen(value => !value)}><Settings /></button>}
    </header>
    <div className="display-metadata__body" key={settingsOpen ? 'settings' : tab}>
      {settings && settingsOpen && <section className="display-metadata__settings" aria-label="Cue settings" id={`${id}-settings`}>{settings}</section>}
      {tabs.map(panel => <div key={panel} role="tabpanel" id={`${id}-${panel}`} aria-labelledby={`${id}-${panel}-tab`} tabIndex={0} hidden={settingsOpen || tab !== panel}>
        {panel === 'Info' && <>
          <p className="display-metadata__description">{expanded ? description : excerpt}
            {long && <> <button type="button" className="display-metadata__more" aria-expanded={expanded}
              onClick={() => setExpanded(value => !value)}>{expanded ? 'Less' : '… more'}</button></>}
          </p>
          <section className="display-metadata__creators" aria-label="Creators">
            <h3>{dossier?.creators?.length > 1 ? 'Creators' : 'Creator'}</h3>
            {dossier?.creators?.length ? dossier.creators.map((creator, index) =>
              <MetadataCreator key={`${creator.address}-${index}`} creator={creator} compactView />) : <MetadataCreator compactView />}
          </section>
        </>}
        {panel === 'Attributes' && (dossier?.traits?.length ? <dl className="display-metadata__facts">
          {dossier.traits.map((trait, index) => <div key={index}><dt>{trait.label}</dt><dd>{trait.value}</dd></div>)}
        </dl> : <p className="display-metadata__empty">No attributes provided.</p>)}
        {panel === 'Details' && <>
          <dl className="display-metadata__facts display-metadata__facts--details">
            {technical.map((entry, index) => <div key={index}><dt>{entry.label}</dt><dd>
              {entry.href ? <a href={entry.href} target="_blank" rel="noreferrer">{entry.value} <ExternalLink size={12} /></a> : entry.value}
              {entry.provenance && <small>{entry.provenance}</small>}
            </dd></div>)}
          </dl>
          {dossier?.assetDetailHref && <a className="display-metadata__source" href={dossier.assetDetailHref} target="_blank" rel="noreferrer">View asset source <ExternalLink size={12} /></a>}
          {!technical.length && !dossier?.assetDetailHref && <p className="display-metadata__empty">No source details available.</p>}
        </>}
      </div>)}
    </div>
  </div>;
}
