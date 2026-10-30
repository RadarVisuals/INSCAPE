import { useState } from 'react';
import { displayContent, displayModuleIds } from '../systemWorkflow/domain/displayModules.js';
import { ReceptionButton } from './ReceptionControls.jsx';

const encode = value => value ? JSON.stringify(value) : '';
export function receptionSourceChoices(snapshot) {
  return snapshot.entries.flatMap(entry => {
    const reference = moduleId => ({ profileAddress: snapshot.profileAddress.toLowerCase(), canvasId: entry.id, moduleId });
    return [
      ...displayModuleIds(entry.draft).map(id => ({ reference: reference(id), label: `${entry.name} / ${entry.draft.workbench?.displays?.find(item => item.id === id)?.name || (id === 'display:primary' ? entry.draft.workbench?.display?.name : '') || 'Display'}`, kind: 'display',
        grids: displayContent(entry.draft, id).grids.filter(grid => grid.id !== 'grid:world-cover') })),
      ...(entry.draft.imageModules || []).flatMap(record => record.sides.map((side, index) => ({ reference: { ...reference(record.id), sideId: side.id },
        label: `${entry.name} / ${record.name || 'Image'}${record.sides.length > 1 ? ` / Side ${index + 1}` : ''}`, kind: 'image' }))),
      ...(entry.draft.texts || []).flatMap(record => {
        const label = `${entry.name} / ${record.article.title || 'Untitled Text'}`;
        const grids = record.sceneLink && displayModuleIds(entry.draft).includes(record.sceneLink.displayId)
          ? displayContent(entry.draft, record.sceneLink.displayId).grids.filter(grid => grid.id !== 'grid:world-cover') : [];
        return [{ reference: reference(record.id), label, kind: 'text' }, ...grids.map(grid => ({
          reference: { ...reference(record.id), gridId: grid.id }, label: `${label} / ${grid.title || 'Untitled scene'}`, kind: 'text' }))];
      }),
    ];
  });
}
export default function ReceptionLinkEditor({ snapshot, link, onSave }) {
  const options = receptionSourceChoices(snapshot);
  const [kind, setKind] = useState(link?.kind || 'source');
  const [source, setSource] = useState(encode(link?.source));
  const [controller, setController] = useState(encode(link?.controller));
  const [sources, setSources] = useState(link?.sources || {});
  const [destination, setDestination] = useState(encode(link?.destination));
  const selected = options.find(item => encode(item.reference) === controller);
  const choices = (values, current) => <><option value="">Choose content</option>
    {current && !values.some(item => encode(item.reference) === current) && <option value={current}>Unavailable source — choose again</option>}
    {values.map(item => <option key={encode(item.reference)} value={encode(item.reference)}>{item.label}</option>)}</>;
  const ready = kind === 'source' ? options.some(item => encode(item.reference) === source)
    : selected?.grids.length && selected.grids.every(grid => options.some(item => item.kind !== 'display' && encode(item.reference) === encode(sources[grid.id])));
  const destinations = snapshot.entries.flatMap(entry => [{ reference: { profileAddress: snapshot.profileAddress.toLowerCase(), canvasId: entry.id }, label: entry.name },
    ...(entry.draft.workbenchIndex?.destinations || []).map(point => ({ reference: { profileAddress: snapshot.profileAddress.toLowerCase(), canvasId: entry.id, destinationId: point.id }, label: `${entry.name} / ${point.name}` }))]);
  return <div className="reception-link-editor">
    <p>Use content from a canvas. Changes to its source appear here too.</p>
    <label className="reception-field">Cell behavior<select aria-label="Cell behavior" value={kind} onChange={event => setKind(event.target.value)}>
      <option value="source">Show content</option><option value="scene">Follow a Display</option></select></label>
    {kind === 'source' ? <label className="reception-field">Content<select aria-label="Linked content" value={source} onChange={event => setSource(event.target.value)}>{choices(options, source)}</select></label>
      : <><label className="reception-field">Display<select aria-label="Linked Display" value={controller} onChange={event => { setController(event.target.value); setSources({}); }}>{choices(options.filter(item => item.kind === 'display'), controller)}</select></label>
        {selected?.grids.map(grid => <label key={grid.id} className="reception-field">{grid.title || 'Untitled scene'}<select aria-label={`Content for ${grid.title || grid.id}`} value={encode(sources[grid.id])}
          onChange={event => setSources({ ...sources, [grid.id]: event.target.value ? JSON.parse(event.target.value) : null })}>{choices(options.filter(item => item.kind !== 'display'), encode(sources[grid.id]))}</select></label>)}
      </>}
    <label className="reception-field">Open canvas button<select aria-label="Open canvas destination" value={destination} onChange={event => setDestination(event.target.value)}>
      <option value="">No button</option>{destinations.map(item => <option key={encode(item.reference)} value={encode(item.reference)}>{item.label}</option>)}</select></label>
    <ReceptionButton disabled={!ready} onClick={() => onSave({ id: link?.id || `link:${crypto.randomUUID()}`, kind,
      ...(kind === 'source' ? { source: JSON.parse(source) } : { controller: JSON.parse(controller), sources: Object.fromEntries(selected.grids.map(grid => [grid.id, sources[grid.id]])) }),
      destination: destination ? JSON.parse(destination) : null })}>Save link</ReceptionButton>
  </div>;
}
