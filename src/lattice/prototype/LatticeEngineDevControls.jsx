import { DEFAULT_LATTICE_INTERACTION_CONFIG } from '../controller/latticeNavigation.js';
import { PLACEMENT_LAYER_DIRECTIONS } from '../controller/latticePlacementLifecycle.js';
import { TRANSPARENCY_MODES } from '../domain/latticeProfile.js';
import { LATTICE_GEOMETRY_PRESETS, LATTICE_SURFACES } from '../rendering/latticeGeometry.js';
import {
  ARTWORK_MAT_INSET_MAX,
  ARTWORK_MAT_PRESET_IDS,
  normalizeArtworkBacking,
  normalizeArtworkMat,
  resolveArtworkMatPreset,
} from '../rendering/latticeMat.js';
import { CUSTOM_MAT_PRESET_ID, FIXTURE_MEDIA } from './latticeEngineFixtures.js';

const CONTROL_FIELDS = [
  ['deadZone', 'Dead zone', 0, 40, 1],
  ['commitThreshold', 'Commit threshold', 20, 240, 1],
  ['diagonalTolerance', 'Diagonal tolerance', 0, 1, 0.01],
  ['edgeResistance', 'Edge resistance', 0, 0.5, 0.01],
  ['wheelAccumulationThreshold', 'Wheel threshold', 20, 240, 1],
  ['wheelCooldown', 'Wheel cooldown', 0, 1500, 10],
  ['snapDuration', 'Snap duration', 0, 1000, 10],
  ['guideThreshold', 'Guide threshold', 1, 30, 1],
  ['guideReleaseThreshold', 'Guide release', 1, 50, 1],
  ['minimumArtworkPixels', 'Minimum artwork size', 16, 160, 1],
];

