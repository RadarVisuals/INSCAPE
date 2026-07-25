import { normalizeGridRect } from '../../public/gridGeometry.js';
import { createModuleGridGeometry } from '../../public/moduleLayout.js';
import { packCompactCanvasObjects } from '../../public/sceneGrid.js';
import { createVerticalHomeLayout } from '../../public/verticalHomeWorld.js';

export function createPublishedVisitorLayout(document, width, height) {
  const geometry = createModuleGridGeometry(width, height);
  const verticalLayout = createVerticalHomeLayout(geometry);
  const { world, placementGeometry, camera } = verticalLayout;
  const { x: originX, y: originY } = verticalLayout.origin;
  // Categories are browsed through the navigation dock; published Home no
  // longer projects category launchers into the spatial canvas.
  const spaces = [];
  const authoredObjects = [...document.canvasObjects].sort((a, b) => a.order - b.order).map((object) => ({
    ...object,
    presentationOrder: object.order,
    position: { ...object.placement },
    span: { ...object.span },
    geometry: normalizeGridRect({ column: object.placement.column, row: object.placement.row, columnSpan: object.span.columns, rowSpan: object.span.rows }, placementGeometry)
  }));
  const objects = geometry.narrow ? packCompactCanvasObjects(authoredObjects, geometry) : authoredObjects;
  return { geometry, placementGeometry, world, originX, originY, camera, spaces, objects };
}

export function publishedWorldTransform(layout, camera) {
  if (layout.geometry.narrow) return `translate3d(${layout.geometry.left}px,${layout.geometry.top}px,0)`;
  return `translate3d(${(layout.originX - camera.x) * camera.zoom}px,${(layout.originY - camera.y) * camera.zoom}px,0) scale(${camera.zoom})`;
}
