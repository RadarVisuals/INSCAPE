import { useState } from 'react';

function ArtworkGrid({ assets, emptyLabel = 'NO FIXTURE WORKS' }) {
  if (!assets.length) return <p className="lattice-window-empty">{emptyLabel}</p>;
  return <div className="lattice-window-artworks">{assets.map((asset) => <article className="lattice-window-artwork" key={asset.stableAssetId}>
    <div><img alt={asset.title || 'Unresolved fixture artwork'} src={asset.src} /></div>
    <strong>{asset.title || 'UNTITLED'}</strong><small>MEDIA RECORD / FIXTURE</small>
  </article>)}</div>;
}

export default function LatticeRailWindowContent({ data, windowId }) {
  const publicCategories = data.categories.filter((category) => category.public);
  const [selectedCategoryId, setSelectedCategoryId] = useState(publicCategories[0]?.id || null);
  const selectedCategory = publicCategories.find(({ id }) => id === selectedCategoryId) || publicCategories[0] || null;

  if (windowId === 'categories') {
    const selectedAssets = selectedCategory ? data.assets.filter((asset) => selectedCategory.assetIds.includes(asset.stableAssetId)) : [];
    return <div className="lattice-window-split">
      <nav aria-label="Published categories" className="lattice-window-list">
        <small>PUBLIC STRUCTURE</small>
        {publicCategories.map((category) => <button aria-pressed={selectedCategory?.id === category.id} data-active={selectedCategory?.id === category.id || undefined} key={category.id} onClick={() => setSelectedCategoryId(category.id)} type="button"><span>{category.name}</span><i>{category.assetIds.length}</i></button>)}
        {!publicCategories.length && <p>NO PUBLISHED CATEGORIES</p>}
      </nav>
      <section className="lattice-window-section"><header><strong>{selectedCategory?.name || 'CATEGORIES'}</strong><small>{selectedAssets.length} WORKS</small></header><ArtworkGrid assets={selectedAssets} emptyLabel="NO PUBLISHED WORKS" /></section>
    </div>;
  }
  if (windowId === 'creations') return <section className="lattice-window-section"><header><strong>AUTHORED WORK</strong><small>{data.assets.length} FIXTURES</small></header><ArtworkGrid assets={data.assets} /></section>;
  if (windowId === 'activity') return <section className="lattice-window-section"><header><strong>SIGNALS</strong><small>FIXTURE SHAPES</small></header><div className="lattice-window-signals">{data.activity.length ? data.activity.map((signal) => <article key={signal.id}><span>{signal.type}</span><strong>{signal.label || 'UNRESOLVED'}</strong><small>{signal.detail || 'NO RESOLVED RECORD'}</small></article>) : <p className="lattice-window-empty">NO RESOLVED ACTIVITY</p>}</div></section>;
  return <section className="lattice-window-section lattice-window-directory"><header><strong>PUBLIC INSCAPE DIRECTORY</strong><small>ADAPTER UNRESOLVED</small></header><p className="lattice-window-empty">NO VERIFIED PUBLISHED WORKSPACES RESOLVED</p><div className="lattice-window-directory__grid" aria-hidden="true"><span /><span /><span /><span /></div></section>;
}
