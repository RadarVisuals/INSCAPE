import { openSharedTool } from './shared-tools.mjs';

// Open actual disclosures without replacing their native keyboard/focus behavior.
export async function openTextToolSection(tools, label) {
  if (typeof tools.count !== 'function') tools = tools.locator('.workbench-tool-dock:has([data-text-inspector])');
  if (!await tools.count()) await openSharedTool(tools.page(), 'Inspector');
  const aliases = { 'Default text style': 'Default and heading styles', 'Change default style': 'Default and heading styles', 'Spacing & alignment': 'More text tools', 'Writing tools': 'Find and replace / Outline', 'Article backup': 'Text backup and recovery' };
  label = aliases[label] || label;
  if (['Title', 'Text box layout', 'Background & edges'].includes(label)) await openTextToolSection(tools, 'Text box and article');
  if (label === 'Heading & caption styles') await openTextToolSection(tools, 'Default and heading styles');
  if (label === 'Outline') await openTextToolSection(tools, 'Find and replace / Outline');
  const summary = tools.locator('summary').filter({ hasText: label === 'Outline' ? /^Outline(?:\s|$)/ : new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
  if (!await summary.evaluate(node => node.parentElement.open)) await summary.click();
}

export async function chooseTextToolOption(page, label, value) {
  const trigger = page.getByRole('button', { name: new RegExp(`^${label}:`) });
  await trigger.click();
  await page.getByRole('listbox', { name: label, exact: true }).getByRole('option', { name: value, exact: true }).click();
}
