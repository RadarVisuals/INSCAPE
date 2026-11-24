import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import WorkbenchOverview from '../src/public/workbenchOverview/WorkbenchOverview.jsx';
import { workbenchOverviewModel } from '../src/public/workbenchOverview/workbenchOverviewModel.js';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchIndex } from '../src/systemWorkflow/domain/workbenchIndex.js';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { buildProfileDocumentV9Asset } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE as address } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import '../src/index.css';
import '../src/inscapeTokens.css';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../src/lattice/rendering/latticeMenuSurface.css';

// Development-only review of the production index with existing source artwork.
// These compositions live in memory; opening this page never reads or seeds the
// founder's browser drafts, claims an editor lease or publishes anything.
function entry(id, name, introduction, placements, area) {
  const draft = createEmptySystemWorkflowDraft(address);
  draft.workbench = createDefaultWorkbenchPresentation();
  draft.workbench.area = area;
  draft.workbench.imageModules = [];
  draft.imageModules = placements.map(([index, left, top, width, height], layer) => {
    const asset = assets[index], id = `image:study-${layer}`;
    draft.workbench.imageModules.push({ id, open: true, position: { left, top } });
    return { id, name: asset.name, width, height, visibility: 'PUBLIC', artwork: {
      id: `artwork:study-${layer}`, asset: buildProfileDocumentV9Asset(asset, asset.id), crop: null,
      transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
    } };
  });
  draft.workbenchIndex = { ...createWorkbenchIndex(), destinations: [
    { id: 'workbench-view:detail', name: 'A closer look', visibility: 'PUBLIC', view: { left: 400, top: 160, width: 1000, height: 760 } },
  ] };
  return { id, name, introduction, draft, model: workbenchOverviewModel(draft) };
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
