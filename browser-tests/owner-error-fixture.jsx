import React, { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OwnerRuntimeErrorBoundary } from '../src/public/OwnerRuntimeBoundary.jsx';
import '../src/index.css';

function RenderLoop() {
  const [count, setCount] = useState(0);
  useLayoutEffect(() => setCount(value => value + 1));
  return <p>{count}</p>;
}
function Fixture() {
  const [fail, setFail] = useState(false);
  return fail ? <RenderLoop /> : <button onClick={() => setFail(true)}>Trigger render loop</button>;
}
createRoot(document.getElementById('root')).render(<OwnerRuntimeErrorBoundary><Fixture /></OwnerRuntimeErrorBoundary>);
