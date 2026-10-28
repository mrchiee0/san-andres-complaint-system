# Analytics Test Data Import Report

## Result

Imported a synthetic analytics fixture into the configured local database without deleting or replacing existing records. A database dump was taken before import. The fixture is identified by `AT-2026-` blotter numbers, `analytics_test_2026_` usernames, and `analytics-test-2026-` email addresses at the reserved `.test` domain. Five eligible, non-future-dated yellow-priority synthetic cases were subsequently completed for dashboard testing; their audit/disposition notes explicitly state that these are not real resident service outcomes.

The generated accounts use unique bcrypt hashes of random, unrecorded values. No plaintext password or shared test login is provided. They are marked email-verified and profile-complete so that the existing verified-account query recognizes them.

## Schema and application rules used

- Resident and non-resident profiles are stored in `residents` and `non_residents`; the `account_profiles` view combines those profiles for complaint ownership and verification checks.
- Complaints store the actual complaint type in `complaints.uri_ng_reklamo`, the mapped area name in `complaints.zone`, and the submitter link in `complaints.user_id`. `complaint_types` supplies the category.
- Complaint types and categories were read from active `complaint_types` rows in the live database. Locations were read from active, non-deleted `boundaries` whose `boundary_types` are active. Every generated location coordinate is inside its selected polygon, and `detected_boundary_ids` contains the matching boundary IDs.
- Verified Accounts uses `account_profiles.role = 'mamamayan' AND email_verified = 1`; the fixture sets `email_verified = 1`, `verified_at`, and `profile_completed = 1`.
- The supported terminal complaint status is `natapos`; supported unresolved statuses used here are `bago`, `sinusuri`, `naka-assign`, `iniimbestigahan`, and `sa-mediation`.
- Resolved cases receive `case_dispositions` with resolution details and dates. Filing history, status audit events, and staff actions are added to `complaint_history`, `complaint_audit`, and `actions`. Three ongoing ASB scenarios are marked eligible for mediation and receive schedules and mediation audit entries.
- The admin hotspot query counts only non-deleted complaints whose status is not `natapos` or `archived`, grouped by the same mapped boundary names rendered on the map. It does not count resolved cases as active hotspots.

## Fixture validation

| Measure | Imported |
|---|---:|
| Generated complaints | 90 |
| Resolved (`natapos`) | 70 |
| Unresolved / active | 20 |
| Resident accounts | 80 |
| Non-resident accounts | 10 |
| Verified complaint-linked accounts | 90 / 90 |
| Resolutions with documentation | 70 / 70 |
| Scheduled mediation cases | 3 |
| Complaint submission dates | 2026-08-12 to 2026-10-26 |
| Complaints outside requested date range | 0 |

The exact generated complaint-category totals are:

| Category | Complaints |
|---|---:|
| Environmental & Public Nuisance | 17 |
| Neighborhood & Infrastructure | 17 |
| Property & Zoning Violations | 18 |
| Social & Safety Concerns | 18 |
| Traffic & Parking | 15 |
| Others | 5 |

Complaint types use the database’s active names and categories:

| Type | Category | Count |
|---|---|---:|
| Noise Complaints | Environmental & Public Nuisance | 6 |
| Pest Control | Environmental & Public Nuisance | 5 |
| Waste and Sanitation | Environmental & Public Nuisance | 6 |
| Roads and Sidewalks | Neighborhood & Infrastructure | 6 |
| Street Lighting | Neighborhood & Infrastructure | 5 |
| Utility Disruptions | Neighborhood & Infrastructure | 6 |
| Blight and Maintenance | Property & Zoning Violations | 6 |
| Short-Term Rentals | Property & Zoning Violations | 6 |
| Zoning and Land Use | Property & Zoning Violations | 6 |
| Anti-Criminality | Social & Safety Concerns | 5 |
| Anti-Social Behavior (ASB) | Social & Safety Concerns | 8 |
| Safety Hazards | Social & Safety Concerns | 5 |
| Abandoned Vehicles | Traffic & Parking | 5 |
| Illegal Parking | Traffic & Parking | 6 |
| Traffic Safety | Traffic & Parking | 4 |
| Others | Others | 5 |

Generated complaints by mapped area (resolved and unresolved combined):

