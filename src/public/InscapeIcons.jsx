// Drawn for the 16px interface, matching IdentityActionIcon's light geometry.
// Button labels own accessibility; these drawings are decorative.
function icon(drawing) {
  return function InscapeIcon({ size = 16, style, ...props }) {
    return <svg {...props} aria-hidden="true" focusable="false" data-inscape-icon
      width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"
      style={{ ...style, strokeWidth: 1.25 }}>{drawing}</svg>;
  };
}
export const Copy = icon(<><rect x="5.5" y="5.5" width="9" height="9" rx="1" /><path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1" /></>);
export const ExternalLink = icon(<path d="M7 1.5H3.5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9M9.5 1.5h5v5M14.5 1.5 7.5 8.5" />);
export const Minus = icon(<path d="M3 8.5h10" />);
export const Plus = icon(<path d="M3 8.5h10M8 3.5v10" />);
export const Pencil = icon(<path d="m3 10 7.5-7.5 3 3L6 13l-4 1ZM9 4l3 3" />);
export const Bold = icon(<path d="M4.5 2.5h4a3 3 0 0 1 0 6h-4Zm0 6h4.5a2.5 2.5 0 0 1 0 5h-4.5Z" />);
export const AlignLeft = icon(<path d="M2 3h12M2 6h8M2 9h12M2 12h8" />);
export const AlignCenter = icon(<path d="M2 3h12M4 6h8M2 9h12M4 12h8" />);
export const AlignRight = icon(<path d="M2 3h12M6 6h8M2 9h12M6 12h8" />);
export const Italic = icon(<path d="M7 2.5h6M3 13.5h6M10 2.5l-4 11" />);
export const Underline = icon(<path d="M4 2v6a4 4 0 0 0 8 0V2M3 14h10" />);
export const Quote = icon(<path d="M2 4h4v4H2Zm4 4c0 3-1 4-3 4M10 4h4v4h-4Zm4 4c0 3-1 4-3 4" />);
export const List = icon(<path d="M6 4h8M6 8h8M6 12h8M2 4h.5M2 8h.5M2 12h.5" />);
export const ListOrdered = icon(<path d="M6 4h8M6 8h8M6 12h8M1.5 2.5h1V6M1.5 10a1 1 0 1 1 2 0l-2 3h2" />);
export const Link = icon(<><path d="m6 10 4-4M6 5l2-2a3 3 0 0 1 5 4l-2 2M5 6 3 8a3 3 0 0 0 4 5l2-2" /></>);
export const Undo = icon(<path d="M5 3 2 6l3 3M2 6h7a4 4 0 0 1 0 8" />);
export const Redo = icon(<path d="m11 3 3 3-3 3M14 6H7a4 4 0 0 0 0 8" />);
export const FileText = icon(<><path d="M9.5 1.5h-6v13h9v-10ZM9.5 1.5v3h3M5.5 7h5M5.5 9.5h5M5.5 12h3" /></>);
export const Tag = icon(<><path d="M8 1.5H2v6l7 7 5.5-5.5Z" /><circle cx="5" cy="4.5" r=".75" /></>);
export const X = icon(<path d="m4 4 8 8M12 4l-8 8" />);
export const Check = icon(<path d="m3 8 3 3 7-7" />);
export const ChevronDown = icon(<path d="m4 6 4 4 4-4" />);
export const ChevronUp = icon(<path d="m4 10 4-4 4 4" />);
export const ChevronsDown = icon(<path d="m4 3 4 4 4-4M4 9l4 4 4-4" />);
export const ChevronsUp = icon(<path d="m4 7 4-4 4 4M4 13l4-4 4 4" />);
export const RotateCw = icon(<path d="M12.5 5.5A5.5 5.5 0 1 0 13.5 9M12.5 2v3.5H9" />);
const mirrorDrawing = <path d="M8.5 2v12M2.5 4.5l3 3.5-3 3.5M14.5 4.5l-3 3.5 3 3.5" />;
export const FlipHorizontal2 = icon(mirrorDrawing);
export const FlipVertical2 = icon(<g transform="rotate(90 8 8)">{mirrorDrawing}</g>);
export const Crop = icon(<path d="M4.5 1.5V11a1.5 1.5 0 0 0 1.5 1.5h8.5M1.5 4.5H11a1.5 1.5 0 0 1 1.5 1.5v8.5" />);
export const Frame = icon(<rect x="2.5" y="2.5" width="11" height="11" rx="1" />);
export const Eye = icon(<><path d="M1 8s2.5-4 7-4 7 4 7 4-2.5 4-7 4-7-4-7-4Z" /><circle cx="8" cy="8" r="1.75" /></>);
export const EyeOff = icon(<><path d="m2 2 12 12M6 4.3A8 8 0 0 1 8 4c4.5 0 7 4 7 4a14 14 0 0 1-2 2.4M10 11.7A8 8 0 0 1 8 12C3.5 12 1 8 1 8a14 14 0 0 1 2-2.4" /></>);
const lockDrawing = <><rect x="3.5" y="7.5" width="9" height="7" rx="1" /><path d="M5.5 7.5V4a2.5 2.5 0 0 1 5 0v3.5" /></>;
export const Lock = icon(lockDrawing);
export const LockKeyhole = icon(<>{lockDrawing}<path d="M8.5 10v2" /></>);
export const Trash2 = icon(<path d="M2.5 4.5h11M5.5 4.5v-2h5v2M3.5 4.5v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-9M6.5 7v5M9.5 7v5" />);
export const Layers3 = icon(<path d="m8 1.5 6.5 3.5L8 8.5 1.5 5ZM1.5 8l6.5 3.5L14.5 8M1.5 11l6.5 3.5 6.5-3.5" />);
export const Info = icon(<><circle cx="8" cy="8" r="6.5" /><path d="M8.5 7v4.5" /><circle cx="8.5" cy="4.5" r=".625" fill="currentColor" stroke="none" /></>);
export const Play = icon(<path d="m4.5 2.5 8 5.5-8 5.5Z" />);
export const Pause = icon(<path d="M5.5 3v10M10.5 3v10" />);
export const Maximize2 = icon(<path d="M10 1.5h4.5V6M14.5 1.5l-5 5M6 14.5H1.5V10M1.5 14.5l5-5" />);
export const Minimize2 = icon(<path d="M14.5 1.5l-5 5m0-4V6.5h4M1.5 14.5l5-5m0 4V9.5h-4" />);
export const PictureInPicture2 = icon(<><path d="M5 13.5H3a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 3 1.5h9A1.5 1.5 0 0 1 13.5 3v2" /><rect x="7.5" y="7.5" width="7" height="7" rx="1" /></>);
export const PanelRightClose = icon(<><rect x="1.5" y="1.5" width="13" height="13" rx="1.5" /><path d="M10.5 2v12M4 5l3 3-3 3" /></>);
export const Settings = icon(<><path d="m6.5 1.5-.4 1.8-1.4.8-1.7-.5-1.5 2.5L2.8 7v2l-1.3.9L3 12.4l1.7-.5 1.4.8.4 1.8h3l.4-1.8 1.4-.8 1.7.5 1.5-2.5L13.2 9V7l1.3-.9L13 3.6l-1.7.5-1.4-.8-.4-1.8Z" /><circle cx="8" cy="8" r="2" /></>);
