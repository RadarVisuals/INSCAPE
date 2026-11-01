import ToolPanel from '../../ui/ToolPanel.jsx';
import { useWorkbenchView } from './WorkbenchViewContext.js';

// Workbench contributes navigation clearance; all window interaction is shared.
export default function WorkbenchToolPanel(props) {
  const { navigationInset = 0, navigationTop = 0 } = useWorkbenchView();
  return <ToolPanel navigationInset={navigationInset} navigationTop={navigationTop} {...props} />;
}
