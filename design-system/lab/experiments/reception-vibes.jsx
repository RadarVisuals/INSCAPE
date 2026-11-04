import { useState } from 'react';
import OwnerSystemWorkflowRuntime from '../../../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createSystemWorkflowDraftStore } from '../../../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorScope } from '../../../src/reception/receptionEditorScope.js';
import { saveWorkbenchLayout } from '../../../src/public/ownerSystemWorkflow/workbenchLayoutStorage.js';
import savedReceptions from '../samples/reception-vibes.json';

export const description = 'Three worlds authored from empty Receptions using the existing Editor controls: NORI MORI, CABINET 07 and SOFT RIOT. Select ?vibe=wind, collector or pop. fresh=1 ignores saved exports.';
export const fullViewport = true;
export const edgeToEdge = true;
export const sources = ['src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx'];
const profileAddress = '0x1111111111111111111111111111111111111111';
const params = new URLSearchParams(location.search);
const vibe = ['wind', 'collector', 'pop'].includes(params.get('vibe')) ? params.get('vibe') : 'wind';
const prefix = `inscape:design-lab:reception-vibes:${vibe}:${params.get('session') || 'saved'}:`;
const storage = { getItem: key => localStorage.getItem(prefix + key), setItem: (key, value) => localStorage.setItem(prefix + key, value), removeItem: key => localStorage.removeItem(prefix + key) };
const titles = { wind: 'NORI MORI', collector: 'CABINET 07', pop: 'SOFT RIOT' };
const sourceImages = [
  ['wind-world', 1536, 1024], ['wind-studies', 1536, 1024],
  ['collector-totem', 1086, 1448], ['collector-objects', 1254, 1254],
  ['pop-monument', 1086, 1448], ['pop-detail', 1254, 1254],
];
const assets = sourceImages.map(([name, width, height], index) => {
  const contractAddress = '0x0000000000000000000000000000000000000000';
  const tokenId = `0x${(index + 101).toString(16).padStart(64, '0')}`;
  const id = `42:${contractAddress}:${tokenId}`;
  const url = `https://127.0.0.1:5181/design-system/lab/assets/reception-vibes/${name}.png`;
  return { id, stableAssetId: id, chainId: 42, contractAddress, tokenId, standard: 'UNKNOWN', name, title: name,
    description: 'AI-generated original sample artwork. Fictional editorial study; no affiliation or token ownership claimed.',
    collectionName: 'RECEPTION WORLDS', collection: 'RECEPTION WORLDS', imageUrl: url, thumbnailUrl: url, originalImageUrl: url, src: url, previewSrc: url,
    imageWidth: width, imageHeight: height, width, height, mediaType: 'image', placeable: true, owned: false, created: false, creators: [],
    attributes: [{ key: 'Source', value: 'Built-in image_gen; prompt set saved with verification evidence' }] };
});
export function resetSample() {
  for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
}
export default function ReceptionVibes() {
  const [store] = useState(() => {
    const next = createSystemWorkflowDraftStore({ profileAddress, storage });
    const saved = savedReceptions[vibe];
    // The saved document is exported only after UI authoring. Fresh runs start empty.
    if (saved && params.get('fresh') !== '1' && !next.getSnapshot().reception) {
      if (!next.commitCompletedOperation({ ...next.getDraft(), reception: structuredClone(saved) }, { expectedGeneration: next.getGeneration() }))
        throw new Error('The saved Reception could not be opened.');
      const scope = createReceptionEditorScope(next);
      try {
        const draft = scope.getDraft();
        if (!saveWorkbenchLayout(profileAddress, draft, draft.workbench,
          Object.fromEntries(draft.texts.map(text => [text.id, { mode: 'read' }])), storage, 'reception')) throw new Error('The reading view could not be opened.');
      } finally { scope.release(); }
    }
    window.receptionVibesRead = () => next.getDraft();
    return next;
  });
  return <div style={{ position: 'relative', height: '100dvh' }}>
    <OwnerSystemWorkflowRuntime profileAddress={profileAddress} rootStore={store} reviewStorage={storage} receptionEditorRequested
      reviewAssets={assets} reviewCategories={[]} reviewActivity={[]}
      reviewProfile={{ name: titles[vibe], description: 'Original fictional Reception study' }} />
  </div>;
}
