# Placement effects

`effectCatalog.js` registers the supported effects. Each definition supplies its
id, labels, parameters (including storage bounds, defaults and display scaling)
and CSS motion instructions. The editor and draft/public validators read those
same definitions; renderers share `placementMotionStyle`.

To add an effect, create its definition and keyframe stylesheet, register the
definition in the catalog and import its stylesheet in `placementMotion.css`.
Use namespaced keyframes and custom properties. Check combinations: two CSS
animations writing the same property need explicit composition rules before
they can be offered together. Float currently owns translate; Flicker owns opacity.
Do not replace the image's existing crop/rotation/free-scaling transform.

Only serializable parameters and optional `enabled` enter the document. Missing
enabled means on for compatibility; false retains parameters without playback.
Removing an effect removes its record. An empty collection removes animation.
Do not rename existing ids/parameters or change omission defaults without a
compatibility plan and old-document checks.

AnimationModule receives a target summary and an onChange action returning false
on failure. Display binds that action to its originating selection/session and
owns Preview state. Workbench owns window geometry; source assets remain in Library.

Cover validation, old/new document round trips, undo, failed saves, selection
changes, public rendering, reduced motion and combinations in tests. Browser
coverage lives in browser-tests/animation-module.browser.mjs. Motion never writes
to the draft per frame. New effects still need behavioral and performance checks
appropriate to their actual artwork workload.
