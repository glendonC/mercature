# Application boundaries

Mercature is a browser-local React/TypeScript application. It has no server-side reconstruction or cloud language service. The small runtime consists of React, the canvas avatar library, and pure TypeScript domain modules. Production assets are cached by a versioned service worker after initial provisioning.

## Flow and interface

Home uses a shared catalogue for clickable destination photographs and search results. Search also finds the authored Visitor courtyard and work saved on this device. The split upload control accepts original photos/video or a saved JSON plan/project. Unknown queries offer an explicit photo intake action; search never silently creates a reconstructed model. In the example, a short guide leads through a site check or original visitor message, explicit feature confirmation, one supported change, comparison and saving. Map, projected 3D, original/proposed views and undo stay directly available. Evidence, precise placement, requirements and plan metadata open on demand.

Unlisted places have a photo-first workspace. Uploaded originals stay in IndexedDB; metadata and notes stay in local storage. Local evidence is not automatically converted to a spatial model. The optional geographic rectangle records scope only. File reading and persistence drive actual busy states; no animation stands in for reconstruction or AI inference.

The intended future preparation sequence is location and boundary, eligible source views, known camera positions and associations, then available scene artifacts. Counters, scan effects and connecting lines must be driven by actual records or jobs. Retained preparation must be identified as such and skippable. Returning operators should reopen their working scene directly.

## Retained destinations

A separate inspection workspace loads original local route records for Qorikancha, Narikala and Swayambhu. Geographic maps use retained route, OpenStreetMap and source camera coordinates. Photo selection binds to explicit source records; available partial MRP1 point pieces load on demand. The canvas displays a bounded deterministic sample of actual retained points, with the displayed and retained counts visible. Swayambhu has no reconstruction and presents that state directly.

The Vite development and preview middleware serves only allowlisted routes from `.local/routes` to loopback clients. It applies real-path containment, private/no-store responses and no external fetching. Restricted captures never enter `public`, the production bundle or the service-worker cache. Destination data cannot enter the synthetic editing solver. Source credits and recorded observation status remain available in the viewer.

## Domain separation

- `spatial` validates authored geometry, applies reversible scenarios and evaluates continuous swept square envelopes. The immutable baseline remains separate from the hypothetical scene. Unknown support stays unknown after removal. Unsupported required checks prevent a positive result.
- `plans` retains original concern/check provenance, human-confirmed IDs and source snapshots, operations, exact result hashes and the operator decision. Parsing and reopening recompute the comparison. Approval does not imply implementation, and material edits reset the interface decision to proposed.
- `places` stores inspection-only evidence. Original files have hashes and an explicit local-only policy. They do not enter the synthetic solver.
- `language` validates bounded inputs and exposes an unavailable state following a failed model-quality experiment. The separate alias baseline is not represented as AI.
- `workspace` coordinates presentation and human actions. Selecting evidence and changing the camera do not retarget an already confirmed operation.

Local backups use the complete plan serializer and parser and retain source restrictions. Shareable synthetic exports use a separate restricted API. No UI uploads or publishes private reports or site captures. Browser storage can be cleared or unavailable; failures remain visible. Exported local backups are the operator's recovery mechanism for plans; original photo/video files should also be retained independently.

## Validation scope

Domain regressions cover clearance thresholds, support uncertainty, thin obstacles, disconnected levels, invalid placements, immutable baselines, stale records, exact undo/reopen and source restrictions. Browser tests cover the guided loop, focus, desktop/narrow layouts, original evidence after removal, approval reset and local intake.

The production offline check closes Chromium, relaunches the same browser profile with networking disabled, enters a fresh authored Korean message for manual confirmation, moves the bench, verifies blocked/connected comparison and saves. Another offline restart reopens the original text and recomputed proposal, then verifies undo. This establishes local manual operation on the test host, not offline AI or representative-device acceptance.
