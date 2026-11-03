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

## Farmgate landmark reconstruction (stage 1)
- Farmgate (index 10) now has a **distinct original 3D station model** with a green curved roof, overpass/entrance bridges, vertical glass panels, brick-red station walls, steel canopy trusses, signage and elevated concrete supports.
- The generator `scripts/build-farmgate-landmark.mjs` produces `assets/farmgate-landmark.gltf` in both GitHub Pages deployment workflows. Mobile users do not need to install anything.
- Visual architecture is inspired by public photographs of the real station, not a licensed survey. Roads, bridge offsets and facade geometry are illustrative; these models do **not** duplicate the exact real-world shapes or every local shop.
- In the web viewer, choose **Farmgate** to see the new landmark. All original camera controls, map imagery and train-follow functions remain intact.

## Farmgate road traffic (stage 2)
- Generative 3D meshes for a Dhaka-style painted city bus, decorated cycle rickshaw, and sedan; source: `scripts/build-dhaka-traffic.mjs`.
- The build produces `assets/dhaka-bus.gltf`, `assets/dhaka-rickshaw.gltf`, and `assets/dhaka-car.gltf` automatically, with no extra npm packages or paid asset API.
- Ten traffic models appear at illustrative local roads around Farmgate station. Their low-speed street animation is a **simulation only**, not actual traffic or observed vehicle positions.
- Traffic hides in Google Photorealistic 3D mode to reduce mismatches between illustrative streets and real tiles.

## Agargaon dedicated 3D station — 2026-11-04

