# MRT-6 actual train telemetry access request — verified status

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
