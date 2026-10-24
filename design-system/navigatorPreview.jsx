import { NavigatorMap } from '../src/public/ownerSystemWorkflow/NavigatorContent.jsx';
const clamp = value => Math.max(10, Math.min(90, value));
export default function NavigatorPreview({ view, zoom, onViewChange }) {
  return <NavigatorMap className="ds-studio-map" label="Navigate example workbench" view={view}
    frameSize={{ width: Math.min(85, 4500 / zoom), height: Math.min(85, 4500 / zoom) }}
    onViewChange={onViewChange} clamp={clamp}><span className="ds-studio-map-art" /></NavigatorMap>;
}
