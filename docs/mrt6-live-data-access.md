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
