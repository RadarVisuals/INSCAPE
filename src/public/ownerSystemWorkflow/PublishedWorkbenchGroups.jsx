import { useWorkbenchGroupScene, WorkbenchGroupStacks } from './WorkbenchGroupScene.jsx';
import './workbenchGroups.css';

// The Visitor receives a validated publication, with no store or authoring
// callbacks. Navigation derives the same temporary presentation as the owner.
export default function PublishedWorkbenchGroups({ view, content, hostRef, navigation, sceneRef, disabled, locked }) {
  const scene = useWorkbenchGroupScene({ view, content, hostRef, navigation, sceneRef, disabled });
  return <WorkbenchGroupStacks {...{ content, hostRef, scene, locked }} />;
}
