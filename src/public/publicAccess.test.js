import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveOwnerAuthoringEnabled,
  runOwnerAuthoringMutation,
  selectLiveCanvasContent,
  selectPublicProfileRoute,
  selectResidentActorVisible
} from './publicAccess.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';

test('URL equality is insufficient and verified owner authoring remains functional', () => {
  const input = { verifiedOwnerProfileAddress: PROFILE_A, workspaceProfileAddress: PROFILE_A, viewedProfileAddress: PROFILE_A };
  assert.equal(resolveOwnerAuthoringEnabled({ ...input, ownershipVerified: false }), false);
  assert.equal(resolveOwnerAuthoringEnabled({ ...input, ownershipVerified: true }), true);
  assert.equal(resolveOwnerAuthoringEnabled({ ...input, ownershipVerified: true, viewedProfileAddress: PROFILE_B }), false);
  assert.equal(resolveOwnerAuthoringEnabled({ ...input, ownershipVerified: true, verifiedOwnerProfileAddress: PROFILE_B }), false);
});

test('only verified matching owners route to the local shell', () => {
  assert.equal(selectPublicProfileRoute(true), 'LOCAL_OWNER');
  assert.equal(selectPublicProfileRoute(false), 'PUBLISHED_VISITOR');
  assert.equal(selectPublicProfileRoute(undefined), 'PUBLISHED_VISITOR');
});

test('published visitors cannot reveal the resident actor before their runtime interface is ready', () => {
  const visible = { actorRevealVisible: true, keeperVisible: true };
  assert.equal(selectResidentActorVisible({ ...visible, ownerRuntime: true, publishedVisitorReady: false }), true);
  assert.equal(selectResidentActorVisible({ ...visible, ownerRuntime: false, publishedVisitorReady: false }), false);
  assert.equal(selectResidentActorVisible({ ...visible, ownerRuntime: false, publishedVisitorReady: true }), true);
  assert.equal(selectResidentActorVisible({ ...visible, ownerRuntime: false, publishedVisitorReady: true, keeperVisible: false }), false);
});

test('visitors see public artwork but never private canvas records', () => {
  const workspace = { canvas: {
    launchers: [{ id: 'public-folder', visitorVisible: true }, { id: 'private-folder', visitorVisible: false }],
    objects: [{ id: 'public-art', visitorVisible: true }, { id: 'private-art', visitorVisible: false }]
  } };
  assert.deepEqual(selectLiveCanvasContent(workspace, false), { objects: [workspace.canvas.objects[0]] });
  assert.deepEqual(selectLiveCanvasContent(workspace, true), { objects: workspace.canvas.objects });
});

test('visitor commands cannot execute workspace mutations', () => {
  let workspaceMutations = 0;
  runOwnerAuthoringMutation(false, () => { workspaceMutations += 1; });
  assert.equal(workspaceMutations, 0);
  runOwnerAuthoringMutation(true, () => { workspaceMutations += 1; });
  assert.equal(workspaceMutations, 1);
});
