import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ImageArtwork from '../src/imageModule/ImageArtwork.jsx';
import '../src/imageModule/imageModule.css';
import { CompositionImage } from '../src/composition/CompositionImage.jsx';
import { buildProfileDocumentV9Asset } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import '../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';

const assets = ['red', 'green', 'alpha'].map((name, index) => {
  const url = 'https://repair.invalid/' + name + '.png';
  return { ...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[index], src: url, imageUrl: url, originalImageUrl: url,
    thumbnailUrl: name === 'alpha' ? 'https://repair.invalid/red.png' : url, imageWidth: 200, imageHeight: 200 };
});
const transform = { quarterTurns: 0, mirrorX: false, mirrorY: false };
const records = assets.map(asset => ({ name: asset.name, artwork: { id: asset.id,
  asset: buildProfileDocumentV9Asset(asset, asset.id), crop: null, transform } }));
const row = top => ({ position: 'absolute', left: 20, top, width: 300, height: 100, background: 'blue', display: 'flex' });

function OwnerImage({ artwork }) {
  const [host, setHost] = useState(null);
  return <div ref={setHost} style={{ position: 'relative', width: 100, height: 100 }}>
    <ImageArtwork artwork={artwork} rectangle={{ left: 0, top: 0, width: 100, height: 100 }} recoveryHost={host} />
  </div>;
}

function PixelStudy() {
  const [failed, setFailed] = useState(false);
  return <>
    <div id="owner" style={row(20)}>{records.map((record, index) => {
      const original = record.artwork;
      const artwork = failed && index === 2 ? { ...original, asset: { ...original.asset,
        media: { ...original.asset.media, url: 'https://repair.invalid/fail.png' } } } : original;
      return <OwnerImage key={record.artwork.id} artwork={artwork} />;
    })}</div>
    <div id="visitor" style={row(220)}>{records.map(record => <div key={record.artwork.id} style={{ width: 100, height: 100 }}>
      <CompositionImage record={record} />
    </div>)}</div>
    <button style={{ position: 'absolute', top: 350 }} onClick={() => setFailed(true)}>Load unavailable original</button>
  </>;
}
createRoot(document.getElementById('root')).render(<PixelStudy />);
