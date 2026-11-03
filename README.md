# Dhaka MRT Line 6 — Current 3D build (v2)

**Web:** https://mr04nazmul.github.io/Test/

## Implemented
- 241 rail centerline points and 16 station positions derived from OpenStreetMap data (ODbL attribution below).
- Six-car detailed original procedural **glTF** train (front, intermediate and rear cars), using approximate MRT6 body dimensions and characteristic green/white/red appearance.
- A single station-at-a-time detailed conceptual **glTF** elevated station structure (not an accurate survey of the real station).
- Esri satellite/aerial imagery base layer, OSM street-map fallback, OSM building-footprint extrusions around selected station (heights may be guessed).
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
