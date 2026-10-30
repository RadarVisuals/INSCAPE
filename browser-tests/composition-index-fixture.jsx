import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import WorkbenchOverview from '../src/public/workbenchOverview/WorkbenchOverview.jsx';
import { workbenchOverviewModel } from '../src/public/workbenchOverview/workbenchOverviewModel.js';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchIndex } from '../src/systemWorkflow/domain/workbenchIndex.js';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { projectSystemWorkflowViewport } from '../src/systemWorkflow/systemWorkflowViewportProjection.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE as address } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

// Development-only review of the production index with existing source artwork.
// These compositions live in memory; opening this page never reads or seeds the
// founder's browser drafts, claims an editor lease or publishes anything.
const localAssets = new Map(assets.map(asset => [asset.id, asset]));
function entry(id, name, introduction, placements, area) {
  const draft = createEmptySystemWorkflowDraft(address);
  draft.workbench = createDefaultWorkbenchPresentation();
  draft.appearance.menuSurfaceId = 'carbon'; draft.appearance.surfaceId = 'carbon';
  draft.workbench.area = area;
  // The retained scene renderer accepts the existing local Library assets. No
  // network fixture, publishing URL exception or new asset resolver is needed.
  draft.geometry = { columns: 32, rows: Math.round(32 * area.height / area.width) };
  draft.workbench.display = { ...draft.workbench.display, open: true, window: area, name };
  const field = projectSystemWorkflowViewport(draft.geometry, area), quantize = value => Math.round(value * 9) / 9;
  draft.grids[0].placements = placements.map(([index, left, top, width, height], layer) => ({
    id: `placement:study-${layer}`, stableAssetId: assets[index].id,
    column: quantize((left - field.left) / field.cellSize), row: quantize((top - field.top) / field.cellSize),
    columnSpan: quantize(width / field.cellSize), rowSpan: quantize(height / field.cellSize), layer,
    crop: null, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false }, inspectionMode: 'LIFT',
  }));
  draft.workbenchIndex = { ...createWorkbenchIndex(), destinations: [
    { id: 'workbench-view:detail', name: 'A closer look', visibility: 'PUBLIC', view: { left: 400, top: 160, width: 1000, height: 760 } },
  ] };
  return { id, name, introduction, draft, model: workbenchOverviewModel(draft, localAssets) };
}
const entries = [
  entry('workbench:landscape', 'Lunar Desert', 'A local review composition with the existing Mountain Signal and Abyssal artwork.',
    [[2, -100, 100, 1100, 1100], [3, 900, 160, 1050, 1050], [0, 460, -130, 1200, 1200]], { left: 0, top: 0, width: 2000, height: 1125 }),
  entry('workbench:abyssal', 'Abyssal Study', 'One work, given space. The original transparency, proportions and source information remain attached.',
    [[0, -180, -150, 1800, 1800]], { left: 0, top: 0, width: 1440, height: 1300 }),
  entry('workbench:fragments', 'Collected Fragments', 'Three pieces arranged on the same canvas, with independent source information.',
    [[2, -50, 20, 850, 850], [1, 550, -70, 1100, 1100], [3, 1420, 200, 850, 850]], { left: 0, top: 0, width: 2300, height: 1200 }),
];
window.reviewEntries = entries;
function Review() {
  const [selectedId, select] = useState(entries[0].id), [view, setView] = useState({ layout: 'list', wrap: true }), [cardSize, setCardSize] = useState(2);
  const selected = entries.find(item => item.id === selectedId);
  return <WorkbenchOverview items={entries} previews={entries} selected={selected} model={selected.model} onSelect={select}
    profile={{ name: 'RADAR VISUALS · local review' }} view={view} onViewChange={setView} cardSize={cardSize} onCardSize={setCardSize} />;
}
createRoot(document.getElementById('root')).render(<Review />);
