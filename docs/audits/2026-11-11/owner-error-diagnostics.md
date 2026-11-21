# Owner runtime error diagnostics — 2026-11-11

Local change, not committed/pushed/deployed. The reported resize crash remains unclassified pending a new report from the affected composition.

OwnerRuntimeBoundary now supplies the actual Error to the existing AlphaSupportPanel. Copied evidence adds only an allowlisted cause (React update/render loop, stack overflow, supported native error type, or unclassified). Raw error text and stacks remain excluded from production evidence. Development builds append bounded error text and six source frames, removing URLs/query values and common credential assignments. No telemetry or persistence path was added.

Validation: 16 support/privacy/owner-isolation tests passed; lint, production build and unchanged budget checks passed. The development detail helper was absent from delivered production JS. In the connected browser, the actual OwnerRuntimeErrorBoundary caught a deliberately triggered React render loop; REVIEW showed cause REACT_UPDATE_LOOP plus technical error/source frames and COPY DETAILS reported COPIED. This fixture verifies diagnostics and does not reproduce or establish the cause of the user’s resize crash.

The earlier resize checks crossed 1440, 1080, 900, 768, 641, 640, 390, 320 and back without reproducing the reported crash. Reload the development app, repeat the affected preview resize, and inspect/copy the new report to continue diagnosis.

Follow-up: the new owner report identified REACT_UPDATE_LOOP in ReceptionDocumentCanvas. See reception-resize-update-loop.md for the local fix and validation.
