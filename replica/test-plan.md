# MRT-6 3D website checks

F01-H1 Open default map. Confirm OSM/satellite background and active Agargaon scene visible, not the cinematic model.
F01-E1 Road cache unavailable: continue with map imagery; never substitute invented roads and never label schedule as GPS.
F02-H1 Tap Full Detail 3D: load /assets/cinematic/agargaon-detailed.glb as a separate Cesium CustomDataSource; base tracked entities hide while original detailed model shows.
F02-H2 Rotate 360 degrees, pinch/zoom, inspect station, train and district. Tap Back to Map and confirm base entity collection and actual mapped roads restore.
F02-E1 GLB missing/404: show clear notification, remain in OSM view.
F02-E2 Slow 4G loading: model does not freeze buttons, display loading label; on mobile use balanced resolution, keep original static.
F02-N1 Cinematic accuracy label: must say estimated/artistic geometry, not exact Google Maps or official live GPS.
F03-H1 Find Train while cinematic: automatically return to mapped view and show a timetable estimate labelled correctly.
F04-H1 Validate glTF file integrity via SHA256, binary header, mesh count >=35, PBR images >=30.
F04-E1 Repeated switching and station changes restore native orbit/follow without stuck camera.
Manual QA needed: Safari iPhone, desktop Chrome, GPU capacity and memory; no claims of pixel-perfect photo match.
