# Dhaka Metro 3D — MRT Line-6 Tracker (Prototype)

A mobile-friendly interactive 3D view and **timetable-based estimated train tracker** for Dhaka MRT Line-6: Uttara North → Motijheel.

## Live preview

https://mr04nazmul.github.io/Test/

## Implemented

- **241-point real railway centerline** from OpenStreetMap-based MRT-6 track data, covering the 16 current stations, not a straight station-to-station polyline. OSM geometry is reusable under ODbL with attribution.
- Satellite/aerial imagery (Esri) and a street-map toggle; satellite access depends on the tile provider.
- **Original 3D glTF railcar assets**: `assets/mrt6-front.gltf`, `assets/mrt6-middle.gltf`, `assets/mrt6-rear.gltf`. Built to approximately match the manufacturer specifications: each car **19.8 m × 2.95 m × 4.1 m**; 6-car train; green/white/red exterior, tinted windows, sliding doors, bogies and roof AC.
- 3D guideway supports and **illustrative** 3D platforms/canopies for 16 stations. These architectural shapes are not photogrammetric reconstructions and should not be mistaken for exact DMTCL building CAD.
- Approximate 3D building extrusions from OSM building footprints near the selected station. Heights may be estimates, and data availability varies by area.
- Bangladesh Standard Time (UTC+6) 2026 **timetable-based train position estimates** for both directions, other-train map markers, next-train ETA estimates, train selection, train-follow camera and Find Train button.
- Phone-first layout; station/ETA panel starts minimized on narrow screens.
- Optional Google Photorealistic 3D Tiles support via official Map Tiles API with a billing-enabled, referrer-restricted key. Google **does not guarantee coverage for Dhaka**.

## What is NOT provided

- **No official real-time GPS or live telemetry feed.** DMTCL does not appear to publish a public GTFS-RT / train-position API. The displayed movements are estimates from departure schedules, not verified train locations; delays and emergency disruptions cannot be detected.
- No official manufacturer model, blueprint, interior scan, measured station 3D reconstruction, or Google Earth data extraction. The glTF assets and station canopies are original approximate reconstructions.
- No permission to use Google Earth as an extractable 3D asset library. Respect official Map Tiles terms.
- No guarantee of current official arrival times at individual stations; terminal departures and published headways are combined with estimated segment running/dwell times. Confirm travel at https://dmtcl.gov.bd/.

## Sources, license and attribution

- Kawasaki train dimensions & car build: https://global.kawasaki.com/en/corp/newsroom/news/detail/?f=20210304_8861
- DMTCL 2026 timetable: https://dmtcl.gov.bd/pages/static-pages/6922df5f933eb65569e218ed
- OSM railway centerline and station stop coordinates: OSM contributors, [ODbL](https://www.openstreetmap.org/copyright), via source record https://github.com/imamhossain94/dhaka-metro-live-map/blob/main/src/realRoute.js ; independently modeled app implementation. Underlying OSM-derived data must remain compliant with the ODbL.
- CesiumJS engine: https://cesium.com/cesiumjs/
- Satellite basemap: Esri World Imagery, attribution visible at bottom right/left in app.
- OSM building polygons: © OpenStreetMap contributors (ODbL).

There are public open-source and third-party train-map projects with similar features; none cited here grants access to actual DMTCL GPS positions.

## Hosting / usage

Static HTML + CesiumJS + glTF 2.0, works on GitHub Pages with no backend.
Open `index.html` through a local static web server or public GitHub Pages.
For deployment, GitHub Pages needs to be configured to use GitHub Actions at **Settings → Pages**. The included `.github/workflows/deploy.yml` deploys on pushes to `main`.

## Next steps to reach truly realistic 3D

- Acquire properly licensed 3D photogrammetry/architectural models for the selected stations and surroundings.
- Add a direct **authorized** real-time feed from DMTCL, or a consent-based passenger GPS-sharing backend with sufficient active participants, anti-spoofing, privacy policy and explicit location permissions.
- Validate all model alignments in a mobile browser, including iPhone Safari WebGL rendering.

**Do not label timetable estimates as live GPS.**
