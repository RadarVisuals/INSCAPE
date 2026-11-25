import { useEffect, useMemo, useRef, useState } from 'react';
import { luksoEnvioProfileRepository } from './data/luksoEnvioProfileRepository.js';
import { luksoCreationsRepository } from '../creations/data/luksoCreationsRepository.js';
import { envioSourceFilters } from './data/envioSourceFilters.js';
import { projectLibraryAssetUnion } from '../lattice/browser/libraryAssetUnion.js';

export default function useEnvioSourceSearch(profile, criteria, enabled) {
  const { query = '', collection = 'all', relationship = 'all' } = criteria;
  const key =
    enabled && (query.trim() || collection !== 'all')
      ? JSON.stringify([profile, query.trim(), collection, relationship])
      : '';
  const [result, setResult] = useState(null);
  const nextPage = useRef(null);
  useEffect(() => {
    if (!key) {
      setResult(null);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const filters = envioSourceFilters(query, collection);
    const sources = [];
    if (relationship !== 'created')
      sources.push({
        kind: 'ownedAssets',
        iterator: luksoEnvioProfileRepository.loadProfileAssets(profile, {
          signal,
          searchFilter: filters.hold,
        }),
      });
    if (relationship !== 'owned')
      sources.push({
        kind: 'createdAssets',
        iterator: luksoCreationsRepository.loadCreations(profile, { signal, filters }),
      });
    const accumulated = { ownedAssets: new Map(), createdAssets: new Map() };
    let busy = false;
    function failSearch() {
      if (signal.aborted) return;
      setResult({ key, failed: true });
      controller.abort();
    }
    async function read() {
      if (signal.aborted || busy) return;
      busy = true;
      const deadline = setTimeout(failSearch, 15000);
      setResult(prev => ({ ...(prev?.key === key ? prev : {}), key, loading: true }));
      try {
        await Promise.all(
          sources
            .filter(source => !source.complete)
            .map(async source => {
              const { value, done } = await source.iterator.next();
              for (const asset of value?.assets || []) accumulated[source.kind].set(asset.id, asset);
              source.complete = done || value.complete;
            })
        );
        if (!signal.aborted)
          setResult({
            key,
            loading: false,
            more: sources.some(s => !s.complete),
            ...projectLibraryAssetUnion({
              profileAddress: profile,
              ownedAssets: [...accumulated.ownedAssets.values()],
              createdAssets: [...accumulated.createdAssets.values()],
            }),
          });
      } catch {
        failSearch();
      } finally {
        clearTimeout(deadline);
        busy = false;
      }
    }
    nextPage.current = read;
    const timer = setTimeout(read, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
      nextPage.current = null;
    };
  }, [key, query, collection, relationship, profile]);
  return useMemo(
    () =>
      !key || (result?.key === key && result.failed)
        ? null
        : { ...(result?.key === key ? result : { loading: true }), loadMore: () => nextPage.current?.() },
    [key, result]
  );
}
