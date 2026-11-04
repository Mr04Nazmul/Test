# MRT-6 detailed 3D reconstruction: reference and scope

## Scope
Reconstruct original, **not copied**, usable web 3D architecture from licensed public photographs, user-provided screenshots, OpenStreetMap (ODbL) route/road/building positions and original procedural textures. The target is the existing GitHub Pages metro site, not a replacement app.

## Evidence
- The Daily Star Agargaon aerial reference: https://www.thedailystar.net/news/bangladesh/transport/news/birds-eye-view-all-metro-rail-stations-3459691
- Agargaon station OSM object: https://www.openstreetmap.org/way/1125154697
- User's own source model (SHA256 verified): assets/cinematic/agargaon-detailed.glb, generated 2026-11-04.
- Current GitHub user project: https://github.com/Mr04Nazmul/Test

## Views and flow inventory
S01 Map-aligned 3D: OSM train alignment, station model, map imagery, street line positions, modelled building footprints.
S02 Cinematic scene: users open **Full Detail 3D** to explore a 37MB textured, original artistic scene, rotate, pinch zoom; **Back to Map** returns to source-grounded view.
S03 Train follow: scheduled simulation or explicit rider phone GPS separately labelled, never silently conflated with operator telemetry.
S04 Detail inspection: user pans around Agargaon's roof, station levels, viaduct, houses, traffic and tree objects.

## Layout/controls
Camera controls, mobile floating bottom rail, actual map imagery, visible provenance text. One-tap scene switching.

## Inferred scene model
StationIndex integer, center lon/lat, route polyline, mapped road ways, mapped building polygons (OSM); GeometryAsset {path, source, inferredAccuracy, bytes, materialCount, lastBuildChecksum}. Photo-inspired facades have **low** absolute geometry confidence; actual mapped footprints have **higher** location confidence but often missing measured heights.

## Non-cloneable material
Google Earth's proprietary 3D meshes, screenshots and Maps tiles are not harvested or redistributed. A single photograph cannot supply hidden building geometry or as-built dimensions. Authenticated DMTCL live control feeds are not connected. Equivalent original 3D meshes are rebuilt from sources with the correct usage rights.
