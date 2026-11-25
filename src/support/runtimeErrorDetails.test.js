import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationErrorCause, createAlphaSupportEvidence, formatAlphaSupportEvidence } from './alphaSupport.js';
import { developmentErrorDetails } from './developmentErrorDetails.js';

test('runtime evidence identifies render/update/stack failures without copying arbitrary error text', () => {
  for (const [message, cause] of [
    ['Maximum update depth exceeded', 'REACT_UPDATE_LOOP'],
    ['Minified React error #185; visit https://react.dev/errors/185', 'REACT_UPDATE_LOOP'],
    ['Too many re-renders', 'REACT_RENDER_LOOP'],
    ['Maximum call stack size exceeded', 'CALL_STACK_EXCEEDED'],
  ]) assert.equal(applicationErrorCause(new Error(message)), cause);
  assert.equal(applicationErrorCause(new TypeError('private contents')), 'TypeError');
  const error = new Error('token=private https://private.example/?signature=hidden');
  error.stack = 'must-not-be-copied';
  const report = formatAlphaSupportEvidence(createAlphaSupportEvidence({ error, phase: 'OWNER_RUNTIME' }));
  assert.match(report, /cause: UNCLASSIFIED_ERROR/);
  assert.doesNotMatch(report, /private|hidden|must-not|stack:|message:/);
});

test('development details retain source names and line numbers but omit URLs, query values and credentials', () => {
  const error = new Error('Maximum update depth exceeded token=private');
  error.stack = 'Error: Maximum update depth exceeded\n    at Reader (http://localhost:5173/src/composition/CompositionDocumentCanvas.jsx?t=signature-private:52:9)\n    at remote (https://private.example/data?secret=hidden)';
  const details = developmentErrorDetails(error);
  assert.match(details, /Maximum update depth exceeded/);
  assert.match(details, /CompositionDocumentCanvas.jsx:52:9/);
  assert.doesNotMatch(details, /localhost|signature-private|private.example|token=private|secret=hidden/);
  assert.ok(developmentErrorDetails({ message: 'x'.repeat(5000), stack: '\n'.repeat(1000) }).length < 2000);
});
