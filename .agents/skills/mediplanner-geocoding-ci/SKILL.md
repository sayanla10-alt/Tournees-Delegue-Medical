---
name: mediplanner-geocoding-ci
description: Multi-source precision geolocation and neighborhood (Quartier) resolution for pharmacies and clinics in Côte d'Ivoire (Grand Abidjan & Zone Intérieur). Use when fixing or auditing geocoding in MediPlanner / Google Apps Script.
---

# MediPlanner — Precision Geocoding for Côte d'Ivoire Pharmacies

## Overview

Standard geocoders (`Maps.newGeocoder()`, Nominatim, or naive address lookups) fail on Côte d'Ivoire pharmacy lists because:
1. **Prefix variations**: Official UNPPCI / Ordre des Pharmaciens lists prefix names with `"Grande Pharmacie..."`, `"Nouvelle Pharmacie..."`, or `"Pharmacie Principale de..."`, whereas Google Maps and OpenStreetMap index the short name (or vice-versa).
2. **Embedded neighborhood words**: Names like `"Pharmacie Riviera Palmeraie"` or `"Nouvelle Pharmacie Riviera Sainte-Anne"` embed neighborhood words that differ from the POI label (`"Pharmacie Sainte Anne d'Abatta"`).
3. **Locality centroid trap**: When a geocoder cannot find a specific POI, it silently falls back to the **commune or city centroid** (`APPROXIMATE` / `Locality`), placing dozens of pharmacies at the exact same point in the middle of the city.
4. **OCR typos in field lists**: Scanned lists (`Liste terrain (photos)`) contain 1-2 character OCR errors (`"Semeur"` vs `"Sanwi"`, `"Élic"` vs `"Eliel"`, `"Adya"` vs `"Abya"`, `"Rive"` vs `"Mé"`, or `"Adzopé"` vs `"Adjamé"`).

## The Iterative Verification Protocol (Max 5 per Test Loop)

Never run a bulk geocoding update blindly across hundreds of rows:
1. **Sample at most 5 rows** per test iteration.
2. **Formulate a hypothesis** when any of the 5 rows fails or returns a low confidence score.
3. **Verify coordinates & neighborhood (`Quartier`)**:
   - Bounding box must cover all of Côte d'Ivoire (`lat: 4.3 .. 10.8`, `lon: -8.6 .. -2.4`), never just Abidjan.
   - Distance to the target commune centroid must be `<= 22 km` (unless an exact name/phone/titulaire match `>= 0.90` proves the commune column had an OCR error).
   - Reject city/commune centroids (`types` containing `locality`/`administrative_area` without `establishment`/`pharmacy`/`point_of_interest`, or ArcGIS `Type` in `City`/`Locality`).

## Multi-Source Resolution Pipeline

1. **Query Generation**:
   - Query 1: Full name + Quartier (if `!= 'NL'`) + Commune + `Côte d'Ivoire`
   - Query 2: Prefix-stripped name (`Grande `, `Nouvelle `, `Principale de `) + Quartier + Commune + `Côte d'Ivoire`
   - Query 3: Location-word-stripped core name + Commune + `Côte d'Ivoire`
   - Query 4: Prefix-stripped name + `Côte d'Ivoire` (catches commune OCR errors)
2. **Source 1 — Google Maps Embed (`output=embed`) + Categorical CID Resolution**:
   - Parse direct spotlit POI `["0x...:0x...","<FullAddress>",[<lat>,<lon>],"<cid>"],"<Title>"`
   - If categorical list returned, extract candidate CIDs `["<id>","<cid>"],"/g/...",null,[<latE7>,<lonE7>]` and resolve via `https://www.google.com/maps?cid=<cid>&output=embed&hl=fr`.
3. **Source 2 — Phone Number & Titulaire Verification**:
   - Compare the last 8 digits of the pharmacy phone number against the POI payload; a match guarantees `score = 1.0` even if the name has an OCR typo.
   - Compare the titular pharmacist surname (`Dr ...`) against the payload (`score = 0.98`).
4. **Source 3 — ArcGIS World Geocoder (`geocode.arcgis.com`)**:
   - Filter strictly to POI types (`Pharmacy`, `Medical Service`, `Health Care`, `Shop`, `Building`, `Point Address`).
5. **Source 4 — Google Apps Script `Maps.newGeocoder()` (Region `ci`)**:
   - Accept only results whose `types` include `pharmacy`, `health`, `establishment`, `point_of_interest`, or `street_address` (never `locality` / `political` alone).
6. **Neighborhood (`Quartier`) Extraction**:
   - Match extracted street address against the 108 reference `Quartiers` of the commune, or nearest reference `Quartier` within `4.5 km`, enriched with the street/landmark name.