export default function LatticeEngineDevControls({
  active, activeTableName, applySelectedMat, applySquareCrop, arrangeEnabled, config,
  cropEditPlacementId, engineStatus, gridSnap, gridVisible, matPresetIds, menuSurfaceId,
  moveSelectedArtworkLayer, onArrangeChange, onGridSnapChange, onOwnerChromeVisibleChange,
  onResetRender, onSmartGuidesChange, ownerChromeVisible, removeSelectedArtwork,
  removeSelectedCrop, renderPreview, replaceSelectedArtwork, selectedBacking,
  selectedLayerAvailability, selectedMat, selectedPlacement, selectedPlacementId, setArtworkBackings,
  setArtworkMats, setConfig, setCropEditPlacementId, setGridVisible, setMatPresetIds,
  setMenuSurfaceId, setRenderPreview, smartGuides, updateSelectedCropZoom,
  updateSelectedMatInset,
}) {
  return (
    <details className="lattice-engine-controls" data-lattice-chrome>
      <summary>ENGINE / DEV</summary>
      <div className="lattice-engine-control-list">
        <fieldset>
          <legend>RENDER</legend>
          <div className="lattice-engine-diagnostics" aria-label="Engine diagnostics">
            <span>ACTIVE {active.x}:{active.y} / {activeTableName}</span>
            <span>GRID {renderPreview.geometry.columns} × {renderPreview.geometry.rows} / {renderPreview.surfaceId.toUpperCase()}</span>
            <span>{engineStatus}</span>
          </div>
          <label className="is-check"><span>Owner chrome</span><input type="checkbox" checked={ownerChromeVisible} onChange={(event) => onOwnerChromeVisibleChange(event.target.checked)} /></label>
          <label className="is-check"><span>Arrange</span><input type="checkbox" checked={arrangeEnabled} onChange={(event) => onArrangeChange(event.target.checked)} /></label>
          <label className="is-check"><span>Smart guides</span><input type="checkbox" checked={smartGuides} onChange={(event) => onSmartGuidesChange(event.target.checked)} /></label>
          <label className="is-check"><span>Grid visible</span><input type="checkbox" checked={gridVisible} onChange={(event) => setGridVisible(event.target.checked)} /></label>
          <label className="is-check"><span>Grid snap</span><input type="checkbox" checked={gridSnap} onChange={(event) => onGridSnapChange(event.target.checked)} /></label>
          <label><span>Geometry</span><select value={LATTICE_GEOMETRY_PRESETS.find(({ geometry }) => geometry.columns === renderPreview.geometry.columns && geometry.rows === renderPreview.geometry.rows)?.id || 'custom'} onChange={(event) => {
            const preset = LATTICE_GEOMETRY_PRESETS.find(({ id }) => id === event.target.value);
            if (preset) setRenderPreview((current) => ({ ...current, geometry: { ...preset.geometry } }));
          }}>
            {LATTICE_GEOMETRY_PRESETS.map((preset) => <option value={preset.id} key={preset.id}>{preset.label}</option>)}
            <option value="custom" disabled>CUSTOM</option>
          </select></label>
          <label><span>Surface</span><select value={renderPreview.surfaceId} onChange={(event) => setRenderPreview((current) => ({ ...current, surfaceId: event.target.value }))}>
            {LATTICE_SURFACES.map((surface) => <option value={surface.id} key={surface.id}>{surface.label}</option>)}
          </select></label>
          <label><span>Menu surface</span><select value={menuSurfaceId} onChange={(event) => setMenuSurfaceId(event.target.value)}>
            {LATTICE_SURFACES.map((surface) => <option value={surface.id} key={surface.id}>{surface.label}</option>)}
          </select></label>
          <label><span>Transparency</span><select value={renderPreview.transparencyMode} onChange={(event) => setRenderPreview((current) => ({ ...current, transparencyMode: event.target.value }))}>
            {Object.values(TRANSPARENCY_MODES).map((mode) => <option value={mode} key={mode}>{mode}</option>)}
          </select></label>
          <label><span>Mat preset</span><select disabled={!selectedPlacement} value={selectedPlacement ? matPresetIds[selectedPlacement.id] || ARTWORK_MAT_PRESET_IDS.NONE : ARTWORK_MAT_PRESET_IDS.NONE} onChange={(event) => {
            if (!selectedPlacement) return;
            applySelectedMat(resolveArtworkMatPreset(event.target.value), event.target.value);
          }}>
            <option value={ARTWORK_MAT_PRESET_IDS.NONE}>NONE</option>
            <option value={ARTWORK_MAT_PRESET_IDS.DOSSIER}>DOSSIER</option>
            <option value={ARTWORK_MAT_PRESET_IDS.CAPTION}>POLAROID / CAPTION</option>
            <option value={CUSTOM_MAT_PRESET_ID} disabled>CUSTOM</option>
          </select></label>
          <label className="is-check"><span>Mat enabled</span><input type="checkbox" disabled={!selectedPlacement} checked={Boolean(selectedPlacement && selectedMat.enabled)} onChange={(event) => applySelectedMat({ ...selectedMat, enabled: event.target.checked })} /></label>
          <label><span>Mat color</span><input type="color" disabled={!selectedPlacement || !selectedMat.enabled} value={selectedMat.color} onChange={(event) => {
            if (!selectedPlacement) return;
            const nextMat = normalizeArtworkMat({ ...selectedMat, color: event.target.value });
            setArtworkMats((current) => ({ ...current, [selectedPlacement.id]: nextMat }));
            setMatPresetIds((current) => ({ ...current, [selectedPlacement.id]: CUSTOM_MAT_PRESET_ID }));
          }} /></label>
          <label className="is-check"><span>Artwork background</span><input type="checkbox" disabled={!selectedPlacement} checked={Boolean(selectedPlacement && selectedBacking.enabled)} onChange={(event) => {
            if (!selectedPlacement) return;
            const nextBacking = normalizeArtworkBacking({ ...selectedBacking, enabled: event.target.checked });
            setArtworkBackings((current) => ({ ...current, [selectedPlacement.id]: nextBacking }));
          }} /></label>
          <label><span>Background color</span><input type="color" disabled={!selectedPlacement || !selectedBacking.enabled} value={selectedBacking.color} onChange={(event) => {
            if (!selectedPlacement) return;
            const nextBacking = normalizeArtworkBacking({ ...selectedBacking, color: event.target.value });
            setArtworkBackings((current) => ({ ...current, [selectedPlacement.id]: nextBacking }));
          }} /></label>
          {['top', 'right', 'bottom', 'left'].map((edge) => <label key={edge}><span>Mat {edge}</span><input type="number" min="0" max={ARTWORK_MAT_INSET_MAX} step="0.01" disabled={!selectedPlacement || !selectedMat.enabled} value={selectedMat.inset[edge]} onChange={(event) => updateSelectedMatInset(edge, Number(event.target.value))} /></label>)}
          <label><span>Replace with</span><select disabled={!selectedPlacement} value={selectedPlacement?.stableAssetId || ''} onChange={(event) => replaceSelectedArtwork(event.target.value)}>
            {!selectedPlacement && <option value="">SELECT ARTWORK</option>}
            {Object.entries(FIXTURE_MEDIA).map(([stableAssetId, media]) => <option value={stableAssetId} key={stableAssetId}>{media.accessibleLabel.replace(' rendering fixture', '').toUpperCase()}</option>)}
          </select></label>
          <button type="button" disabled={!selectedLayerAvailability.backward} onClick={() => moveSelectedArtworkLayer(PLACEMENT_LAYER_DIRECTIONS.BACKWARD)}>SEND BACKWARD</button>
          <button type="button" disabled={!selectedLayerAvailability.forward} onClick={() => moveSelectedArtworkLayer(PLACEMENT_LAYER_DIRECTIONS.FORWARD)}>BRING FORWARD</button>
          <button type="button" disabled={!selectedPlacement} onClick={removeSelectedArtwork}>REMOVE PLACEMENT</button>
          <button type="button" disabled={!selectedPlacement || Boolean(selectedPlacement.crop)} onClick={applySquareCrop}>SQUARE CROP</button>
          <button type="button" disabled={!selectedPlacement?.crop} onClick={() => setCropEditPlacementId((current) => current === selectedPlacementId ? null : selectedPlacementId)}>{cropEditPlacementId === selectedPlacementId ? 'DONE CROP' : 'EDIT CROP'}</button>
          <label><span>CROP ZOOM {selectedPlacement?.crop?.zoom?.toFixed(2) || '1.00'}×</span><input type="range" min="1" max="4" step="0.05" disabled={!selectedPlacement?.crop} value={selectedPlacement?.crop?.zoom || 1} onChange={(event) => updateSelectedCropZoom(Number(event.target.value))} /></label>
          <button type="button" disabled={!selectedPlacement?.crop} onClick={removeSelectedCrop}>REMOVE CROP</button>
          <label className="is-wide"><span>Title</span><input type="text" maxLength="80" placeholder="EMPTY / FALLBACK" value={renderPreview.title} onChange={(event) => setRenderPreview((current) => ({ ...current, title: event.target.value }))} /></label>
          <button type="button" onClick={onResetRender}>RESET RENDER</button>
        </fieldset>
        <fieldset>
          <legend>FEEL</legend>
          {CONTROL_FIELDS.map(([key, label, min, max, step]) => (
            <label key={key}>
              <span>{label}</span>
              <input type="number" min={min} max={max} step={step} value={config[key]} onChange={(event) => {
                const nextValue = Math.min(max, Math.max(min, Number(event.target.value)));
                setConfig((current) => ({ ...current, [key]: Number.isFinite(nextValue) ? nextValue : current[key] }));
              }} />
            </label>
          ))}
          <button type="button" onClick={() => setConfig({ ...DEFAULT_LATTICE_INTERACTION_CONFIG })}>RESET FEEL</button>
        </fieldset>
      </div>
    </details>
  );
}
