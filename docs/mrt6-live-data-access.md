# MRT-6 actual train telemetry access request — verified status

## Newly verified public evidence (4 November 2026)

1. **JICA DXLab / DMTCL official Dhaka Metro App RFP** issued 16 July 2024 (RFP JICADXL-DMTCL-20240716) proposes, on printed page 32, a **Train Schedule API** and **Notification API**, and identifies an **"App DB for schedule database, Real-Time Train Operations System managed by admin panel"**. That is a design/procurement requirement, **not a published production URL, GTFS-Realtime VehiclePositions feed, or proof that a third party can query train GPS**. [Original official JICA RFP](https://www.jica.go.jp/english/about/dx/jicadx/dxlab/project/detail_11/__icsFiles/afieldfile/2024/07/17/20240716_Dhaka_Metro_App_RFP_3.pdf).
2. [Bangladesh government data.gov.bd Transport catalog](https://data.gov.bd/group/transport) currently exposes only three listed datasets: road accidents, transport-sector GDP, and intercity train routes. No MRT-6 live position/GTFS-RT dataset was listed on 4 Nov 2026. Their [open-data FAQ](https://data.gov.bd/bn/faqs) says public non-sensitive data is encouraged for reuse, but any dataset's own access conditions and the applicable operator's approval still apply.
3. [DMTCL FAQ](https://dmtcl.gov.bd/pages/static-pages/6922dc72933eb65569e106c8) confirms its CBTC system has **ATS**, **ATO** and station passenger-information displays, but does not publish an external public feed URL or API credential.
4. [metrodhaka.com independent source audit](https://metrodhaka.com/about-us/) explicitly reports no public DMTCL API or GTFS-Realtime feed. This is external investigation rather than an official public feed inventory; continue checking when the operator supplies a link.
5. Two community-driven services may obtain *passenger phone GPS* but not operator telemetry: [BD Train Tracking by Gatishil Ventures](https://gatishil.com/support) and [MRT Mate](https://mrt.touhidapps.com/privacy-policy.php). They do not advertise a third-party redistribution API; their own data requires provider permission and consent. Public app screens, HTML, URLs or SDK code must not be reverse-engineered to bypass access controls.

**User reports having Bangladesh government authorization.** Scope, approved source, and developer endpoint/credentials were not provided to this project. General permission to reuse public government datasets does not create a missing feed URL, permit bypassing an internal control system, or grant rights to private third-party rider GPS.

**Action as of 4 Nov 2026:** A *Gmail draft*, not an outgoing email, was updated for directorom@dmtcl.gov.bd (cc operations/OCC) citing the JICA project reference and specifically asking for a sanitized, read-only, public-facing VehiclePositions/TripUpdates/ETA interface and written connection information. The earlier draft link remains in Gmail. Do not claim to have sent it.



**Last checked:** 2026-11-04 (Asia/Dhaka / Asia/Tokyo)

## Current reality

- No validated public DMTCL-operated MRT-6 VehiclePositions or live GTFS-Realtime feed URL was found.
- This public GitHub Pages website has **no DMTCL telemetry credential** and no actual fleet-wide GPS provider connected.
- Any red, orange or green train icons in Train Radar **must be labeled timetable estimates (NOT GPS)**.
- Passenger's privately consented phone location is a **phone observation**, not proof of a particular MRT6 vehicle.
- Imagery from Esri / Google Earth is **not live satellite surveillance** and does not establish live train positions.

## Correct, official operator contacts

[DMTCL list of officers](https://dmtcl.gov.bd/pages/officers):
- **Director (Operations and Maintenance)**: directorom@dmtcl.gov.bd
- **General Manager (Operations)**: gmoperation@dmtcl.gov.bd
- **Assistant Manager (Operations Control Centre Management)**: assttmgropcm@dmtcl.gov.bd

An English enquiry draft exists in the project owner's Gmail. **Creating a draft does not send an email.**

Request **authorization for a public-facing, read-only passenger-information export**, not access to ATS/CBTC/SCADA/OCC controls or signalling infrastructure. The operator may prefer sanitized station-to-station progress or estimated arrival times instead of precise vehicle coordinates.

## Other services evaluated (do not scrape)

- [BD Train Tracking by Gatishil Ventures](https://play.google.com/store/apps/details?id=com.gatishil.bdtrainguide): crowd-reported train data, including volunteered GPS for supported services. Written permission required for use in our app. Contact support@gatishil.com.
- [MRT Mate by Touhid Apps](https://mrt.touhidapps.com/): passenger live-location sharing feature; not a DMTCL operator feed. Its app terms restrict copying and independent redistribution. Contact touhidapps@gmail.com for authorized integration.
- [BD Train Tracker](https://play.google.com/store/apps/details?id=com.traintracker.bd): advertises voluntary GPS reports by MRT passengers but public redistribution API not established.
- [Mobility Database](https://mobilitydatabase.org/) and [Transitland](https://www.transit.land/): do not assume a Bangladeshi MRT6 GTFS-RT vehicle positions feed exists. Independent review: https://metrodhaka.com/about-us/

## Integration contract **if and only if written permission is obtained**

Use a separately authenticated server-side bridge, rather than exposing an operator API token in public GitHub Pages JavaScript. The public response should be read-only, rate-limited, signed or verified with source provenance and timestamp, and contain only permitted passenger-facing fields.

A safe normalized response could be:

```json
{
  "source": "AUTHORIZED_PROVIDER_NAME",
  "source_type": "operator_or_licensed_community",
  "license_reference": "URL_TO_WRITTEN_PERMISSION",
  "received_at": "ISO_8601_IN_UTC",
  "vehicles": [
    {
      "vehicle_id": "OPERATOR_GRANTED_PSEUDONYMOUS_ID",
      "observed_at": "ISO_8601_IN_UTC",
      "latitude": null,
      "longitude": null,
      "route_id": "MRT-6",
      "next_station_id": null,
      "direction": "north_or_south"
    }
  ]
}
```

This is a **schema only, not real data**. Non-GPS station progress / ETA can be published without coordinates if the license allows. Discard stale vehicle observations and distinguish their source visibly. Retain no rider identifiers, histories, advertising IDs or personal GPS coordinates without clear consent.

**Preferred international standard:** GTFS-Realtime VehiclePositions and TripUpdates, with stable IDs and observation timestamps; see https://gtfs.org/documentation/realtime/realtime-best-practices/.

**Do not** reverse engineer restricted control interfaces, run unauthorized network scans, bypass transport authentication or ingest nonpublic app/user data. We cannot make real fleet-wide positions appear without the operator/provider granting access.

## Next action

1. Review and **send** the prepared DMTCL Gmail draft to the verified operations contacts.
2. Review and send separate Gatishil Ventures and MRT Mate partnership drafts.
3. Obtain a specific approved endpoint, authentication mechanism, usage license, public display conditions and at least one validated live example.
4. Then build the secure adapter, connect it to this repository, test freshness and display genuine observations in a separate LIVE layer.


## Independent observation monitor implemented (2026-11-04)

The public website includes `data/independent-monitor.js`, an **independent passenger-phone observation model**, never a connection to the metro signalling or Automatic Train Supervision network. This is conceptually similar to a supervision map's **read-only status display**, not its signalling/control functionality.

- Accepts GPS observations only via the existing consent-based private rider session.
- Uses the open licensed OSM track polyline and DMTCL station positions.
- Projects the observed phone's GPS point to the nearest public rail segment; rejects obviously off-route, stale, or inaccurate samples.
- Shows station-to-station segment and nearest station; can infer travel direction and *phone-derived estimated speed* from consecutive observations when the GPS displacement exceeds uncertainty.
- Expires the observation after 20 seconds and keeps source explicitly `consenting rider phone`, `isTrainTelemetry:false` and `operatorVerified:false`. It does **not** prove that the phone is actually on a train.
- It never reads ATS, ATP, ATO, CBTC, interlocking, OCC, or train-control network data. No addresses, ports, authentication bypasses, packet captures or signal-control interfaces are used.
- `node scripts/check-independent-monitor.mjs` verifies route projection, provenance, freshness, rejects bad GPS, and integration in the frontend. GitHub Pages build runs this check automatically.

**Why this is not actual operator tracking:** MRT-6 uses Communication-Based Train Control, including ATS/ATO/ATP and Moving Block, as described by the [DMTCL official FAQ](https://dmtcl.gov.bd/pages/static-pages/6922e089933eb65569e27764). The system's authoritative vehicle localization is internal to railway operations. An independent website cannot recreate that authoritative knowledge without an approved passenger-information feed; historical satellite imagery and timetable estimates are not substitutes.

**If operator approval is granted:** please obtain the **specific approved read-only public API/base URL, credentials delivered securely, fields/data contract, use license, access scope and source timestamps**. Build a backend proxy for credentialed access (credentials must never be committed to GitHub Pages). Do not ask for or access signalling control networks.

## JICA Dhaka Metro App RFP: precise interpretation (verified 2026-11-04)

**Do not treat the JICA 2024 RFP as a live vehicle-location API.** In the JICA/DMTCL proposal, functional requirement **No. 22, "First and last metro time"** (printed p. 32) lists an **admin-panel push**, a proposed **Train Schedule API** and **Notification API**, and an app schedule DB related to a "Real-Time Train Operations System managed by admin panel." This is a *proposed integration for first/last train time information*, not a documented public endpoint for current train coordinates. The same page has no GTFS-RT VehiclePositions URL, response schema, authentication terms, or evidence of live vehicle GPS being available to third parties.

Primary source: [JICA RFP (16 July 2024), functional requirements, p. 32](https://www.jica.go.jp/english/about/dx/jicadx/dxlab/project/detail_11/__icsFiles/afieldfile/2024/07/17/20240716_Dhaka_Metro_App_RFP_3.pdf#page=33).

A **Rapid Pass / MRT Pass online recharge application** launched **12 January 2026**, but the official launch coverage describes **card recharge**, not live train-position data. This cannot be taken as confirmation the JICA real-time train API is publicly active:
- [Bangladesh Sangbad Sangstha, 12 Jan 2026](https://b.bssnews.net/news/350581)
- [Prothom Alo, 12 Jan 2026](https://en.prothomalo.com/amp/story/bangladesh/city/awdorw5qlv)

A 2026 [independent source audit](https://metrodhaka.com/about-us/) similarly reports no published open DMTCL API, GTFS or GTFS-Realtime feed. This is secondary evidence and does not prove absence of every private provider's feed.

**Practical currently integrated actual GPS:** the map's *Private Rider GPS* uses a consent-based WebRTC phone-sharing session; the viewer can copy the invitation or use the iPhone native Share Sheet. Each rider must opt in; observations are labelled rider PHONE (not operator-verified train) and expire after 20 seconds. Real train location still requires DMTCL's approved public passenger-information endpoint or a duly licensed, actively reporting provider. The approved vehicle adapter remains disabled until documented access exists.

No outbound email is authorized without a new explicit user request; earlier outreach in a previous turn does not authorize future mail.


## Real open-source GPS tool evaluation (4 November 2026)

These repositories were checked against their actual READMEs on GitHub. **These are software tools, not an already-operational DMTCL MRT-6 vehicle GPS data source.**

| Tool | What it can actually do | Requirement / limitation |
| --- | --- | --- |
| [OneBusAway/vehicle-positions](https://github.com/OneBusAway/vehicle-positions) | Go backend with rider-contributed (opt-in) GPS, route and trip verification, map-matched crowd observations and GTFS-Realtime VehiclePositions feed. Rider mode publishes with distinctive `rider:<trip_id>:<start_date>` identifiers and `source=rider`, and offers a iOS SDK. | Host a server, PostgreSQL, public MRT-6 GTFS static schedule (with shapes and trips), enabled rider mode, real consenting reporters. **Does not include a DMTCL public feed.** |
| [traccar/traccar](https://github.com/traccar/traccar) and [traccar/traccar-client](https://github.com/traccar/traccar-client) | Mature open-source GPS backend and iOS/Android clients, live location, device management and REST API. Can receive fresh consenting phone/device GPS from inside MRT-6. | Deploy HTTPS Traccar server, obtain clear opt-in, permissions and suitable data isolation; phone GPS is not an official train identity. Never expose personal location or server tokens through this public site. |
| [public-transport/gtfs-rt-inspector](https://github.com/public-transport/gtfs-rt-inspector) | Visualize and inspect an *existing* GTFS-Realtime VehiclePositions feed in a browser. | Requires a known published/CORS-accessible live data URL. Does not create coordinates or discover secured DMTCL operator telemetry. |
| [RJ-SMTR/pygtfsrealtime](https://github.com/RJ-SMTR/pygtfsrealtime) | Turn a **separately obtained raw GPS/AVL stream** into standards-compliant GTFS-Realtime VehiclePositions with route/trip matching. | Requires raw, authorized location reports and a GTFS feed. Not a GPS provider itself. |
| [imamhossain94/dhaka-metro-live-map](https://github.com/imamhossain94/dhaka-metro-live-map) | OpenStreetMap MRT-6 alignment and timetable-derived train animation. | Explicitly says all train positions are estimates; only the user's own location feature is true GPS. **Do not use as a live train feed.** |

### Recommended architecture for this website

1. **Now:** Continue current explicit opt-in `Private Rider GPS` for live phone observations, separately labelled. No operator feed is available; no invented vehicle positions.
2. **When testing actual consented passengers:** Traccar is easiest to self-host as a privacy-aware back end for multiple consenting phones. Do not publicly expose individuals' tracks or claim a phone is a specific train without corroboration.
3. **For a multi-rider transit-standard service:** OneBusAway/vehicle-positions can produce a properly labelled GTFS-Realtime crowdsource feed, but setting up its GTFS and backend and recruiting genuine riders are required. A test simulator is **not** live MRT-6 data.
4. **If DMTCL provides a read-only passenger-facing feed:** Use the site's gated `data/operator-live-feed.js` HTTPS adapter behind a backend proxy and verify origin, timestamps, route and reuse rights.

**No outreach:** The user explicitly forbids sending emails without renewed specific consent. Do not send any email as part of this project without asking.

## Additional public source investigation — 4 November 2026

**Requested goal:** actual current MRT-6 vehicle coordinates, not timetable estimates. Search for documented public read-only vehicle position feeds, GTFS-Realtime, government procurement and public GitHub projects. This investigation **did not yield a currently working MRT-6 actual vehicle-position endpoint**.

- [DMTCL tender listing](https://dmtcl.gov.bd/pages/tenders) publishes a **23 May 2026** EOI named **GPS-Based Vehicle Tracking and Fleet Monitoring System**. The public listing and [official notice](https://dmtcl.gov.bd/pages/notices/eoi-for-gps-based-vehicle-tracking-and-fleet-monitoring-system-hw9cq9-6a12a30f6985b94712ddb093) do not prove it tracks metro trainsets; it could refer to other vehicle fleets. There is no public streaming endpoint, API key or vehicle dataset in the listing. The exact subject and any subsequent deployment must be validated with source documents before presenting as a train feed.
- The GitHub search result [jqueguiner/gtfs Dhaka DMTCL](https://github.com/jqueguiner/gtfs/blob/main/BD/dhaka/dhaka-mass-transit-company-limited-dmtcl-metro-r-61baf9cd/feed.json) has `source: "llm-normalized"`, `format: "gtfs"`, a `raw.githubusercontent.com` synthesized URL and `license: null`. This is **not operator-issued GTFS-Realtime** and not current train coordinates. Do not load it as live GPS. Its `fetch.sh` points to a GitHub raw repository path, not an operator endpoint.
- [Metrodhaka independent source audit](https://metrodhaka.com/about-us/) reports no publicly issued DMTCL GTFS/GTFS-RT vehicle positions. Community apps such as [BD Train Tracker](https://play.google.com/store/apps/details?id=com.traintracker.bd) disclose their actual location source as **consenting riders' phone GPS** that may be absent when no rider shares. They are not operator telemetry, and reuse requires appropriate permission.
- [Google GTFS-Realtime documentation](https://developers.google.com/transit/gtfs-realtime) describes a *format/protocol*, not an MRT-6-specific live data feed. Public transit APIs in other countries are not interchangeable with DMTCL's MRT-6. A GitHub implementation of a tracker cannot generate real coordinates without data from a consenting reporting device, authorized camera, or sanctioned passenger-facing vehicle feed.

**Safety & consent:** User says the Bangladesh government has granted broad project permission, but the repository has not received an approved named endpoint and the exact network scope of a written authorization. Avoid any attempt to enumerate, scan or connect to railway CBTC/ATS/OCC, signalling, telemetry, CCTV or other protected operational infrastructure. Use only public official documentation or an expressly designated passenger-facing read-only provider API. Do not try to track nonconsenting passengers' phones; GPS-enabled phones do not publish coordinates to everyone. **Do not send any email without the user's renewed explicit authorization.**

**Current web status:** `Real GPS Only` mode deliberately hides simulated timetable trains when no verified observation is available. `data/operator-live-feed.js` remains permission-gated and `data/authorized-feed-config.js` disabled, since no bona fide source endpoint or credentials have been supplied. Actual observations are possible only from a genuinely connected authorized provider or consenting rider phone. No source has been found that provides live locations of every MRT-6 train at this time.
