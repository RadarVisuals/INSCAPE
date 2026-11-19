import { useEffect } from 'react';
import ArticleView from '../../text/ArticleView.jsx';
import './publishedCompositions.css';

export default function PublishedWriting({ snapshot, reception, onSelectSource }) {
  useEffect(() => () => onSelectSource?.(null), [onSelectSource]);
  const sources = snapshot.entries.map(entry => ({ id: entry.id, name: entry.name, texts: (entry.draft.composition || entry.draft).texts || [] }));
  if (reception?.texts?.length) sources.push({ id: 'reception', name: 'Profile', texts: reception.texts });
  const articles = sources.flatMap(source => source.texts.flatMap(text => [
    text.article, ...(text.sceneLink?.passages || []).map(passage => passage.article),
  ].filter(Boolean).map((article, index) => ({ key: `${source.id}/${text.id}/${index}`, id: source.id, name: source.name, article }))));
  return <main className="published-work-list published-writing" data-published-focus-fallback tabIndex={-1}>
    <h1>Writing</h1>
    {articles.length ? articles.map(({ key, id, name, article }) => <details key={key} name="published-writing" data-source-id={id}
      onToggle={event => onSelectSource?.(event.currentTarget.parentElement.querySelector('details[open]')?.dataset.sourceId || null)}>
      <summary>{article.title || name}</summary><ArticleView article={article} />
    </details>) : <p>No published writing yet.</p>}
  </main>;
}
