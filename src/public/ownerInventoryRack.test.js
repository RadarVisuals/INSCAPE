import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const inventory = readFileSync(new URL('./OwnerInventoryRack.jsx', import.meta.url), 'utf8');
const board = readFileSync(new URL('./OwnerRackBoard.jsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./ModuleGridShell.jsx', import.meta.url), 'utf8');
const publishedWorld = readFileSync(new URL('../profileDocument/components/PublishedHomeWorld.jsx', import.meta.url), 'utf8');
const publishedBoard = readFileSync(new URL('../profileDocument/components/PublishedRackBoard.jsx', import.meta.url), 'utf8');
const ownerCss = readFileSync(new URL('./ownerInventoryRack.css', import.meta.url), 'utf8');

test('owner Inventory renders every workspace folder with explicit private/public status', () => {
  assert.match(inventory, /folders\.map\(\(\{ id \}\) => id\)/);
  assert.match(inventory, /folder\.visitorVisible \? 'PUBLIC' : 'PRIVATE'/);
  assert.match(inventory, /Visible only in your owner workspace/);
  assert.match(inventory, /<AssetPicker assets=\{assets\} folder=\{pickerFolder\}/);
  assert.match(inventory, /onSetFolderAsset\(folder\.id, assetId, included\)/);
  assert.match(inventory, /onContextMenu=\{\(event\) => openPointerMenu\(event, folder\.id\)\}/);
  assert.match(inventory, /event\.key === 'ContextMenu'/);
  assert.match(inventory, /event\.key === 'F10' && event\.shiftKey/);
  assert.match(inventory, /aria-haspopup="menu"/);
  assert.match(inventory, /<Menu anchor=\{menu\.anchor\}/);
  assert.doesNotMatch(inventory, />Manage assets<\/button>/);
  assert.match(inventory, /<span>NEW FOLDER<\/span>/);
  assert.match(inventory, /window\.confirm\(`Delete folder/);
  assert.match(inventory, /Its assets will remain in your Library/);
  assert.match(board, /OwnerInventoryRack folders=\{folders\} assets=\{assets\}/);
  assert.match(shell, /rackBoard=\{<Suspense fallback=\{null\}><OwnerRackBoard identityRack=\{ownerIdentityRack\} folders=\{ownerFolders\}/);
  assert.match(shell, /onSetFolderAsset=\{setFolderAsset\}/);
  assert.match(shell, /AssetPicker=\{FolderAssetPicker\}/);
  assert.match(shell, /Menu=\{DesktopMenu\}/);
  assert.match(shell, /onRenameFolder=\{renameFolder\}/);
  assert.match(shell, /onCreateFolder=\{createFolder\}/);
  assert.match(shell, /onDeleteFolder=\{deleteFolder\}/);
  assert.match(shell, /onFolderVisibilityChange=\{setFolderVisitorVisibility\}/);
  assert.match(ownerCss, /\.owner-inventory-rack__body\[hidden\]\{display:none\}/);
  assert.match(ownerCss, /\.published-inventory-rack>\.folder-asset-picker,[^{]+\{position:fixed;z-index:140;inset:0\}/);
});

test('published visitors keep the default validated board and cannot import owner workspace racks', () => {
  assert.match(publishedWorld, /rackBoard !== undefined \? rackBoard/);
  assert.match(publishedWorld, /<PublishedRackBoard/);
  assert.doesNotMatch(publishedWorld + publishedBoard, /OwnerInventoryRack|OwnerRackBoard|ownerFolders|workspace\.folders/);
  assert.doesNotMatch(inventory + board, /useLibraryStore|localStorage|sessionStorage|indexedDB|writeContract|fetch\(/);
});
