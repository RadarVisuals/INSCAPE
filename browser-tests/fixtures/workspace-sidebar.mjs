import { setEditorSidebarOpen } from './editor-menu.mjs';

// Geometry fixtures use the owner's current sidebar visibility control.
export async function hideWorkspaceSidebar(page) {
  if (!await page.getByRole('button', { name: 'Inscape sidebar', exact: true }).count()) return;
  await setEditorSidebarOpen(page, false);
}