| Database area name | Complaints |
|---|---:|
| Eastbank Floodway | 15 |
| Westbank Floodway | 13 |
| Floodway Upper Block | 11 |
| PFCI | 9 |
| Felix Compound | 8 |
| A Prime | 3 |
| Cainta Semetery | 3 |
| Cambridge | 3 |
| Campi | 3 |
| DM 6&7 | 2 |
| DM5 | 2 |
| Domus | 2 |
| Floodway Lower Block | 2 |
| Midtown | 2 |
| Parola Compound | 2 |
| Poblacion | 2 |
| Rodfer Compound | 2 |
| Summer Green | 2 |
| Christine Royale Executive | 1 |
| Greenwods Executive | 1 |
| Mercedes Executive Village | 1 |
| Pag-Ibig Homes | 1 |

The requested labels were mapped to existing database names rather than creating or renaming areas: East Bank Floodway → `Eastbank Floodway`; West Bank Floodway → `Westbank Floodway`; Felix Subdivision → `Felix Compound`; Greenwoods → `Greenwods Executive` (spelling as stored); Christine Royale → `Christine Royale Executive`. The four lowest-volume requested areas have one generated complaint each.

## Existing-system totals and analytics

The database contained 12 complaints before import; one is already soft-deleted. The existing reports exclude soft-deleted complaints, so the system-wide report contains 101 records: 70 resolved and 31 active (the 90 generated cases plus 11 pre-existing non-deleted cases). The fixture itself remains exactly 90 records with 70 resolved and 20 active; the Reports page was not changed to hide existing complaints.

Five synthetic yellow-priority test cases were completed using the normal resolved status, audit, action, and disposition records:

| Fixture | Type | Result |
|---|---|---|
| `AT-2026-0073` | Short-Term Rentals | Synthetic closure recorded |
| `AT-2026-0084` | Noise Complaints | Synthetic closure recorded |
| `AT-2026-0087` | Blight and Maintenance | Synthetic closure recorded |
| `AT-2026-0088` | Zoning and Land Use | Synthetic closure recorded |
| `AT-2026-0089` | Short-Term Rentals | Synthetic closure recorded |

The system-wide resolved share is 69.3% (70/101); the fixture-only share is 77.8% (70/90). Both are influenced by synthetic records and must not be interpreted as actual service performance.

The resolution-cycle average is calculated from documented resolution dispositions rather than counting unresolved cases through the current date. After the five synthetic closures, the verified system-wide average was 4.99 days. Weekly trend buckets are Monday-start weeks, limited to the latest 12 weeks, and exclude future-dated test records.

After import, the active mapped heatmap counts were verified directly against the same status and boundary filters used by the server:

| Area | System-wide active count | Heat color |
|---|---:|---|
| Eastbank Floodway | 12 | Critical (red) |
| Westbank Floodway | 11 | Critical (red) |
| Floodway Upper Block | 3 | Warning (yellow) |
| DM5 | 1 | Warning (yellow) |
| PFCI | 1 | Warning (yellow) |
| Midtown | 1 | Warning (yellow) |
| Cainta Semetery | 1 | Warning (yellow) |

The remaining mapped areas currently have zero active complaints and therefore do not appear in the admin hotspot list. These counts include active pre-existing complaints as well as the test fixture.

## Import and repeat-run instructions

The import utility is [scripts/seedAnalyticsTestData.ts](./scripts/seedAnalyticsTestData.ts).

```powershell
npm run seed:analytics
npm run seed:analytics -- --apply
```

The first command is a read-only dry run and prints the planned distributions. The second imports only if the fixture identifiers are absent, uses one transaction, and rolls back unless the required totals and relationships validate. A complete valid fixture is detected on later runs and left unchanged. Partial fixtures are not automatically deleted or repaired.

## Validation performed

- Read the live schema, active complaint types, mapped areas, account-verification logic, and existing complaint counts before preparing the fixture.
- Took a full database dump before import.
- Ran the dry run, then imported the fixture with transactional pre-commit checks.
- Queried complaint dates, statuses, category/type counts, area counts, account verification, dispositions, mediation schedules, and system-wide active heatmap counts after import.
- Confirmed that rerunning the seeder is a no-op for a complete valid fixture.
- `npm run lint`, `npm test`, and `npm run build` passed. The build retains the pre-existing large-chunk warning.

No evidence files or witness records were invented. No new database columns, categories, complaint types, statuses, or geographic areas were added.
