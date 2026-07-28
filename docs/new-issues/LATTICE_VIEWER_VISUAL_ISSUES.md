# Lattice Viewer Visual Issues

Status: ISSUE-001 remains deferred; ISSUE-002 is implemented and visually approved.

This register records visual defects discovered during Phase 1 without changing or camouflaging the current rendering behavior. Add evidence to [`images/`](./images/README.md) using the simple numbered filename convention.

## ISSUE-001 - Grey haze on table artwork

### Observation

Artwork placed on the table appears to have a light grey or muffled cast. The same artwork has visibly deeper blacks when opened in the focus viewer.

No screenshot is required for this issue; the written observation is the retained record.

### Investigation so far

- The table and focus viewer use the same artwork source and shared artwork-presentation component.
- The inspected image had opacity `1`, no CSS filter, and normal blend mode.
- The inspected fixture did not contain partially transparent pixels.
- Owner chrome and mat-related toggles did not account for the reported full-image difference.
- The mat aperture affects only a small edge region, not the complete artwork surface.
- Historical left/right interaction zones exist in `WorkspaceRailPrototype`, but that prototype is not mounted in the current lattice view.
- Contrast/brightness compensation was tested, rejected as camouflage, and removed completely.

### Required resolution

Diagnose the compositing or rasterization difference in isolation. Do not compensate with contrast, brightness, tint, a forced backing, or another presentation filter that changes the artwork.

## ISSUE-002 - Dossiers show through transparent artwork

### Observation

The metadata dossiers currently reveal from behind the artwork. This works when an opaque image, mat, or frame hides them, but transparent artwork exposes the panels through its negative space.

Solution/mockup evidence:

- [`transparentsolution.png`](./images/issue%20002/transparentsolution.png)
- [`verticalsolution.png`](./images/issue%20002/verticalsolution.png)
- [`horizontalsollution.png`](./images/issue%20002/horizontalsollution.png)

### Implemented resolution

Use a dedicated inspection composition with freestanding transparent artwork in the center and detached narrative/technical panels on the left and right. Connector lines should terminate at the inspection frame rather than pass behind the asset.

Implementation status: completed and visually approved on `ui/issue-002-inspector`.

The implementation:

- preserve transparency instead of adding a mandatory backplate;
- use the same inspection structure for opaque and transparent assets;
- keep panels outside the artwork bounds at desktop sizes;
- adapt the panels into non-obscuring drawers or another responsive arrangement on narrow viewports;
- preserve focus order, keyboard controls, Escape behavior, page navigation, and reduced-motion behavior;
- avoid changing the active artwork surface in a way that alters its perceived color or transparency.

It also preserves the table grid cell size and origin inside the inspector, fades the inspection surface independently from the fully opaque moving artwork, and restores the profile rail and owner toolbar only after the artwork has returned to the table.

## Follow-up gate

These issues are not an unplanned fifth Phase 1 extraction. Address them as separately scoped rendering work only after the four-pass decomposition has stopped for review and received visual approval.
