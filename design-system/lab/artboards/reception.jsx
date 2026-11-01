import { useState } from 'react';
import ReceptionOverview from '../../../src/reception/ReceptionOverview.jsx';
import { createReceptionExample, receptionProfile } from '../receptionExample.js';

export const description = 'Full Reception: the real frame, navigation and header buttons, using the artwork and visible layout from your Reception. Disposable local study.';
export const sources = ['src/reception/ReceptionOverview.jsx', 'src/reception/ReceptionHeader.jsx', 'src/reception/ReceptionNavigation.jsx', 'src/reception/ReceptionCanvas.jsx', 'src/reception/reception.css'];

export default function ReceptionArtboard() {
  const [reception] = useState(createReceptionExample);
  const [notice, setNotice] = useState('');
  const destination = name => () => setNotice(`${name} selected. This study previews Reception; that destination is not connected here.`);
  return <>
    <div className="lab-reception-stage">
      <ReceptionOverview reception={reception} model={receptionProfile}
        onOpenCanvas={destination('Canvases')} onOpenDirectory={destination('Discover')}
        onEdit={destination('Edit Reception')} onReturnToWorkbench={destination('Workbench')} />
    </div>
    {notice && <p className="lab-note" role="status">{notice}</p>}
  </>;
}