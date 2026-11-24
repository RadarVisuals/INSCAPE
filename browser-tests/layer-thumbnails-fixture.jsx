import React from 'react';
import { createRoot } from 'react-dom/client';
import LayerThumbnail from '../src/public/ownerSystemWorkflow/LayerThumbnail.jsx';
import '../src/public/ownerSystemWorkflow/workbenchLayers.css';

const sources = ['/__layer_svg.svg', '/__layer_svg', '/__layer_raster.jpg'];
createRoot(document.getElementById('root')).render(sources.map(url =>
  <LayerThumbnail key={url} items={[{ id: url, key: 'imageModules', record: { artwork: { asset: { media: { url: "https://thumbs.invalid" + url } } } } }]} />
));
