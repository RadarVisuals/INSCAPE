// Content availability belongs to a module declaration, independently of the
// user's open-window preference. Each effect owns its registration so delayed
// cleanup cannot remove a newer declaration for the same target and tool.
export function registerDisplayTool(registry, tool, registration) {
  const next = new Map(registry);
  const target = new Map(registry.get(tool.targetId));
  target.set(tool.id, { registration, tool: { ...tool, available: Boolean(tool.available) } });
  next.set(tool.targetId, target);
  return next;
}

export function unregisterDisplayTool(registry, id, targetId, registration) {
  const current = registry.get(targetId);
  if (current?.get(id)?.registration !== registration) return registry;
  const next = new Map(registry);
  const target = new Map(current);
  target.delete(id);
  if (target.size) next.set(targetId, target);
  else next.delete(targetId);
  return next;
}

export function getRegisteredDisplayTool(registry, id, targetId) {
  return registry.get(targetId)?.get(id)?.tool || null;
}
