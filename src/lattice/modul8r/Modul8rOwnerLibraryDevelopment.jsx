import Modul8rOwnerWorkspace from './Modul8rOwnerWorkspace.jsx';

// Development routes render the accepted production workspace through their
// established DEV-only entrance; fixture adapters stay out of production.
export default function Modul8rOwnerLibraryDevelopment(props) {
  return <Modul8rOwnerWorkspace {...props} />;
}
