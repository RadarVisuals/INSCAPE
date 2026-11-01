# Existing tool windows: clarity and reference finishing pass

22 October 2026. Local, uncommitted work on
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. The checkout contains substantial
other local changes. This report covers the founder-approved finishing round
before Keeper dock, not a full interface migration or release checkpoint.

## Confusion addressed

| Existing wording or mismatch | Result |
| --- | --- |
| Color: Use inherited color | Use default text color; tooltip identifies paragraph/heading defaults or the article default, including its hex value. |
| Color: Default text / Title / Background | Article default text / Article title / Text box background; heading and caption targets append (all). |
| Typography: inherited reset labels and placeholder | Default terminology, retaining Mixed, Automatic and existing numeric defaults where applicable. |
| Image: Library drop, Add side, Replace side | When dropping from Library, Add as a new side, Replace current side. Remove current Image side explains that the Image remains. |
| Shape: Shape selector | Selected shape, because this chooses an existing object. The reference's actual type chooser is Shape type. |
| Layers: group / block / composition action labels | Group name, Create group, Edit group contents, Ungroup selected group, Move out of group. Internal composition-block semantics are unchanged. |
| Workspace reference: Rotation field, Show shape, Image Color and broad FX | Removes the two stale controls; Image has no color settings; FX offers Shape Blur and rectangle Grain. Toolbar Rotate/Mirror remain in place. |

The reference Image controls use the same wording and no longer show an obsolete
“being reviewed” note. This is a bounded reconciliation of accepted behavior;
the disposable Display adapter and other independent reference examples are
still distinct from production Workbench tools.

## Responsibility boundaries

The inspected controls already use module-owned editing, validation, history
and saving. Shared docks supply selection and presentation. This pass found no
prerequisite ownership conflict and adds no settings store, schema, dependencies
or styling system. Color reset still removes the existing override; it does
not copy a default into a second field. Grouping, publication and temporary
Layers visibility retain their existing behavior. The cleanup simplifies the
language and removes conflicting reference controls, not the application
architecture. Focus writing, Keeper, Navigator, sidebar and dock persistence
were not changed in this pass.

## Verification

- Seven Image/Shape/shared-tool browser cases passed in `app-running.log`,
  covering selection, saved edits, gesture cancellation, Undo, recovery,
  camera geometry and compact docks.
- Four cases passed in `scope.log`: selected typography reset with
  Read/Visitor/reload parity; Layers groups/order/visibility/delete/reload;
  group entry/exit and atomic movement; and Text Color. The Color case overlaps
  the previous seven and now checks title-color reset without changing body
  content or colors. These are ten distinct app cases.
- Five of six cases passed initially in `reference.log`. The failed geometry
  case used an accessibility locator that stopped finding the offscreen scene
  while navigating panels. It now queries the scene DOM for its geometry
  invariant and asserts the approved Shape-only FX scope. Its final rerun
  passed in `reference-geometry-final.log`; canvas implementation was unchanged.
- Three Color reference cases passed in `reference-colour.log`, including
  ring/triangle editing, cancellation/retargeting, keyboard/locked states,
  neutral hue retention, both themes, narrow widths and touch.
- These are nineteen distinct relevant browser cases across the documented
  runs, not one nineteen-case run. Four focused production-budget tests passed.
- Production build with native config loader, production build check,
  regenerated design-system inventory/check and scoped whitespace checks passed.
- Inspected app screenshots at 1440px and compact 760px, in Mist and Carbon,
  including the independent Shape window, docked Image and Text Color. Inspected
  the 390px Carbon workspace reference and 320px Mist Color reference. Fields
  remain contained; compact tool bodies scroll, and long dock tab strips scroll
  horizontally. Keyboard Color focus remains visible; pointer-focus behavior
  was not changed by this wording pass.

The local preview server had stopped before the first browser run, whose
connection-refused failures are retained in `app.log`. It was restarted at
127.0.0.1:24970 and the cases rerun. Verification used isolated fixtures and did
not edit the user's composition. The server remains available. No full release
suite, remote CI, upload, deployment, commit or push was performed. The existing
CI workflow remains broader; historical CI does not verify this dirty checkout.

## Production size

Core JavaScript measures 2,482,183 raw / 794,509 gzip bytes, up 307 / 43 from the
preceding local font-clarity build. The first build exceeded the previous raw
ceiling by 183 bytes. The raw ceiling was increased by 500 to 2,482,500 for this
measured wording addition; the 795,000 gzip ceiling and all other budgets remain
unchanged. The final build and separate build check pass. Initial JavaScript is
822,889 raw / 239,424 gzip bytes. Logs retain both the initial overage and final
result, alongside the bundle report.

## Visual evidence

- [Image dock, Mist](tool-window-polish/image-mist-docked.png)
- [Image compact dock, Carbon](tool-window-polish/image-carbon-narrow.png)
- [Independent Shape and shared Color, Mist](tool-window-polish/shape-mist-independent.png)
- [Text Color defaults, Mist](tool-window-polish/color-text-mist.png)
- [Compact Text Color scroller](tool-window-polish/color-text-narrow.png)
- [Workspace reference, Carbon at 390px](tool-window-polish/workspace-carbon-390.png)
- [Color reference, Mist at 320px](tool-window-polish/colour-mist-320.png)

Keeper dock is the next agreed surface. Navigator/minimap and sidebar follow;
saved window arrangement and Focus writing remain deferred.
