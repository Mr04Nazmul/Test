# Dhaka Metro Rail • 3D Explorer

Mobile-friendly 3D map prototype of Dhaka Metro Rail MRT Line 6, Uttara North to Motijheel.

## Features
- 16 station locations, interactive station list, ride / aerial / station camera modes
- Animated **illustrative** six-car elevated metro train with doors, windows, roof, track supports and train-follow camera
- **Find Train** camera focuses on moving train; opens near Farmgate rather than 25 km overhead
- Start in an Esri World Imagery **satellite** view when available, with OpenStreetMap street map fallback and a satellite toggle. Respect Esri data usage/license requirements; this is for non-commercial prototyping and is not a grant of commercial rights.
- Optional OSM building footprints extruded into simple 3D forms; building heights are estimates, **not** photorealistic Google Earth geometry
- Optional 3D extrusion of real OSM building footprints around a selected station (public Overpass endpoint; availability is best effort, building heights are estimated)
- Optional Google Maps Platform **Photorealistic 3D Tiles** via CesiumJS; requires your own Google Cloud Map Tiles API key with billing enabled
- Responsive iPhone / Android / desktop controls

## Important limitations
- Station coordinates are approximate illustrative locations and have not yet been independently validated against an official route geometry. The station names reflect the MRT Line 6 corridor; check [DMTCL](https://dmtcl.gov.bd/) for official information.
- The route line is an approximation connecting stations; this is **not** a survey-accurate railway alignment. The simulated train and station structures are not imported or extracted from Google Earth. The train moves through an animation, not official live DMTCL real-time positions.
- Google photorealistic surface 3D coverage may be unavailable for this Dhaka location; fallback map still runs.
- Google imagery is accessed via the official API only, is not downloaded or cached, and Google map attribution must remain visible.
- Restrict your Google Cloud API key by HTTP referrer and to the Map Tiles API. Do not commit an unrestricted key.

## Run
Open `index.html` through GitHub Pages or a local static web server. For optional Google 3D, enable the Maps **Map Tiles API**, set up billing, then paste your restricted API key into the in-page input and select "Load Google 3D".

## Deploy
A deployment workflow is included at `.github/workflows/deploy-pages.yml`. In repository **Settings → Pages**, set **Source: GitHub Actions** to enable publishing. Once deployment succeeds, use https://mr04nazmul.github.io/Test/ . This address is a proposed Pages URL, not a verified live deployment.

## Attribution and rights
© OpenStreetMap contributors for base map data and building geometry. Esri and imagery contributors for the optional satellite basemap (provider attribution must remain visible). Google imagery © Google and data providers when loaded through the official Map Tiles API. CesiumJS © Cesium contributors. Verify Esri access and licensing for any commercial launch.
