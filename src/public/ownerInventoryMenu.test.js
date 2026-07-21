import assert from 'node:assert/strict';
import test from 'node:test';
import { ownerInventoryFolderCommands } from './ownerInventoryMenu.js';

test('owner folder menu exposes membership, naming, and truthful visibility commands', () => {
  assert.deepEqual(ownerInventoryFolderCommands({ visitorVisible: false }), [
    { id: 'manage-assets', label: 'Manage Assets' },
    { id: 'rename', label: 'Rename' },
    { id: 'toggle-visibility', label: 'Make Public' },
    { id: 'new-folder', label: 'New Folder' },
    { id: 'delete-folder', label: 'Delete Folder' }
  ]);
  assert.equal(ownerInventoryFolderCommands({ visitorVisible: true })[2].label, 'Make Private');
});
