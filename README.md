# Dhaka Metro Rail • 3D Explorer

Mobile-friendly 3D map prototype of Dhaka Metro Rail MRT Line 6, Uttara North to Motijheel.

## Features
- 16 station locations, interactive station list, ride / aerial / station camera modes
- Animated **illustrative** six-car elevated metro train and simplified viaduct
- OpenStreetMap base map by default (no API key required)
- Optional 3D extrusion of real OSM building footprints around a selected station (public Overpass endpoint; availability is best effort, building heights are estimated)
- Optional Google Maps Platform **Photorealistic 3D Tiles** via CesiumJS; requires your own Google Cloud Map Tiles API key with billing enabled
- Responsive iPhone / Android / desktop controls

## Important limitations
- Station coordinates are approximate illustrative locations and have not yet been independently validated against an official route geometry. The station names reflect the MRT Line 6 corridor; check [DMTCL](https://dmtcl.gov.bd/) for official information.
- The route line is an approximation connecting stations; this is **not** a survey-accurate railway alignment. The simulated train and station structures are not imported or extracted from Google Earth.
- Google photorealistic surface 3D coverage may be unavailable for this Dhaka location; fallback map still runs.
- Google imagery is accessed via the official API only, is not downloaded or cached, and Google map attribution must remain visible.
- Restrict your Google Cloud API key by HTTP referrer and to the Map Tiles API. Do not commit an unrestricted key.

## Run
Open `index.html` through GitHub Pages or a local static web server. For optional Google 3D, enable the Maps **Map Tiles API**, set up billing, then paste your restricted API key into the in-page input and select "Load Google 3D".

## Deploy
A deployment workflow is included at `.github/workflows/deploy-pages.yml`. In repository **Settings → Pages**, set **Source: GitHub Actions** to enable publishing. Once deployment succeeds, use https://mr04nazmul.github.io/Test/ . This address is a proposed Pages URL, not a verified live deployment.

## Attribution
© OpenStreetMap contributors for base map data. Google imagery © Google and its data providers when loaded through the official Map Tiles API. CesiumJS © Cesium contributors.