- A **new authored glTF 2.0 3D model** is committed at `assets/agargaon-station.gltf`, not merely a screenshot. It has **1,148 model nodes and 33 material variants**. Regenerate it with `node scripts/build-agargaon-station.mjs`.
- The model is **photo-referenced** against the Agargaon green arched canopy, cream concrete structural frames, reddish brick walls, window panels, entrance stairs, pedestrian covered connectors, elevated side platforms and local road/traffic cues. Sources: [Wikimedia Commons Agargaon entrance](https://commons.wikimedia.org/wiki/File:Agargaon_metro_station_entrance_15.jpg) and [Agargaon station photo category](https://commons.wikimedia.org/wiki/Category:Agargaon_metro_station). It is not a surveyed, dimensionally exact digital twin and does not reproduce any protected photograph.
- Includes roadway, pavements, sidewalk railings, green canopies, cars, buses, autorickshaws, plants and streetlights. These street objects and vehicle positions are **illustrative and not real-time**.
- Station **index 8** loads the dedicated Agargaon model instead of the generic MRT station. A new **Agargaon 3D** shortcut opens its location, and the mobile default view starts above Agargaon. The existing dedicated Farmgate model is preserved.
- Mobile controls are collapsible and the station shortcuts scroll sideways to prevent overlapping the camera toolbar. Station and train labels are hidden/reduced in close follow mode to remove the on-screen cluster.
- The urban mesh builder omits visual 3D buildings that appear to intersect the track/camera clearance. Underlying OpenStreetMap footprint records are unchanged. This reduces first-person black-wall clipping and increases facade/window brightness.
- CI runs `node scripts/check-metro-quality.mjs` and `node scripts/check-agargaon-station.mjs` to check model references, camera controls, and geometry. A passed source/geometry check is not proof of perfectly photorealistic visual output in Safari.


## Dhaka University station original landmark (2026-11-04)
- Station index **13** now loads its own original photo-informed detailed glTF 3D model generated by `scripts/build-dhaka-university-landmark.mjs` during the GitHub Pages workflow.
- Geometry includes the green arched metal roof, steel roof members, bilingual conceptual station facades, glass platform safety barriers, detailed concourse, platforms, columns, overhead catenary and station-name signage.
- The added **DU Station 3D** shortcut switches the map camera directly to Dhaka University while keeping existing satellite imagery, OSM buildings, selected train follow and 360° controls intact.
- The generator batches many elements into material draw groups for mobile performance; the resulting `assets/dhaka-university-landmark.gltf` is generated as a workflow artifact and published with Pages.
- Architectural dimensions, precise station entrance positions and many material details remain *approximations*, **not** a scanned/surveyed exact replica. Traffic and trains continue to be estimates/simulations, not GPS. Source geometry is original, not extracted from Google Earth.


## Farmgate neighborhood micro-detail bundle (stage 3)

Nine additional self-contained, material-batched glTF 2.0 model files are built by
`node scripts/build-farmgate-details.mjs` and are used automatically when
selecting **◎ Farmgate** in the 360° viewer:

- `assets/farmgate-shopfronts.gltf`: shops, windows, metal frames and storefront bands
- `assets/farmgate-buildings.gltf`: stylized nearby tower facades, balconies, rooftop equipment and AC
- `assets/farmgate-street-market.gltf`: vendor stands, merchandise, market umbrellas
- `assets/farmgate-pedestrians.gltf`: human-shaped 3D geometry (illustrative people, not identities)
- `assets/farmgate-greenery.gltf`: trees and planted road medians
- `assets/farmgate-utility-network.gltf`: overhead wires, utility poles and transformers
- `assets/farmgate-streetlights.gltf`: roadside lamps
- `assets/farmgate-rail-power.gltf`: gantries and over-track electric infrastructure
- `assets/farmgate-road-markings.gltf`: lane dashes, crossings and curbs

Existing station, train, bus, car and rickshaw models are retained; a separate
`assets/dhaka-motorcycle.gltf` with rider has been added for simulated traffic.

The generator produces all 9 details with about **57,000 triangles**, and CI runs
`node scripts/check-farmgate-details.mjs` for asset existence, valid glTF accessors,
positions and byte bounds. The assets are **conceptual approximations derived
from a single photo**, not surveyed terrain or true architectural replicas. Other
existing OSM building-footprint models can visually overlap these illustrative
facades, especially when viewed from above. Actual DMTCL live vehicle GPS is
not provided. Google Photorealistic mode hides the conceptual details.

## Agargaon architectural realism upgrade — MRT rail and surroundings

**Status (2026-11-04):** The automatic GitHub Pages workflow regenerates the improved `assets/agargaon-station.gltf`. The older hand-committed glTF file can lag the website version; run `node scripts/build-agargaon-station.mjs` to build the latest model directly.

- Rebuilt the unrealistically wide luminous track as **two ballastless concrete-plinth tracks** with four dark welded rails, guideway parapets/cable channels, overhead traction wire, detailed near-station fixings and local concrete pier/gantry details. Nominal rail gauge **1.435 m** and **1500 V DC** overhead supply follow public DMTCL specifications, though structural offsets remain visual approximations.
- The **default iPhone station view** is an exterior street-side cinematic approach, rather than a driver-nose viewpoint passing into station roofs. Front view now uses an external cinematic orbit. Native Cesium orbit/zoom controls remain available. An explicitly selected station receives local overhead/pier model details.
- New **five original embedded PBR textures** for weathered green corrugated roofing, reddish masonry, concrete, reflective glass and asphalt, plus physically tiled UVs and segmented canopy panels. Colors and surfaces are procedural and cannot equal real photographs without site photo textures/survey data.
- Added **14 illustrative Dhaka mid-rise blocks** with balcony and window layers, street-market stalls, streetlights, landscaped roadside greenery, and a pond/green area to evoke Agargaon's aerial setting. These surrounding structures are visually inferred. Their positions and sizes are **not** a verified GIS footprint survey; OSM data remains separate.
- The model is authored from **3,120 named original architectural parts**; the generated glTF is GPU-batched into **31 material draw groups** in a single scene mesh for mobile Safari. The authoring source remains inspectable at `scripts/build-agargaon-station.mjs`. The deployed file is larger than the original untextured draft.
- Mobile toolbar overlays are collapsed into a **More tools** launcher to keep the 3D scene unobstructed. Regeneration and automatic QA are handled in `.github/workflows/deploy-pages.yml`.

Grounding sources: [DMTCL operational/track FAQ](https://dmtcl.gov.bd/pages/static-pages/6922e089933eb65569e27764), [Agargaon aerial / green roof](https://www.thedailystar.net/news/bangladesh/transport/news/birds-eye-view-all-metro-rail-stations-3459691), [Agargaon station Commons photo collection](https://commons.wikimedia.org/wiki/Category:Agargaon_metro_station). **This is a plausible visual reconstruction, not a certified photorealistic digital twin; no verified operator live GPS is connected.**

## Multi-neighborhood 3D coverage and updated facades (2026-11-04)

- The Cesium city renderer now streams **multiple OSM-derived neighborhood glTF tiles** simultaneously. Balanced mode loads the current station and its immediate neighbors on mobile (up to 3 tiles) or two stations either side on desktop (up to 5 tiles).
- Select **🏙 Wider 3D** from the tools menu to load up to three station-neighborhoods on each side (up to 7 model tiles). `🏙 Local 3D` returns to the lighter near-city coverage.
- Each tile is anchored to its own MRT-6 station coordinates; the scene updates the neighborhoods automatically when the station selection or followed train changes. The existing 3D Buildings control removes or restores all active city tiles.
- The original `scripts/build-urban-models.mjs` now generates **extra procedural detailing** for all 16 station patches: glass shopfronts, awnings, balconies, rooftop water tanks, AC equipment and small roof greenery. Their presence and appearance are **illustrative**, not a measured visual inventory.
- `scripts/check-urban-coverage.mjs` checks generated station models, glTF buffers, coverage UI hooks and OSM attribution at deployment.
- These models represent building footprints in cached OSM station neighborhoods, **not every building or block between stations**. Missing OSM footprints, old snapshots, unknown building heights and storefront layouts limit real-world accuracy. This is not a photogrammetric or Google Earth reproduction, and estimated train locations are **not official realtime GPS**.
