// This module replaces referenceLinks.local.jsx in the static visual export.
// No raw-source imports or internal-document links enter that dependency graph.
export const SourcePreview = null;
export function Source({ path, children }) {
  return children ? null : (
    <span className="ds-source" title="Source files are available in the local workspace">
      {path}
    </span>
  );
}
export function ReferenceDocuments() {
  return (
    <>
      <h2>Reference documents</h2>
      <p>Source files and internal reference documents are available in the local workspace.</p>
    </>
  );
}
export function ProductContract() {
  return null;
}
