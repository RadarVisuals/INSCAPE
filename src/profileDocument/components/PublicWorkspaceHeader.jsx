import { lazy, Suspense, useState } from 'react';
import VisitorHeader from './VisitorHeader.jsx';
import useDeferredFocusReturn from '../../public/useDeferredFocusReturn.js';

const PublicUtilityPanel = lazy(() => import('./PublicUtilityPanel.jsx'));

export default function PublicWorkspaceHeader(props) {
  // Closing or switching a profile must dispose any open account-specific panel.
  return <HeaderSession key={[props.account?.address, props.model?.address, props.current].join('/')} {...props} />;
}

function HeaderSession({ component: Header = VisitorHeader, ...props }) {
  const [panel, setPanel] = useState(null);
  const { restoreFocus } = useDeferredFocusReturn();
  const close = () => {
    setPanel(null);
    restoreFocus(panel.trigger);
  };
  return <>
    <Header {...props} onPanel={(id, trigger) => setPanel({ id, trigger })} />
    {panel && props.account?.address && <Suspense fallback={<span role="status">Opening panel…</span>}>
      <PublicUtilityPanel panel={panel.id} profileAddress={props.account.address} onClose={close} />
    </Suspense>}
  </>;
}
