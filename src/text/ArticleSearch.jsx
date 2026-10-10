import { useLayoutEffect, useRef, useState } from 'react';
import { articleSearchKey, navigateArticleMatch, replaceArticleMatches, setArticleSearch } from './articleSearch.js';

export default function ArticleSearch({ editor, article, disabled, focusRequest }) {
  const search = articleSearchKey.getState(editor.state);
  const field = useRef(null), trigger = useRef(null);
  const [replacement, setReplacement] = useState('');
  const [error, setError] = useState('');
  const replace = all => {
    try { replaceArticleMatches(editor, replacement, all, article); setError(''); }
    catch (failure) { setError(failure.message); }
  };
  useLayoutEffect(() => { if (search.open) field.current?.focus(); }, [search.open, focusRequest]);
  useLayoutEffect(() => { setError(''); if (!search.open) setReplacement(''); }, [search.open, search.query, replacement]);
  const close = () => { setArticleSearch(editor, { close: true }); trigger.current?.focus(); };
  return <div className="text-article-search">
    <button ref={trigger} type="button" aria-expanded={search.open} disabled={disabled}
      onClick={() => search.open ? close() : setArticleSearch(editor, { open: true })}>Find and replace</button>
    {search.open && <section aria-label="Find and replace" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    }}>
      <p>Article body only · ignores case. New text uses the first character’s formatting.</p>
      <label>Find in article<input ref={field} value={search.query} disabled={disabled} maxLength={2000}
        onChange={event => { setArticleSearch(editor, { query: event.target.value }); navigateArticleMatch(editor, 0); }}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); navigateArticleMatch(editor, event.shiftKey ? -1 : 1); } }} /></label>
      <div className="text-search-navigation"><output role="status" aria-live="polite">{!search.query ? 'Enter text to find' : !search.matches.length ? 'No matches' : `${search.active + 1} of ${search.matches.length} matches`}</output>
        <button type="button" aria-label="Previous match" disabled={disabled || !search.matches.length} onClick={() => navigateArticleMatch(editor, -1)}>↑</button>
        <button type="button" aria-label="Next match" disabled={disabled || !search.matches.length} onClick={() => navigateArticleMatch(editor, 1)}>↓</button>
      </div>
      {search.matches.length > 500 && <p>Showing highlights near the current match. All {search.matches.length} matches remain navigable.</p>}
      <label>Replace with<input value={replacement} disabled={disabled} maxLength={2000} onChange={event => setReplacement(event.target.value)} /></label>
      <div className="text-toolbar-row">
        <button type="button" disabled={disabled || !search.matches.length} onClick={() => replace(false)}>Replace match</button>
        <button type="button" disabled={disabled || !search.matches.length} onClick={() => replace(true)}>Replace all</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={close}>Close search</button>
    </section>}
  </div>;
}
