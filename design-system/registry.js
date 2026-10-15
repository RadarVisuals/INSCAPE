// This registry describes the production system. Values live in the linked CSS.
export const system = { name: 'INSCAPE', version: '1.0.0', reviewed: '2026-10-14' };
// Current design directions. Production retains older surface IDs for saved content.
// Review status describes the new design direction, separately from production inventory.
export const designDecisions = [
  {
    id: 'themes',
    name: 'Carbon and Mist',
    status: 'agreed',
    detail: 'Dark Carbon and light Mist instruments with neutral focus.',
  },
  {
    id: 'toolbar',
    name: 'Creation toolbar',
    status: 'agreed',
    detail: 'Flat controls, 5 px corners, a 4 px inset and headerless menus. Preview only.',
  },
  {
    id: 'typography',
    name: 'Interface fonts',
    status: 'app',
    detail: 'Sora, Plex and the creation bar’s Inter already serve their scoped roles.',
  },
  {
    id: 'workspace',
    name: 'Shared creative workspace',
    status: 'review',
    detail:
      'Classic Affinity-inspired tabs, three coordinated toolbars, Navigator and Keeper placement. Reference-only layout study.',
  },
  {
    id: 'properties',
    name: 'Properties and fields',
    status: 'review',
    detail:
      'Complete Image, Display artwork and Shape control previews, including conditional states. Styling needs review.',
  },
  {
    id: 'states',
    name: 'Button states',
    status: 'review',
    detail: 'Compare normal, hover, pressed, selected, focus and unavailable in both themes.',
  },
  {
    id: 'feedback',
    name: 'Loading, empty and error messages',
    status: 'review',
    detail: 'Field validation is previewed; the broader message family is still to design.',
  },
];
export const themes = ['carbon', 'mist'];
export const tokenSources = [
  {
    path: 'design-system/referenceTokens.css',
    role: 'Reference',
    purpose:
      'Shared preview-only geometry, type sizes and input targets, including portalled controls.',
  },
  {
    path: 'design-system/referenceMaterial.css',
    role: 'Reference material',
    purpose: 'One scoped flat-material adapter for Carbon, Mist and forced colours.',
  },
  {
    path: 'src/inscapeTokens.css',
    role: 'Foundation',
    purpose: 'Bundled interface fonts, global colours, spacing, motion and application layers.',
  },
  {
    path: 'src/lattice/rendering/latticeMenuSurface.css',
    role: 'Theme',
    purpose: 'Six structural menu surfaces and their ink, border and selection roles.',
  },
  {
    path: 'src/public/ownerSystemWorkflow/ownerSystemWorkflow.css',
    role: 'Workflow',
    purpose: 'Shared type recipes, rails, structural selectors and window geometry.',
  },
  {
    path: 'src/public/ownerSystemWorkflow/workflowTactile.css',
    role: 'Material',
    purpose: 'Opt-in dark material and native-button interaction states.',
  },
  {
    path: 'src/public/ownerSystemWorkflow/workbenchWindowChrome.css',
    role: 'Window',
    purpose: 'Bevel windows and their theme-aware controls; separate from Stage geometry.',
  },
  {
    path: 'src/public/ownerSystemWorkflow/workbenchToolChrome.css',
    role: 'Tool',
    purpose: 'Companion-window density, fields, headers and touch targets.',
  },
  {
    path: 'src/public/ownerSystemWorkflow/workbenchToolbar.css',
    role: 'Creation',
    purpose:
      'Current production creation-bar geometry and popup layouts; the flat direction is still a reference preview.',
  },
  {
    path: 'src/public/ownerSystemWorkflow/workbenchView.css',
    role: 'Host',
    purpose: 'Screen versus canvas projection, toolbar clearance and camera layout.',
  },
];
export const colorRoles = [
  ['--color-world', 'World', 'Application backing'],
  ['--color-surface', 'Surface', 'Base structural surface'],
  ['--color-surface-elevated', 'Elevated', 'Menus and bounded overlays'],
  [
    '--color-surface-subtle',
    'Instrument base',
    'Dark instrument surface; ink on light instruments',
  ],
  ['--color-text-primary', 'Primary ink', 'Human interface copy'],
  ['--color-text-secondary', 'Secondary ink', 'Supporting copy on dark surfaces'],
  ['--color-focus', 'Keyboard focus', 'Neutral ink; selection has its own fill and state mark'],
  ['--color-success', 'Success', 'Confirmed outcomes, with a text label'],
  ['--color-destructive', 'Destructive', 'Destructive actions and failure, with a label'],
  ['--color-text-disabled', 'Disabled', 'Unavailable controls only'],
];
export const typography = [
  ['--workflow-type-display', 'Display heading', 'A world of your making'],
  ['--workflow-type-title', 'Window title', 'Lunar Desert'],
  ['--workflow-type-section', 'Section heading', 'Artwork and story'],
  ['--workflow-type-body', 'Body', 'Arrange independent artwork into a living composition.'],
  ['--workflow-type-control', 'Control', 'Return to composition'],
  ['--workflow-type-panel-heading', 'Panel heading', 'Display appearance'],
  [
    '--workflow-type-panel-body',
    'Dense supporting copy',
    'Source information remains attached to each artwork.',
  ],
  ['--workflow-type-technical', 'Technical', 'Width 288 · Height 192 · Zoom 100%'],
];
const owner = 'src/public/ownerSystemWorkflow/';
export const components = [
  {
    id: 'tactile-control',
    name: 'Tactile controls',
    kind: 'Primitive',
    material: 'Dark tactile',
    source: owner + 'workflowTactile.css',
    contract:
      'Native button + workflow-tactile-control inside data-workflow-material="tactile". Quiet rows add the --quiet modifier. ARIA state supplies the visual state.',
    evidence: 'browser-tests/workbench-toolbar.browser.mjs',
    status: 'Production',
  },
  {
    id: 'fields',
    name: 'Fields and disclosures',
    kind: 'Primitive',
    material: 'Dark tactile',
    source: owner + 'workbenchToolChrome.css',
    contract:
      'Native labelled inputs, selects, checkboxes, ranges and details/summary. Companion tools supply density; modules own parsing, validation and commit.',
    evidence: 'browser-tests/text-typography.browser.mjs',
    status: 'Production',
  },
  {
    id: 'transform',
    name: 'Artwork transforms',
    kind: 'Primitive',
    material: 'Dark tactile',
    source: owner + 'ArtworkTransformTools.jsx',
    contract:
      'Rotate and horizontal/vertical mirror emit named operations through onTransform. The caller owns history, target and persistence.',
    evidence: 'browser-tests/shared-module-tools.browser.mjs',
    status: 'Production',
  },
  {
    id: 'toolbar',
    name: 'Creation toolbar',
    kind: 'Component',
    material: 'Dark tactile',
    source: owner + 'WorkbenchToolbar.jsx',
    contract:
      'Nine labelled icon controls. Commands, eligibility and tool state arrive as props. Search, nested popup navigation and focus return are local.',
    evidence: 'browser-tests/workbench-toolbar.browser.mjs',
    status: 'Production',
  },
  {
    id: 'shell',
    name: 'Detached window shell',
    kind: 'Component',
    material: 'Tactile / bevel',
    source: owner + 'OwnerSystemWorkflowDetachedWindow.jsx',
    contract:
      'One shell for title, controls, surface and optional background. chrome selects material. The shell does not create an editor or save data.',
    evidence: 'browser-tests/companion-tool-viewport.browser.mjs',
    status: 'Production',
  },
  {
    id: 'window-host',
    name: 'Workbench window host',
    kind: 'Pattern',
    material: 'Contextual',
    source: owner + 'DisplayInstrumentWindow.jsx',
    contract:
      'Owns window gestures and temporary geometry. Explicit module callbacks own authored resizing and saving. Fixed companion tools opt out of resize.',
    evidence: 'browser-tests/companion-tool-viewport.browser.mjs',
    status: 'Production',
  },
  {
    id: 'properties',
    name: 'Properties',
    kind: 'Instrument',
    material: 'Dark tactile',
    source: owner + 'ContextToolbar.jsx',
    contract:
      'One contextual window. Display, Image and Shape supply their actions. Dimensions is a disclosure. Text retains its separate inspector.',
    evidence: 'browser-tests/shared-module-tools.browser.mjs',
    status: 'Production',
  },
  {
    id: 'layers',
    name: 'Layers and Artwork info',
    kind: 'Instrument',
    material: 'Dark tactile',
    source: owner + 'SharedDisplayTools.jsx',
    contract:
      'Independent shared windows with explicit Display and artwork targets. Layers follows scene order; Artwork info reads source projections. Visitor gets inspection only.',
    evidence: 'browser-tests/shared-module-tools.browser.mjs',
    status: 'Production',
  },
  {
    id: 'text-tools',
    name: 'Text tools',
    kind: 'Instrument',
    material: 'Dark tactile',
    source: 'src/text/SharedTextTools.jsx',
    contract:
      'One retargetable tool window; editor, selection, undo and recovery remain article-owned. Current formatting is immediate; additional functions use named disclosures.',
    evidence: 'browser-tests/text-inspector.browser.mjs',
    status: 'Production',
  },
  {
    id: 'numeric',
    name: 'Authored numeric input',
    kind: 'Pattern',
    material: 'Dark tactile',
    source: 'src/text/TextTypographyInput.jsx',
    contract:
      'Incomplete input stays local. Valid edits retain focus. Mixed, reset, commit and Escape cancellation follow the originating editor.',
    evidence: 'browser-tests/text-typography.browser.mjs',
    status: 'Production',
  },
  {
    id: 'surface-controls',
    name: 'Authored surface controls',
    kind: 'Component',
    material: 'Host material',
    source: owner + 'ModuleSurfaceControls.jsx',
    contract:
      'Edits authored corners, shadow and grain. These settings are separate from interface material and use module validation.',
    evidence: 'browser-tests/module-surfaces.browser.mjs',
    status: 'Production',
  },
  {
    id: 'menus',
    name: 'Structural menus',
    kind: 'Component',
    material: 'Six menu surfaces',
    source: 'src/public/menus/RackMenu.jsx',
    contract:
      'Commands retain eligibility, accessible names and directional selection marks. Do not infer a dark-tactile migration from creation-menu styling.',
    evidence: 'src/public/menus/RackMenu.test.js',
    status: 'Retained',
  },
  {
    id: 'library',
    name: 'Library',
    kind: 'Pattern',
    material: 'Structural',
    source: owner + 'OwnerSystemWorkflowLibraryWorkspace.jsx',
    contract:
      'One canonical asset record; attachment expansion is temporary. Dropping supplies a resource and target, while the module owns its interpretation.',
    evidence: 'browser-tests/library-images.browser.mjs',
    status: 'Retained',
  },
  {
    id: 'dock',
    name: 'Application dock',
    kind: 'Navigation',
    material: 'Tactile in current code',
    source: owner + 'OwnerSystemWorkflowGlobalBar.jsx',
    contract:
      'General navigation, profile and explicit publication routes. Current code uses a tactile shell and quiet controls in the structural rail layout; the contract still describes its retained structural baseline. Creation owns its own tool and Library entry points.',
    evidence: 'browser-tests/owner-profile-routing.browser.mjs',
    status: 'Production',
  },
  {
    id: 'index',
    name: 'Workbench Index',
    kind: 'Navigation',
    material: 'Structural',
    source: owner + 'WorkbenchIndex.jsx',
    contract:
      'Saved destinations navigate the camera. Index controls remain screen-sized; the instrument is never an artwork selection member.',
    evidence: 'browser-tests/workbench-index.browser.mjs',
    status: 'Production',
  },
  {
    id: 'canvas',
    name: 'Canvas controls',
    kind: 'Navigation',
    material: 'Dark tactile',
    source: owner + 'WorkbenchCanvasControls.jsx',
    contract:
      'Explicit canvas resize and Fit canvas to content. Camera navigation and authored dimensions are different operations.',
    evidence: 'browser-tests/workbench-area-navigation.browser.mjs',
    status: 'Production',
  },
  {
    id: 'display',
    name: 'Display',
    kind: 'Module',
    material: 'Authored Stage',
    source: owner + 'PresentationBoardDefinitive.jsx',
    contract:
      'A clipped composition with multiple Grids. Controls overlay the Stage; interface changes cannot alter artwork geometry, crop or scene order.',
    evidence: 'browser-tests/module-surfaces.browser.mjs',
    status: 'Production',
  },
  {
    id: 'image',
    name: 'Image',
    kind: 'Module',
    material: 'Authored media',
    source: 'src/imageModule/ImageWindow.jsx',
    contract:
      'One artwork per side, source transparency, quiet action strip, activation bounds and separate Focus / Inspect actions. No interface texture on media.',
    evidence: 'browser-tests/image-module.browser.mjs',
    status: 'Production',
  },
  {
    id: 'text',
    name: 'Text',
    kind: 'Module',
    material: 'Authored article',
    source: 'src/text/TextWorkbench.jsx',
    contract:
      'Write, Read, Visitor and Display use shared article semantics. Authored fonts and line metrics are independent of interface typography.',
    evidence: 'browser-tests/text-parity.browser.mjs',
    status: 'Production',
  },
  {
    id: 'shape',
    name: 'Shape',
    kind: 'Module',
    material: 'Authored surface',
    source: 'src/shapes/ShapeWorkbench.jsx',
    contract:
      'Background rectangle with its own colour, opacity, grain and shape order. The host owns snapping, selection and geometry.',
    evidence: 'browser-tests/shared-module-tools.browser.mjs',
    status: 'Production',
  },
  {
    id: 'identity',
    name: 'Identity',
    kind: 'Module',
    material: 'Bevel',
    source: 'src/public/identity/IdentityModule.jsx',
    contract:
      'Trusted profile header, authored presentation and optional animated background have different owners. Save / Cancel is an explicit edit session.',
    evidence: 'browser-tests/owner-profile-routing.browser.mjs',
    status: 'Production',
  },
  {
    id: 'keeper',
    name: 'Keeper',
    kind: 'Module',
    material: 'Tactile settings',
    source: 'src/keeper/KeeperWorkbench.jsx',
    contract:
      'The dock opens Keeper settings independently of artwork selection. Animation, release, return and conversation remain module-owned.',
    evidence: 'browser-tests/tool-chrome-fixture.html',
    status: 'Production',
  },
  {
    id: 'mini-app',
    name: 'Mini Apps and HTML artwork',
    kind: 'Module',
    material: 'Host / transparent',
    source: 'src/miniApps/MiniAppsWorkbench.jsx',
    contract:
      'Host controls surround an isolated document. Remote content owns its interface. Transparent HTML artwork does not receive wallet privileges.',
    evidence: 'browser-tests/html-artwork-fixture.html',
    status: 'Production',
  },
  {
    id: 'reception',
    name: 'Reception',
    kind: 'Presentation',
    material: 'Bounded composition',
    source: 'src/profileDocument/components/ProfileOverview.jsx',
    contract:
      'The same public modules inhabit a bounded reception. Expanded artwork stays within the stage. Only its sheet has the accepted blur exception.',
    evidence: 'browser-tests/reception-card.browser.mjs',
    status: 'Production',
  },
  {
    id: 'focus-writing',
    name: 'Focus writing',
    kind: 'Pattern',
    material: 'System window',
    source: 'src/text/ArticleFocusWriting.jsx',
    contract:
      'Native modal relocates the existing editor, contains focus and returns to the trigger. It creates no article copy or saved layout change.',
    evidence: 'browser-tests/text-focus-writing.browser.mjs',
    status: 'Production',
  },
  {
    id: 'publication',
    name: 'Publication',
    kind: 'Pattern',
    material: 'Structural',
    source: owner + 'OwnerSystemWorkflowPublicationRack.jsx',
    contract:
      'Local save, prepared snapshot, upload and confirmed publication are distinct states. The visual system never triggers publication or wallet actions.',
    evidence: 'browser-tests/owner-system-workflow-publication.browser.mjs',
    status: 'Retained',
  },
  {
    id: 'recovery',
    name: 'Public loading and recovery',
    kind: 'Pattern',
    material: 'Structural',
    source: 'src/profileDocument/components/PublishedProfileBoundary.jsx',
    contract:
      'Loading, missing, unavailable and failed are separate states with meaningful recovery routes. Do not render a failed read as an empty success.',
    evidence: 'browser-tests/published-visitor.browser.mjs',
    status: 'Production',
  },
];
export const principles = [
  [
    'Artwork leads',
    'Interface controls support composition. They never recolour, flatten or resize authored work.',
  ],
  [
    'Scope is visible',
    'Identify the current module, scene or article. A tool never silently edits another target.',
  ],
  [
    'One fact, one owner',
    'CSS owns visual values. Modules own content. The Workbench owns hosting and camera navigation.',
  ],
  [
    'Interaction is legible',
    'Selection, keyboard focus, press, loading and disabled states have different meanings.',
  ],
  [
    'Continuity across hosts',
    'Owner, Visitor and reception share the same module rendering, with different available actions.',
  ],
  [
    'Change with evidence',
    'Use real components, preserve saved work, and verify wide, narrow, keyboard and touch behavior.',
  ],
];
