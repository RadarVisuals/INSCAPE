import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const rectangle = element => {
  const bounds = element?.getBoundingClientRect();
  return bounds && bounds.width > 0 && bounds.height > 0
    ? { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height } : null;
};

// Temporary inspection state, shared by draft and published Display adapters.
// Changing scope invalidates pending media work without navigating back.
export default function useDisplayInspection(options) {
  const latest = useRef(options); latest.current = options;
  const request = useRef(0);
  const mounted = useRef(false);
  const sessionRef = useRef(null);
  const [session, setSession] = useState(null);
  const update = useCallback(value => { sessionRef.current = value; setSession(value); }, []);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current += 1; sessionRef.current = null; };
  }, []);
  useLayoutEffect(() => { request.current += 1; update(null); }, [options.scope, update]);
  const items = useMemo(() => options.items.slice().sort((a, b) =>
    a.navigationOrder - b.navigationOrder || a.id.localeCompare(b.id)), [options.items]);
  const active = session?.scope === options.scope ? session : null;
  const placementId = active?.placementId || null;
  const available = items.filter(item => options.getEntry(item.id));
  const position = available.findIndex(item => item.id === placementId);
  const entry = placementId ? options.getEntry(placementId) : null;
  const close = useCallback(() => {
    request.current += 1;
    const current = sessionRef.current;
    update(null);
    if (current?.scope === latest.current.scope) latest.current.onClose?.();
  }, [update]);
  const open = useCallback((id, source = latest.current.getElement(id)) => {
    const current = latest.current;
    if (!mounted.current || sessionRef.current || !current.items.some(item => item.id === id)) return false;
    const originRectangle = rectangle(source);
    if (!source?.isConnected || !originRectangle) return false;
    const operation = ++request.current;
    const scope = current.scope;
    const finish = ready => {
      const next = latest.current;
      if (!ready || !mounted.current || operation !== request.current || scope !== next.scope
        || !source.isConnected || !next.items.some(item => item.id === id)) return false;
      next.onOpen?.(id);
      update({ scope, placementId: id, originRectangle });
      return true;
    };
    if (!current.prepare) return finish(Boolean(current.getEntry(id)));
    try { return Promise.resolve(current.prepare(id)).then(finish, () => false); }
    catch { return false; }
  }, [update]);
  const navigate = direction => {
    if (!active || position < 0 || available.length < 2) return;
    const destination = available[(position + direction + available.length) % available.length];
    options.onNavigate?.(destination.id);
    update({ ...active, placementId: destination.id });
  };
  useEffect(() => {
    if (placementId && !items.some(item => item.id === placementId)) close();
  }, [placementId, items, close]);
  return {
    placementId, entry, position, total: available.length,
    originRectangle: active?.originRectangle || null,
    atmosphereActive: false,
    sourcePlacementId: null,
    returnFocus: placementId ? options.getElement(placementId) : null,
    getReturnRectangle: () => rectangle(options.getElement(placementId)) || active?.originRectangle || null,
    open, close, navigate,
    beginReturn: () => options.onBeginReturn?.(),
  };
}
