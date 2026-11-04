import { useState } from 'react';
import OwnerSystemWorkflowRuntime from '../../../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
import { createSystemWorkflowDraftStore } from '../../../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorScope } from '../../../src/reception/receptionEditorScope.js';
import { saveWorkbenchLayout } from '../../../src/public/ownerSystemWorkflow/workbenchLayoutStorage.js';
import savedReception from '../samples/industrial-reception-authored.json';

export const description = 'Industrial Reception authored through the existing Editor controls. The fresh=1 mode starts empty, with only four source photos available in Library.';
export const fullViewport = true;
export const edgeToEdge = true;
export const sources = ['src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx'];
const profileAddress = '0x1111111111111111111111111111111111111111';
const params = new URLSearchParams(location.search);
const prefix = `inscape:design-lab:industrial-ui-authored:${params.get('session') || 'saved'}:`;
const storage = { getItem: key => localStorage.getItem(prefix + key), setItem: (key, value) => localStorage.setItem(prefix + key, value), removeItem: key => localStorage.removeItem(prefix + key) };
const photos = [
  ['31326395', 'THE QUIET SHIFT', 'Mike Norris', 5808, 3872],
  ['31312637', 'MACHINES AT REST', 'Mike Norris', 4000, 6000],
  ['12381205', 'REMAINING LIGHT', 'Andy Lee', 3840, 5760],
  ['5505168', 'THE OUTSIDE REMAINS', 'Mike van Schoonderwalt', 4981, 3796],
];
const assets = photos.map(([number, name, author, width, height]) => {
  const contractAddress = '0x0000000000000000000000000000000000000000';
  const tokenId = `0x${BigInt(number).toString(16).padStart(64, '0')}`;
  const id = `42:${contractAddress}:${tokenId}`;
  const url = `https://images.pexels.com/photos/${number}/pexels-photo-${number}.jpeg?auto=compress&cs=tinysrgb&w=1920`;
  return { id, stableAssetId: id, chainId: 42, contractAddress, tokenId, standard: 'UNKNOWN', name, title: name,
    description: `Design-library photo by ${author}, Pexels ${number}. Not a token or ownership claim.`,
    collectionName: 'INDUSTRIAL STUDIES', collection: 'INDUSTRIAL STUDIES', imageUrl: url, thumbnailUrl: url, originalImageUrl: url, src: url, previewSrc: url,
    imageWidth: width, imageHeight: height, width, height, mediaType: 'image', placeable: true, owned: false, created: false, creators: [],
    attributes: [{ key: 'Photographer', value: author }, { key: 'Source', value: `https://www.pexels.com/photo/${number}/` }, { key: 'License', value: 'https://www.pexels.com/license/' }] };
});
export function resetSample() {
  for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
}
export default function IndustrialReceptionAuthored() {
  const [store] = useState(() => {
    const next = createSystemWorkflowDraftStore({ profileAddress, storage });
    // This is the exported result of Editor UI authoring. Fresh authoring never loads it.
    if (savedReception && params.get('fresh') !== '1' && !next.getSnapshot().reception) {
      if (!next.commitCompletedOperation({ ...next.getDraft(), reception: structuredClone(savedReception) }, { expectedGeneration: next.getGeneration() }))
        throw new Error('The saved Reception could not be opened.');
      const scope = createReceptionEditorScope(next);
      try {
        const draft = scope.getDraft();
        if (!saveWorkbenchLayout(profileAddress, draft, draft.workbench,
          Object.fromEntries(draft.texts.map(text => [text.id, { mode: 'read' }])), storage, 'reception'))
          throw new Error('The saved Reception reading view could not be opened.');
      } finally { scope.release(); }
    }
    // Observation/export only. Authoring automation receives no store or write API.
    window.industrialReceptionRead = () => next.getDraft();
    return next;
  });
  return <div style={{ position: 'relative', height: '100dvh' }}>
    <OwnerSystemWorkflowRuntime profileAddress={profileAddress} rootStore={store} reviewStorage={storage} receptionEditorRequested
      reviewAssets={assets} reviewCategories={[]} reviewActivity={[]}
      reviewProfile={{ name: 'AFTER INDUSTRY', description: 'Industrial photography — Pexels source study' }} />
  </div>;
}
