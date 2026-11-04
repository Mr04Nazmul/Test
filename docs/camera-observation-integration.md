# MRT-6 private camera observation — implementation and integration

**Status 4 November 2026:** Functionality is committed in this repo. It is a **private station passage observation** feature, not actual DMTCL GPS, not a DMTCL CCTV connection, and not an operator ATS/CBTC/SI feed. **No real Dhaka Metro camera has been connected.** Unless actual permitted cameras and human observers participate, the panel correctly shows zero live sightings.

## What is installed and works without your own backend

- `index.html` includes a **Camera Sighting Network** panel in Train Radar. Click `Create Private Camera Watch` to get a private, random-id viewer invitation. Click Stop to disconnect and discard observations. A session can accept **up to eight participating camera observers**.
- `camera-watch.html` is a separate, mobile-friendly page opened by an **authorized** camera observer. The operator chooses one of the 16 real MRT-6 stations and explicitly opts in. The page **never opens a camera until the observer taps Start Camera and grants browser permission**.
- `camera-watch.js` can load **TensorFlow.js COCO-SSD on demand** to look for the COCO `train` class in the viewer-owned camera. Two consecutive candidate detections (score at least 0.58) are needed before a candidate is shown. **AI never submits an observation automatically**: the operator must visually confirm and click `I CONFIRM: Train Passed This Station`. A mistaken detector/observer could still produce false reports.
- When the observer manually confirms, `camera-observer-p2p.js` sends **only a station index, time, source label, method, optional confidence, and a random event ID** to the private viewer over WebRTC via PeerJS. **No images, video, audio, personally identifying location, or GPS are sent or recorded.** PeerJS uses third-party signaling; do not infer that the signaling service stores no metadata.
- `data/camera-observation-core.js` rejects invalid, duplicate, future or more-than-90-second-old events. The main 3D map shows a clearly labelled, temporary `📷 CAMERA SIGHTING · NOT GPS` station pin and a report in Train Radar. Events expire and pins disappear after 90 seconds.
- The observer page can optionally accept a **fresh sensor result in JSON** from its own permitted RailWatch/TrainBot/Rails49 installation, for human review and explicit confirmation. This is only a compatibility workflow, **not a direct live link to those projects**.

## Private, consent-driven usage

1. Open [Dhaka Metro 3D](https://mr04nazmul.github.io/Test/), then **Train Radar** → **Create Private Camera Watch**.
2. Use the Copy/Share button to deliver the private invitation to an operator who has permission to use a camera overlooking the railway. Share voluntarily; do not circulate as a public tracking link.
3. That observer opens the invite in a browser over HTTPS, selects their actual camera station, checks the permission box and taps **Connect to Private Viewer**.
4. The observer starts their permitted camera with the browser permission dialog. They can optionally load COCO-SSD AI, which stays in their browser. No camera frame is transmitted.
5. When a train actually passes the selected station, they must click **I CONFIRM: Train Passed This Station**. The viewer sees a station-side sighting on the 3D map for up to 90 seconds. No interpolation, remote train identity, or GPS coordinate for the train is claimed.

Camera detection may fail on overhead metro lines or low-light scenes. iPhone Safari backgrounding stops camera usage; reload/rejoin may be required. A station-side sighting does not identify which train passed or where that train is between cameras.

## Sensor compatibility, not native deployment

### [TrainsFYI/railwatch](https://github.com/TrainsFYI/railwatch)
Real Raspberry Pi / local RTSP camera inference and video tooling, with a pairing and cloud device protocol. **Its own camera app, hosted cloud and model are NOT bundled into this static GitHub Pages site.** The repository's public documentation does not provide an explicitly approved direct public feed for MRT-6. Its `docs/device-protocol.md` requires camera owner pairing. We do not copy its backend, model or API secrets. If you operate an authorized local sensor, you can review its fresh train detection and convert a local result to the JSON schema below.

### [jo-m/trainbot](https://github.com/jo-m/trainbot)
An archived single-camera detector. Its source is MIT licensed, with attribution requirements if code is copied. We **did not copy** its source; we support entering an observation derived from your own permitted instance.

### [rails49/occupancy](https://github.com/rails49/occupancy)
Designed for **model railway track occupancy, not metro train tracking**. Its public README describes an AGPL-3.0-derived detector, while the repo LICENSE contents seen in the linked checkout differ; licensing and model restrictions must be independently reconciled before copying/deploying a native detector. **We did not copy any of its source/weights.** An owner can review an observation from a separately permitted installation.

### Local sensor JSON accepted by observer page

With the proper source type selected, paste a **genuine, freshly generated** local sensor event:

```json
{
  "train_detected": true,
  "observed_at": "2026-11-04T00:00:00Z",
  "confidence": 0.92
}
```

This is **schema illustration**, not a real train sighting. The time must be no older than 30 seconds; confidence between 0.5 and 1. The operator must choose the actual station, validate, and **explicitly confirm**. Its source label stays `railwatch-compatible`, `trainbot-compatible` or `rails49-compatible`. A manually pasted JSON event is **not independent proof** of where a train is.

## Security, privacy, limitations

- No connection to DMTCL CBTC/ATS/OCC, internal network interfaces, operational CCTV or private passenger devices.
- No unauthorized camera streams, passive phone GPS surveillance or camera recordings. Camera permissions only after explicit clicks. No camera automatically starts.
- Viewer links contain a random invite secret in the URL fragment. Whoever possesses an invite can submit self-reported observations. This is **not an authenticated, operator-certified report**. Only share links with trusted participants. Close a watch after use.
- There is no shared public database, no persistent backend, no historical tracking, and no global user surveillance. GitHub Pages cannot self-host RailWatch's detection server.
- Never treat camera detections as operator GPS, vehicle identifiers, proven train occupancy, continuous train movement, or official public safety signals.
- For real multi-camera deployment, install each open-source sensor at a location with explicit permission, complete the corresponding training/licensing, and connect authenticated observation events through a separately deployed secure server, with known station ID, timestamps, rate limits, provenance, and revocation. Do not expose operator credentials or raw camera streams in GitHub Pages.

**Background:** [TensorFlow.js COCO-SSD documentation](https://github.com/tensorflow/tfjs-models/blob/master/coco-ssd/README.md). The code implements this browser AI capability independently and does not claim it is the TrainBot, RailWatch or Rails49 model.
