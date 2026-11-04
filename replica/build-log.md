# Replica implementation log — 2026-11-04

- S01 Mapped view: preserved existing GitHub Cesium city and train route with OSM attribution, not overridden by invented city geometry.
- S02 Cinematic view: integrated user-supplied ~37MB .glb original 3D scene through a checksum-pinned user-owned ZIP imported at GitHub Actions build time. Model is bundled into Pages assets to avoid CORS and expiring external hotlinks; UI toggle and error fallback added.
- S03 Train following: preserved existing scheduled estimate and opt-in passenger GPS distinction. Cinematic GLB is static and never claimed as current train location.
- S04 Model QA: added glTF2 binary validation, texture/material/mesh inventory checks, mobile mode reset/return path. Real device visual QA remains unverified until deployment.
- Accuracy differences: the 37 MB detailed artistic model contains a sketched straight boulevard and estimated building placements. This is explicitly exposed as cinematic mode, not the source-backed map view. No exact as-built scan was created or extracted.
- Deployment concern: GitHub Pages branch-based publisher and the longer 3D asset generator run separately. CI may fail on unrelated tests; only claim new model is live after a published asset is verified.
