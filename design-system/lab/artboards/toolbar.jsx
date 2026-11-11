import { useState } from 'react';
import { Copy, Image, Type, Shapes } from 'lucide-react';
import WorkbenchToolbar from '../../../src/public/ownerSystemWorkflow/WorkbenchToolbar.jsx';

export const description = 'Production creation toolbar with local selection, menus and action feedback.';
export const sources = ['src/public/ownerSystemWorkflow/WorkbenchToolbar.jsx', 'src/public/ownerSystemWorkflow/workbenchToolbar.css'];

export default function ToolbarArtboard() {
  const [tool, setTool] = useState('select'), [panels, setPanels] = useState([]), [notice, setNotice] = useState('Choose a tool or open a menu.');
  const toggle = name => setPanels(value => value.includes(name) ? value.filter(item => item !== name) : [...value, name]);
  return <div className="lab-toolbar-stage">
    <p role="status">{notice}</p>
    <WorkbenchToolbar activeTool={tool} onToolChange={setTool}
      libraryOpen={panels.includes('library')} onOpenLibrary={() => toggle('library')}
      layers={{ enabled: true, open: panels.includes('layers'), onToggle: () => toggle('layers') }}
      actions={[{ id: 'duplicate', label: 'Duplicate artwork', icon: Copy, onSelect: () => setNotice('Duplicate requested in this example.') }]}
      addCommands={[{ id: 'image', label: 'Image', icon: Image, onSelect: () => setNotice('Image requested in this example.') },
        { id: 'text', label: 'Text', icon: Type, onSelect: () => setNotice('Text requested in this example.') }]}
      shapeCommands={[{ id: 'rectangle', label: 'Rectangle', icon: Shapes, onSelect: () => setNotice('Rectangle requested in this example.') }]} />
  </div>;
}
