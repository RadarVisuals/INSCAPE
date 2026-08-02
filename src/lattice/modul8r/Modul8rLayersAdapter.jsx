import LatticeLayersModule from '../rendering/LatticeLayersModule.jsx';
import { projectModul8rTableUsage } from './modul8rLayersModel.js';
import './modul8rLayers.css';

export default function Modul8rLayersAdapter({ activeTableId, layers, onNavigateTable, onReorder,
  onSelectionChange, reorderDisabled, selectedIds, tables }) {
  const usage = projectModul8rTableUsage(tables, activeTableId);
  return <div className="modul8r-layers">
    <section aria-label="Active table layer order" className="modul8r-layers__active">
      <header><strong>ACTIVE TABLE</strong><span>{layers.length} PLACEMENT{layers.length === 1 ? '' : 'S'}</span></header>
      <LatticeLayersModule layers={layers} onReorder={onReorder} onSelectionChange={onSelectionChange}
        reorderDisabled={reorderDisabled} selectedIds={selectedIds} />
    </section>
    <nav aria-label="All table usage" className="modul8r-layers__usage">
      <header><strong>ALL TABLE USAGE</strong><span>VIEW ONLY / NAVIGATE</span></header>
      {usage.map((table) => <button aria-current={table.active ? 'location' : undefined} key={table.id}
        onClick={() => onNavigateTable?.(table.id)} type="button">
        <span><strong>{table.label}</strong><small>{table.id.toUpperCase()}</small></span>
        <b>{table.count} PLACEMENT{table.count === 1 ? '' : 'S'}</b>
      </button>)}
    </nav>
  </div>;
}
