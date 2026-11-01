// Use the actual disclosure trigger, preserving native focus and toggle behavior.
export async function openTextToolSection(tools, label) {
  const formatting = ['Spacing & alignment', 'Writing tools', 'Outline'].includes(label);
  await tools.getByRole('tab', { name: formatting ? 'Format text' : 'Article settings', exact: true }).click();
  if (label === 'Writing tools') return;
  if (label === 'Default text style') label = 'Change default style';
  const summary = tools.locator('summary').filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
  if (!await summary.evaluate(node => node.parentElement.open)) await summary.click();
}
