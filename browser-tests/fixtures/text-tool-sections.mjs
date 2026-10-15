// Use the actual disclosure trigger, preserving native focus and toggle behavior.
export async function openTextToolSection(tools, label) {
  const summary = tools.locator('summary').filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
  if (!await summary.evaluate(node => node.parentElement.open)) await summary.click();
}
