export function ownerInventoryFolderCommands(folder) {
  return [
    { id: 'manage-assets', label: 'Manage Assets' },
    { id: 'rename', label: 'Rename' },
    { id: 'toggle-visibility', label: folder.visitorVisible ? 'Make Private' : 'Make Public' },
    { id: 'new-folder', label: 'New Folder' },
    { id: 'delete-folder', label: 'Delete Folder' }
  ];
}
