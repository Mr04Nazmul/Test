# Dhaka MRT Line 6 — Current 3D build (v2)

**Web:** https://mr04nazmul.github.io/Test/

## Implemented
- 241 rail centerline points and 16 station positions derived from OpenStreetMap data (ODbL attribution below).
- Six-car detailed original procedural **glTF** train (front, intermediate and rear cars), using approximate MRT6 body dimensions and characteristic green/white/red appearance. 3D model heading correction is applied to align the 19.8 m long cars longitudinally with the OSM track. Artificial minimum-pixel scaling has been disabled to avoid giant disjointed cars.
- A single station-at-a-time detailed conceptual **glTF** elevated station structure (not an accurate survey of the real station).
- Esri satellite/aerial imagery base layer and OSM street-map fallback. **Offline OSM building footprints around all 16 stations** under `data/buildings/0.json` … `15.json` are extruded as 3D buildings without relying on the Overpass API during normal viewing. Some footprints come from an older OSM snapshot and may not match current satellite imagery; most heights are estimates. The app changes building neighborhoods as the Follow camera travels.
- Simulated, **timetable-estimated positions** for multiple trains and per-station ETA, using Dhaka UTC+6 time. Train marker list, selected train, Find Train and Follow Camera.
- **My Train GPS** uses optional, user-approved phone geolocation to snap **the user's own position** to the railway only when within roughly 200 m; it is not the actual GPS feed for any other train. The project does not upload phone coordinates to its server.
- Mobile opens in a train-follow camera with the controls/ETA panel initially collapsed; 3D concrete guideway and separate elevated rails are approximate reconstructions.
- Optional official Google Map Tiles API photorealistic 3D mode with restricted user-provided API key (Google data never scraped, extracted or cached).

## Accurate labeling and limits
**This is NOT a GPS/official live tracking system.** DMTCL has not made a usable public realtime train positioning feed available. Even though the train markers update with the clock, all locations are *predictions based on a schedule*, not observed vehicle locations. Delays, breakdowns and service interruptions are unknown.
Station-to-station travel time, station model details, support columns and some building heights are approximate. Actual published departures can change; official source: https://dmtcl.gov.bd/pages/static-pages/6922df5f933eb65569e218ed .
The 3D station model is an original illustration, not a photogrammetric reconstruction of the real buildings.
Photorealistic Google 3D coverage in Dhaka is not guaranteed.

## Data and acknowledgements
- © OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright . Rail track and station OSM points adapted from https://github.com/imamhossain94/dhaka-metro-live-map/blob/main/src/realRoute.js ; *data* remains ODbL and is attributed.
- Schedule source: DMTCL operator website (individual intermediate arrivals are independently calculated).
- Maps: Esri World Imagery and imagery contributors (provider attribution must be retained); check allowed use before monetizing.
- The original 3D models in `assets/` were modeled for this prototype and are not copied from Google Earth.

## Use
Hosted statically with GitHub Pages, or serve folder via a local HTTP server.
Files: `index.html`, `app-v2.js`, `data/mrt6-track.js`, `data/metro-schedule.js`, `assets/*.gltf`.
For native GPS positions in the future: request an official DMTCL feed/license or build a consent-based reporting system with clear quality/confidence warnings. Never label estimates as verified realtime telemetry.

## Deployment
GitHub repository Settings > Pages > Source: GitHub Actions. Workflow: `.github/workflows/deploy.yml`.

## Textured 3D Dhaka station neighbourhoods (added 2026-11-03)

A dependency-free Node script `scripts/build-urban-models.mjs` converts the cached OpenStreetMap footprint polygons in `data/buildings/*.json` into standalone, textured glTF 2.0 3D meshes, one per station. Both GitHub Pages publishing workflows generate the assets automatically. The live generated manifest is:

- https://mr04nazmul.github.io/Test/assets/urban/manifest.json
- Farmgate glTF model: https://mr04nazmul.github.io/Test/assets/urban/10.gltf
- Mirpur 10 glTF model: https://mr04nazmul.github.io/Test/assets/urban/5.gltf
- Motijheel glTF model: https://mr04nazmul.github.io/Test/assets/urban/15.gltf

Each model is positioned on the real station coordinates in the Cesium viewer, with satellite base imagery; choose stations from the panel. Rendered shapes correspond to mapped OSM footprints, **not** surveyed photo-real 3D scans. Building height is estimated if absent; facades, windows, roof parapets and rooftop utility fixtures are original procedural approximations. Some offline footprints came from older OSM snapshots, and they may be incomplete.

To regenerate locally: run `node scripts/build-urban-models.mjs` from the repository root. `assets/urban/*.gltf` and `assets/urban/manifest.json` will be created. The generated assets retain the original ODbL/OSM attribution in their metadata. Browser display requires WebGL and an internet connection to load imagery. Model generation itself requires no paid provider or API key.

## 2026-11-04 — Smooth 360° train-follow and hybrid imagery

- The selected train is sampled at **fractional Dhaka time every animation frame** with `MRT_SCHEDULE.positionFor(trainId)`, rather than snapping its 3D coaches every 900 ms. Other estimated markers animate between summary refreshes. Track direction uses a 36 m-smoothed tangent to reduce turn jitter.
- **Train-follow camera modes:** Rear Chase, Front Track View (a synthetic track camera, **not** actual onboard video), Drone Top, Orbit 360°. Drag/rotate while following, pinch or use zoom buttons; camera keeps orbit/zoom offsets during movement. In free mode Cesium's normal globe controls remain available.
- Rendering quality presets: Balanced / HD / Ultra. The default is HD, with mobile resolution restrained to reduce overheating.
- Hybrid road view: Esri World Imagery plus separate World Transportation roads and World Boundaries & Places labels (best effort; tiles depend on Esri availability). Licensed provider attributions remain visible; check Esri terms for commercial deployment. Buildings use actual OSM footprints, with procedurally created facades, not actual Google building photos.
- Optional Google photorealistic 3D requires an authorized, referrer-restricted Maps Tiles API key and service availability. Never scrape/export/rehost Google Earth or Google Maps 3D tiles.
- **Truthfulness:** MRT-6 uses internal CBTC/centralized train control, but no authenticated public DMTCL vehicle-position feed was located. Estimated train animation is **not** official real-time telemetry. An independent crowdsourced tracker may show voluntarily shared passenger phone GPS, but its data is not connected to this app, and phone GPS is not necessarily the train's own position.
- Run `node scripts/check-metro-quality.mjs` for basic smooth-sample and UI contract tests, alongside `node --check app-v2.js`. Automatic Pages deployment uses `.github/workflows/deploy-pages.yml`; `deploy.yml` is a manual-only backup.
