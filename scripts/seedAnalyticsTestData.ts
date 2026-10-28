import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { Geometry, Position } from 'geojson';
import { detectBoundaryMatches, parseBoundaryGeometry } from '../src/services/boundaryGeometry.ts';
import type { BoundaryGeometry } from '../src/services/boundaryGeometry.ts';

const START_DATE = '2026-08-12';
const AS_OF_DATE = '2026-10-26';
const EMAIL_PREFIX = 'analytics-test-2026-';
const USERNAME_PREFIX = 'analytics_test_2026_';
const BLOTTER_PREFIX = 'AT-2026-';
const COMPLETED_YELLOW_ACTIVE_INDEXES = new Map([
  [7, 'Short-Term Rentals'],
  [18, 'Noise Complaints'],
  [21, 'Blight and Maintenance'],
  [22, 'Zoning and Land Use'],
  [23, 'Short-Term Rentals'],
]);

const AREA_COUNTS: Record<string, number> = {
  'Eastbank Floodway': 15,
  'Westbank Floodway': 13,
  'Floodway Upper Block': 11,
  PFCI: 9,
  'Felix Compound': 8,
  'A Prime': 3,
  'Cainta Semetery': 3,
  Cambridge: 3,
  Campi: 3,
  'DM 6&7': 2,
  DM5: 2,
  Domus: 2,
  'Floodway Lower Block': 2,
  Midtown: 2,
  'Parola Compound': 2,
  Poblacion: 2,
  'Rodfer Compound': 2,
  'Summer Green': 2,
  'Greenwods Executive': 1,
  'Pag-Ibig Homes': 1,
  'Mercedes Executive Village': 1,
  'Christine Royale Executive': 1,
};

const ACTIVE_COUNTS: Record<string, number> = {
  'Eastbank Floodway': 10,
  'Westbank Floodway': 6,
  'Floodway Upper Block': 4,
  PFCI: 2,
  'Felix Compound': 1,
  'A Prime': 1,
  'Cainta Semetery': 1,
};

const MEDIATION_AREAS = new Set(['Eastbank Floodway', 'Westbank Floodway', 'PFCI']);

const TYPE_DESCRIPTIONS: Record<string, (area: string, date: string, index: number) => string> = {
  'Roads and Sidewalks': (area, date) => `On ${date}, a damaged section of the local access road near ${area} caused vehicles to slow down and pedestrians to step into the carriageway. The complainant requests an inspection and repair schedule.`,
  'Street Lighting': (area, date) => `On ${date}, a streetlight near ${area} remained unlit after dusk, leaving the pedestrian route difficult to see. The complainant requests an inspection and replacement of the faulty lamp.`,
  'Utility Disruptions': (area, date) => `On ${date}, rainwater pooled along a drainage channel near ${area} after the outlet appeared obstructed. The complainant requests a drainage inspection and clearing if needed.`,
  'Noise Complaints': (area, date) => `On ${date}, amplified music from a nearby residence in ${area} continued late into the evening and disturbed neighboring households. The complainant requests a barangay reminder about quiet hours.`,
  'Waste and Sanitation': (area, date) => `On ${date}, household waste was left beside the collection point in ${area} after the scheduled pickup, attracting stray animals. The complainant requests a collection check and sanitation follow-up.`,
  'Pest Control': (area, date) => `On ${date}, the complainant observed standing water and mosquito activity near a shared drainage area in ${area}. The complainant requests an inspection and appropriate pest-control guidance.`,
  'Blight and Maintenance': (area, date) => `On ${date}, an overgrown vacant lot beside a walkway in ${area} obstructed visibility and accumulated litter. The complainant requests that the responsible property contact be notified to maintain the site.`,
  'Zoning and Land Use': (area, date) => `On ${date}, repeated deliveries and customer activity at a property in ${area} raised a concern about a possible unregistered residential business. The complainant requests a site review under applicable barangay procedures.`,
  'Short-Term Rentals': (area, date) => `On ${date}, frequent short-stay visitors and late arrivals at a nearby property in ${area} caused recurring disturbance. The complainant requests verification of the concern and guidance to the property contact.`,
  'Illegal Parking': (area, date) => `On ${date}, a vehicle was repeatedly parked across a driveway entrance near ${area}, restricting residents' access. The complainant requests that the vehicle owner be contacted and the access route kept clear.`,
  'Abandoned Vehicles': (area, date) => `On ${date}, a vehicle that appeared unmoved for several weeks occupied part of the roadside in ${area}. The complainant requests that its ownership and status be checked through the appropriate process.`,
  'Traffic Safety': (area, date) => `On ${date}, vehicles were observed travelling quickly along a residential stretch in ${area} while pedestrians were crossing. The complainant requests a safety assessment and suitable traffic-calming advice.`,
  'Anti-Social Behavior (ASB)': (area, date, index) => `On ${date}, a recurring disagreement between nearby households in ${area} escalated into a verbal disturbance witnessed by neighbors. The complainant requests a staff review and, if both parties agree, a facilitated discussion (synthetic case ${index}).`,
  'Safety Hazards': (area, date) => `On ${date}, loose materials at a small repair site near ${area} extended into a shared pedestrian path. The complainant requests that the site be checked and the obstruction made safe.`,
  'Anti-Criminality': (area, date) => `On ${date}, an unknown person repeatedly entered a shared residential passage in ${area} without permission. No injury or property loss was reported; the complainant requests that the concern be documented and referred appropriately.`,
  Others: (area, date) => `On ${date}, the complainant noticed a recurring community concern in ${area} that does not fit the listed complaint types. The complainant requests an initial review and referral to the appropriate barangay service.`,
};

type AreaRow = {
  id: number;
  name: string;
  parent_id: number | null;
  geometry: Geometry | string;
};

type ComplaintTypeRow = { name: string; category: string };
type ComplaintFixture = {
  area: AreaRow;
  active: boolean;
  status: string;
  type: ComplaintTypeRow;
  resident: boolean;
  complainantIndex: number;
  filedAt: string;
  incidentAt: string;
  latitude: number;
  longitude: number;
  detectedBoundaryIds: number[];
  respondentName: string;
  details: string;
  transitions: Array<{ status: string; at: string; remarks: string }>;
  resolutionAt?: string;
  resolutionDetails?: string;
  mediationAt?: string;
};

const pad = (value: number) => String(value).padStart(2, '0');
const emailFor = (index: number) => `${EMAIL_PREFIX}${String(index).padStart(4, '0')}@example.test`;
const usernameFor = (index: number) => `${USERNAME_PREFIX}${String(index).padStart(4, '0')}`;
const sqlDate = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
const dateOnly = (date: Date) => sqlDate(date).slice(0, 10);
const atDate = (date: string, hour = 10, minute = 0) => new Date(`${date}T${pad(hour)}:${pad(minute)}:00Z`);
const addDays = (date: string, days: number, hour = 10) => {
  const result = atDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  result.setUTCHours(hour);
  return sqlDate(result);
};

function coordinates(geometry: BoundaryGeometry): Position[] {
  const positions: Position[] = [];
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      positions.push(value as Position);
      return;
    }
    value.forEach(visit);
  };
  visit(geometry.coordinates);
  return positions;
}

function pointInsideArea(area: AreaRow, allBoundaries: AreaRow[]) {
  const geometry = parseBoundaryGeometry(area.geometry);
  const positions = coordinates(geometry);
  if (!positions.length) throw new Error(`Boundary "${area.name}" has no coordinates.`);

  const longitudes = positions.map(([longitude]) => longitude);
  const latitudes = positions.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const candidates: Array<[number, number]> = [];

  for (const polygon of geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) {
    const ring = polygon[0] || [];
    if (ring.length) {
      candidates.push([
        ring.reduce((sum, [longitude]) => sum + longitude, 0) / ring.length,
        ring.reduce((sum, [, latitude]) => sum + latitude, 0) / ring.length,
      ]);
    }
  }
  candidates.push([(minLongitude + maxLongitude) / 2, (minLatitude + maxLatitude) / 2]);
  for (let row = 0; row <= 80; row++) {
    for (let column = 0; column <= 80; column++) {
      candidates.push([
        minLongitude + (maxLongitude - minLongitude) * column / 80,
        minLatitude + (maxLatitude - minLatitude) * row / 80,
      ]);
    }
  }

  const active = allBoundaries.map((boundary) => ({
    ...boundary,
    geometry: parseBoundaryGeometry(boundary.geometry),
  }));
  for (const [longitude, latitude] of candidates) {
    const candidate = point([longitude, latitude]);
    if (!booleanPointInPolygon(candidate, { type: 'Feature', properties: {}, geometry })) continue;
    const matches = detectBoundaryMatches(latitude, longitude, active);
    if (matches.some((match) => match.id === area.id)) {
      return {
        latitude: Number(latitude.toFixed(7)),
        longitude: Number(longitude.toFixed(7)),
        detectedBoundaryIds: matches.map((match) => match.id),
      };
    }
  }
  throw new Error(`Unable to find an in-boundary test location for "${area.name}".`);
}

function buildFixtures(areas: AreaRow[], types: ComplaintTypeRow[]) {
  const areaByName = new Map(areas.map((area) => [area.name, area]));
  const areaRows = Object.entries(AREA_COUNTS).flatMap(([name, count]) => {
    const area = areaByName.get(name);
    if (!area) throw new Error(`Required mapped area "${name}" is not active in the database.`);
    return Array.from({ length: count }, () => area);
  });
  const activeAreas = new Set(Object.keys(ACTIVE_COUNTS));
  const typeByName = new Map(types.map((type) => [type.name, type]));
  const orderedTypeNames = Object.keys(TYPE_DESCRIPTIONS);
  const selectedTypes = orderedTypeNames.map((name) => {
    const type = typeByName.get(name);
    if (!type) throw new Error(`Complaint type "${name}" is missing or inactive in the database.`);
    return type;
  });
  if (selectedTypes.length !== types.length) {
    const unexpected = types.filter((type) => !TYPE_DESCRIPTIONS[type.name]);
    if (unexpected.length) throw new Error(`Unmapped active complaint types: ${unexpected.map((type) => type.name).join(', ')}.`);
  }

  const locationById = new Map<number, ReturnType<typeof pointInsideArea>>();
  for (const area of new Map(areas.map((value) => [value.id, value])).values()) {
    locationById.set(area.id, pointInsideArea(area, areas));
  }

  const allCases: Array<{ area: AreaRow; active: boolean; areaIndex: number }> = [];
  const seenByArea = new Map<string, number>();
  for (const area of areaRows) {
    const areaIndex = seenByArea.get(area.name) || 0;
    seenByArea.set(area.name, areaIndex + 1);
    const active = areaIndex < (ACTIVE_COUNTS[area.name] || 0);
    allCases.push({ area, active, areaIndex });
  }
  const unresolved = allCases.filter((item) => item.active);
  const mediationCases = new Set(
    unresolved.filter(({ area, areaIndex }) => MEDIATION_AREAS.has(area.name) && areaIndex === 0),
  );
  if (mediationCases.size !== MEDIATION_AREAS.size) throw new Error('The three planned mediation cases could not be allocated.');

  const statusCounts = [
    ['bago', 6],
    ['sinusuri', 5],
    ['naka-assign', 4],
    ['iniimbestigahan', 7],
  ] as const;
  const otherActiveStatuses = statusCounts.flatMap(([status, count]) => Array.from({ length: count }, () => status));
  let nextActiveStatus = 0;
  const typesForCases = allCases.map((_, index) => selectedTypes[index % selectedTypes.length]);
  const resolvedCases = allCases.filter((item) => !item.active);
  const unresolvedCases = allCases.filter((item) => item.active);
  const locationCache = new Map(areas.map((area) => [area.id, locationById.get(area.id)!]));

  const createFixture = (
    item: (typeof allCases)[number],
    globalIndex: number,
    activeIndex?: number,
    resolutionIndex?: number,
    completeActiveCase = false,
  ): ComplaintFixture => {
    const mediation = mediationCases.has(item);
    const workflowStatus = item.active
      ? mediation ? 'sa-mediation' : otherActiveStatuses[nextActiveStatus++]
      : 'natapos';
    const status = completeActiveCase ? 'natapos' : workflowStatus;
    const type = mediation
      ? typeByName.get('Anti-Social Behavior (ASB)')!
      : typesForCases[globalIndex];
    const day = item.active
      ? workflowStatus === 'bago'
        ? 21 + ((activeIndex || 0) % 6)
        : workflowStatus === 'sinusuri'
          ? 16 + ((activeIndex || 0) % 6)
          : workflowStatus === 'naka-assign'
              ? 13 + ((activeIndex || 0) % 4)
              : workflowStatus === 'iniimbestigahan'
                ? 10 + ((activeIndex || 0) % 6)
              : 10 + ((activeIndex || 0) % 5)
      : 12 + Math.floor((resolutionIndex || 0) * 55 / 64);
    const filedDate = item.active
      ? `2026-10-${pad(day)}`
      : (() => {
        const start = atDate(START_DATE);
        start.setUTCDate(start.getUTCDate() + day - 12);
        return dateOnly(start);
      })();
    const filedAt = sqlDate(atDate(filedDate, 8 + (globalIndex % 10), (globalIndex * 7) % 60));
    const incidentDate = (() => {
      const incident = atDate(filedDate);
      incident.setUTCDate(incident.getUTCDate() - Math.min(3, globalIndex % 4));
      return dateOnly(incident < atDate(START_DATE) ? atDate(START_DATE) : incident);
    })();
    const resolutionAt = item.active && !completeActiveCase ? undefined : addDays(filedDate, 2 + (globalIndex % 7), 14);
    const mediationAt = mediation ? `2026-10-${pad(24 + ((activeIndex || 0) % 3))} 10:00:00` : undefined;
    const transitionStatuses = item.active && !completeActiveCase
      ? status === 'bago'
        ? []
        : status === 'sinusuri'
          ? ['sinusuri']
          : status === 'naka-assign'
            ? ['sinusuri', 'naka-assign']
            : status === 'iniimbestigahan'
              ? ['sinusuri', 'naka-assign', 'iniimbestigahan']
              : ['sinusuri', 'naka-assign', 'sa-mediation']
      : ['sinusuri', 'naka-assign', 'iniimbestigahan', 'natapos'];
    const eventBase = atDate(filedDate);
    const transitions = transitionStatuses.map((nextStatus, index) => {
      const eventDate = new Date(eventBase);
      eventDate.setUTCDate(eventDate.getUTCDate() + index + 1);
      return {
        status: nextStatus,
        at: sqlDate(eventDate),
        remarks: nextStatus === 'natapos'
          ? `Synthetic fixture resolution: follow-up completed and the parties were given the outcome. Case ${globalIndex + 1}.`
          : `Synthetic fixture update to ${nextStatus}; follow-up recorded for case ${globalIndex + 1}.`,
      };
    });
    if (resolutionAt && transitions.length) transitions[transitions.length - 1].at = resolutionAt;
    const description = TYPE_DESCRIPTIONS[type.name](item.area.name, incidentDate, globalIndex + 1);
    const location = locationCache.get(item.area.id)!;
    return {
      area: item.area,
      active: item.active && !completeActiveCase,
      status,
      type,
      resident: globalIndex < 80,
      complainantIndex: globalIndex + 1,
      filedAt,
      incidentAt: incidentDate,
      latitude: location.latitude,
      longitude: location.longitude,
      detectedBoundaryIds: location.detectedBoundaryIds,
      respondentName: `Analytics Test Respondent ${String(globalIndex + 1).padStart(3, '0')}`,
      details: `${description} Synthetic analytics fixture ${BLOTTER_PREFIX}${String(globalIndex + 1).padStart(4, '0')}.`,
      transitions,
      resolutionAt,
      resolutionDetails: item.active && !completeActiveCase ? undefined : `Synthetic test resolution for case ${globalIndex + 1}: staff documented the follow-up and communicated the outcome to both parties.`,
      mediationAt,
    };
  };

  const resolvedFixtures = resolvedCases.map((item, index) => createFixture(item, index, undefined, index));
  const activeFixtures = unresolvedCases.map((item, index) => {
    const fixture = createFixture(
      item,
      resolvedFixtures.length + index,
      index,
      resolvedFixtures.length + index,
      COMPLETED_YELLOW_ACTIVE_INDEXES.has(index),
    );
    const expectedType = COMPLETED_YELLOW_ACTIVE_INDEXES.get(index);
    if (expectedType && fixture.type.name !== expectedType) {
      throw new Error(`Fixture completion ${index} expected yellow-priority "${expectedType}", not "${fixture.type.name}".`);
    }
    return fixture;
  });
  const fixtures = [...resolvedFixtures, ...activeFixtures];
  if (fixtures.length !== 90 || fixtures.filter(({ status }) => status === 'natapos').length !== 70 || fixtures.filter(({ active }) => active).length !== 20) {
    throw new Error('The planned fixture failed the required 90/70/20 totals.');
  }
  if (fixtures.some((fixture) => fixture.filedAt.slice(0, 10) < START_DATE || fixture.filedAt.slice(0, 10) > AS_OF_DATE)) {
    throw new Error('A generated complaint date falls outside the specified timeline.');
  }
  if (fixtures.some((fixture) => fixture.resolutionAt && fixture.resolutionAt.slice(0, 10) > AS_OF_DATE)) {
    throw new Error('A generated resolution occurs after the specified testing date.');
  }
  return fixtures;
}

function printPlan(fixtures: ComplaintFixture[]) {
  const tally = (key: (fixture: ComplaintFixture) => string) => {
    const result = new Map<string, number>();
    for (const fixture of fixtures) result.set(key(fixture), (result.get(key(fixture)) || 0) + 1);
    return Object.fromEntries([...result.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
  };
  console.log(`Planned test fixture: ${fixtures.length} complaints (${fixtures.filter(({ status }) => status === 'natapos').length} resolved, ${fixtures.filter(({ active }) => active).length} active).`);
  console.log('Accounts: 80 residents, 10 non-residents; every account is marked email-verified.');
  console.log(`Timeline: ${fixtures.reduce((min, fixture) => fixture.filedAt.slice(0, 10) < min ? fixture.filedAt.slice(0, 10) : min, AS_OF_DATE)} to ${fixtures.reduce((max, fixture) => fixture.filedAt.slice(0, 10) > max ? fixture.filedAt.slice(0, 10) : max, START_DATE)}.`);
  console.log('Area counts:', JSON.stringify(tally(({ area }) => area.name), null, 2));
  console.log('Complaint type counts:', JSON.stringify(tally(({ type }) => `${type.category} / ${type.name}`), null, 2));
  console.log('Status counts:', JSON.stringify(tally(({ status }) => status), null, 2));
  console.log('Scheduled mediation cases:', fixtures.filter(({ mediationAt }) => Boolean(mediationAt)).length);
  console.log('Requested labels use database names: East Bank Floodway → Eastbank Floodway; West Bank Floodway → Westbank Floodway; Felix Subdivision → Felix Compound; Greenwoods → Greenwods Executive; Christine Royale → Christine Royale Executive.');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'san_andres_complaint_system',
    connectTimeout: 5000,
  });

  try {
    await connection.query('SET TRANSACTION READ ONLY');
    await connection.beginTransaction();
    const [[accountCount]] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT
        (SELECT COUNT(*) FROM residents WHERE username LIKE ?) +
        (SELECT COUNT(*) FROM non_residents WHERE username LIKE ?) AS accounts`,
      [`${USERNAME_PREFIX}%`, `${USERNAME_PREFIX}%`],
    );
    const [[complaintCount]] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) AS complaints FROM complaints WHERE blotter_number LIKE ?',
      [`${BLOTTER_PREFIX}%`],
    );
    if (Number(accountCount.accounts) || Number(complaintCount.complaints)) {
      if (Number(accountCount.accounts) === 90 && Number(complaintCount.complaints) === 90) {
        const [[existingStats]] = await connection.query<mysql.RowDataPacket[]>(`
          SELECT SUM(status = 'natapos') AS resolved,
                 SUM(status NOT IN ('natapos', 'archived')) AS active
          FROM complaints WHERE blotter_number LIKE ?
        `, [`${BLOTTER_PREFIX}%`]);
        const [[existingAccounts]] = await connection.query<mysql.RowDataPacket[]>(`
          SELECT
            (SELECT COUNT(*) FROM residents WHERE username LIKE ? AND email_verified = 1 AND profile_completed = 1) AS residents,
            (SELECT COUNT(*) FROM non_residents WHERE username LIKE ? AND email_verified = 1 AND profile_completed = 1) AS non_residents
        `, [`${USERNAME_PREFIX}%`, `${USERNAME_PREFIX}%`]);
        const [[existingDispositions]] = await connection.query<mysql.RowDataPacket[]>(`
          SELECT COUNT(*) AS count FROM case_dispositions
          WHERE action_type = 'resolved'
            AND complaint_id IN (SELECT id FROM complaints WHERE blotter_number LIKE ?)
        `, [`${BLOTTER_PREFIX}%`]);
        const [[existingMediations]] = await connection.query<mysql.RowDataPacket[]>(`
          SELECT COUNT(*) AS count FROM schedules
          WHERE complaint_id IN (SELECT id FROM complaints WHERE blotter_number LIKE ?)
        `, [`${BLOTTER_PREFIX}%`]);
        if (
          Number(existingStats.resolved) !== 70 || Number(existingStats.active) !== 20 ||
          Number(existingAccounts.residents) !== 80 || Number(existingAccounts.non_residents) !== 10 ||
          Number(existingDispositions.count) !== 70 || Number(existingMediations.count) !== 3
        ) {
          throw new Error('A fixture with the expected record count already exists but fails validation. No records were changed.');
        }
        await connection.rollback();
        console.log('The complete, validated analytics fixture is already present; no changes made.');
        return;
      }
      throw new Error('A partial analytics fixture already exists. No records were changed; inspect and clean it manually before retrying.');
    }

    const [areas] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT b.id, b.name, b.parent_id, b.geometry
      FROM boundaries b
      JOIN boundary_types bt ON bt.id = b.type_id
      WHERE b.status = 'active' AND b.deleted_at IS NULL AND bt.is_active = 1
        AND NOT (LOWER(bt.name) = 'barangay' AND LOWER(b.name) = 'barangay san andres')
      ORDER BY b.name
    `);
    const [types] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT name, category FROM complaint_types WHERE is_active = 1 ORDER BY category, name',
    );
    const [admins] = await connection.query<mysql.RowDataPacket[]>(
      "SELECT user_id FROM administrators WHERE role = 'admin' ORDER BY user_id LIMIT 1",
    );
    const [[nextIdRow]] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT next_id FROM account_sequence WHERE id = 1',
    );
    if (!admins.length) throw new Error('An existing administrator account is required to attribute case actions.');
    if (!nextIdRow) throw new Error('The account_sequence row is missing; no records were changed.');

    const fixture = buildFixtures(areas as unknown as AreaRow[], types as unknown as ComplaintTypeRow[]);
    printPlan(fixture);
    if (!apply) {
      await connection.rollback();
      console.log('Dry run only. Re-run with --apply to import this fixture.');
      return;
    }

    await connection.rollback();
    await connection.beginTransaction();
    const [[sequence]] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT next_id FROM account_sequence WHERE id = 1 FOR UPDATE',
    );
    if (!sequence) throw new Error('The account_sequence row is missing; no records were changed.');
    const baseId = Number(sequence.next_id);
    const [[maxIdRow]] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT GREATEST(
        COALESCE((SELECT MAX(user_id) FROM residents), 0),
        COALESCE((SELECT MAX(user_id) FROM non_residents), 0),
        COALESCE((SELECT MAX(user_id) FROM administrators), 0)
      ) AS max_id
    `);
    if (baseId <= Number(maxIdRow.max_id)) {
      throw new Error('The account sequence is behind existing accounts. Correct it before importing the fixture.');
    }
    const [emailConflicts] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT email FROM residents WHERE email LIKE ? UNION ALL SELECT email FROM non_residents WHERE email LIKE ?',
      [`${EMAIL_PREFIX}%`, `${EMAIL_PREFIX}%`],
    );
    if (emailConflicts.length) throw new Error('A fixture email already exists; no records were changed.');

    const staffId = Number(admins[0].user_id);
    const fixtureUserIds = fixture.map((_, index) => baseId + index);
    const passwordHashes = await Promise.all(
      fixture.map(async () => bcrypt.hash(randomBytes(32).toString('hex'), 10)),
    );

    for (let index = 0; index < fixture.length; index++) {
      const item = fixture[index];
      const userId = fixtureUserIds[index];
      const accountName = `Analytics Test ${item.resident ? 'Resident' : 'Nonresident'} ${String(index + 1).padStart(3, '0')}`;
      const email = emailFor(index + 1);
      const username = usernameFor(index + 1);
      const createdAt = addDays(item.filedAt.slice(0, 10), -2, 9);
      const address = `Test address in ${item.area.name}, Barangay San Andres, Cainta, Rizal`;
      const accountTable = item.resident ? 'residents' : 'non_residents';
      await connection.execute(`
        INSERT INTO ${accountTable}
          (user_id, pangalan, email, password, username, email_verified, profile_completed, address, verified_at, terms_agreed_at, created_at)
        VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)
      `, [userId, accountName, email, passwordHashes[index], username, address, createdAt, createdAt, createdAt]);
    }
    await connection.execute(
      'UPDATE account_sequence SET next_id = ? WHERE id = 1',
      [baseId + fixture.length],
    );

    for (let index = 0; index < fixture.length; index++) {
      const item = fixture[index];
      const userId = fixtureUserIds[index];
      const blotter = `${BLOTTER_PREFIX}${String(index + 1).padStart(4, '0')}`;
      const accountName = `Analytics Test ${item.resident ? 'Resident' : 'Nonresident'} ${String(index + 1).padStart(3, '0')}`;
      const email = emailFor(index + 1);
      const [result] = await connection.execute<mysql.ResultSetHeader>(`
        INSERT INTO complaints
          (blotter_number, user_id, uri_ng_reklamo, detalye, status, assigned_to,
           nireklamo_pangalan, nireklamo_email, nireklamo_user_id, is_resident, zone,
           street_name, complainant_name, complainant_email, truthfulness_acknowledged_at,
           latitude, longitude, detected_boundary_ids, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        blotter, userId, item.type.name, item.details, item.status,
        item.status === 'bago' ? null : staffId,
        item.respondentName, item.resident ? 'Resident' : 'Non Resident',
        item.area.name, item.area.name, accountName, email,
        item.filedAt, item.latitude, item.longitude, JSON.stringify(item.detectedBoundaryIds),
        item.filedAt, item.transitions.at(-1)?.at || item.filedAt,
      ]);
      const complaintId = result.insertId;
      const category = item.type.category;
      await connection.execute(`
        INSERT INTO complaint_history (complaint_id, actor_user_id, action_type, snapshot, created_at)
        VALUES (?, ?, 'filed', ?, ?)
      `, [
        complaintId, userId,
        JSON.stringify({
          uri_ng_reklamo: item.type.name,
          category,
          complainant_name: accountName,
          complainant_email: email,
          nireklamo_pangalan: item.respondentName,
          detalye: item.details,
          zone: item.area.name,
          street_name: item.area.name,
          latitude: item.latitude,
          longitude: item.longitude,
          detected_boundary_ids: item.detectedBoundaryIds,
          synthetic_test_fixture: true,
        }),
        item.filedAt,
      ]);

      if (item.mediationAt) {
        const eligibleAt = addDays(item.filedAt.slice(0, 10), 2, 10);
        const note = 'Synthetic test scenario: recurring neighbor dispute is suitable for facilitated discussion.';
        await connection.execute(`
          UPDATE complaints
          SET mediation_eligible = 1, mediation_eligibility_notes = ?,
              mediation_eligibility_verified_by = ?, mediation_eligibility_verified_at = ?
          WHERE id = ?
        `, [note, staffId, eligibleAt, complaintId]);
        await connection.execute(`
          INSERT INTO complaint_audit
            (complaint_id, previous_status, new_status, action_type, remarks, actor_user_id, created_at)
          VALUES (?, ?, ?, 'mediation_eligibility_verified', ?, ?, ?)
        `, [complaintId, 'sinusuri', 'sinusuri', note, staffId, eligibleAt]);
        await connection.execute(
          'INSERT INTO actions (complaint_id, user_id, paglalarawan, petsa) VALUES (?, ?, ?, ?)',
          [complaintId, staffId, `Mediation eligibility verified: ${note}`, eligibleAt],
        );
        const scheduleDetails = 'Synthetic test mediation appointment for the analytics fixture.';
        const [scheduleResult] = await connection.execute<mysql.ResultSetHeader>(`
          INSERT INTO schedules
            (complaint_id, petsa, lokasyon, detalye, status, paraan_ng_pagpapadala,
             paraan_detalye, staff_user_id, assigned_personnel, created_at, updated_at)
          VALUES (?, ?, 'Barangay Hall - Mediation Room', ?, 'naka-iskedyul', 'system',
                  NULL, ?, 'Analytics Test Facilitator', ?, ?)
        `, [complaintId, item.mediationAt, scheduleDetails, staffId, item.transitions.at(-1)?.at || eligibleAt, item.transitions.at(-1)?.at || eligibleAt]);
        await connection.execute(`
          INSERT INTO mediation_audit (complaint_id, schedule_id, action_type, details, actor_user_id, created_at)
          VALUES (?, ?, 'schedule_created', ?, ?, ?)
        `, [
          complaintId, scheduleResult.insertId,
          JSON.stringify({ synthetic_test_fixture: true, assigned_personnel: 'Analytics Test Facilitator' }),
          staffId, item.transitions.at(-1)?.at || eligibleAt,
        ]);
      }

      for (const transition of item.transitions) {
        const previousStatus = transition.status === 'natapos'
          ? 'iniimbestigahan'
          : transition.status === 'naka-assign'
            ? 'sinusuri'
            : transition.status === 'sa-mediation'
              ? 'naka-assign'
              : transition.status === 'iniimbestigahan'
                ? 'naka-assign'
                : 'bago';
        const actionType = transition.status === 'natapos' ? 'case_resolved' : 'status_updated';
        await connection.execute(`
          INSERT INTO complaint_audit
            (complaint_id, previous_status, new_status, action_type, remarks, actor_user_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [complaintId, previousStatus, transition.status, actionType, transition.remarks, staffId, transition.at]);
        await connection.execute(
          'INSERT INTO actions (complaint_id, user_id, paglalarawan, petsa) VALUES (?, ?, ?, ?)',
          [complaintId, staffId, `${previousStatus} -> ${transition.status}: ${transition.remarks}`, transition.at],
        );
      }

      if (item.resolutionAt && item.resolutionDetails) {
        await connection.execute(`
          INSERT INTO case_dispositions
            (complaint_id, action_type, complaint_date, disposition_date, staff_user_id, resolution_details, created_at)
          VALUES (?, 'resolved', ?, ?, ?, ?, ?)
        `, [complaintId, item.filedAt, item.resolutionAt, staffId, item.resolutionDetails, item.resolutionAt]);
      }
    }

    const [[validation]] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT COUNT(*) AS total,
             SUM(status = 'natapos') AS resolved,
             SUM(status NOT IN ('natapos', 'archived')) AS active,
             SUM(created_at < ? OR created_at >= DATE_ADD(?, INTERVAL 1 DAY)) AS out_of_range,
             SUM(user_id IN (
               SELECT user_id FROM residents WHERE username LIKE ?
               UNION ALL
               SELECT user_id FROM non_residents WHERE username LIKE ?
             )) AS linked_test_accounts
      FROM complaints
      WHERE blotter_number LIKE ?
    `, [`${START_DATE} 00:00:00`, AS_OF_DATE, `${USERNAME_PREFIX}%`, `${USERNAME_PREFIX}%`, `${BLOTTER_PREFIX}%`]);
    const [[accountValidation]] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM residents WHERE username LIKE ? AND email_verified = 1 AND profile_completed = 1) AS residents,
        (SELECT COUNT(*) FROM non_residents WHERE username LIKE ? AND email_verified = 1 AND profile_completed = 1) AS non_residents
    `, [`${USERNAME_PREFIX}%`, `${USERNAME_PREFIX}%`]);
    const [[dispositionValidation]] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT COUNT(*) AS dispositions, SUM(LENGTH(resolution_details) >= 10 AND disposition_date <= ?) AS documented
      FROM case_dispositions
      WHERE complaint_id IN (SELECT id FROM complaints WHERE blotter_number LIKE ?)
    `, [`${AS_OF_DATE} 23:59:59`, `${BLOTTER_PREFIX}%`]);
    const [[mediationValidation]] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT COUNT(*) AS scheduled
      FROM schedules
      WHERE complaint_id IN (SELECT id FROM complaints WHERE blotter_number LIKE ?)
    `, [`${BLOTTER_PREFIX}%`]);

    if (
      Number(validation.total) !== 90 || Number(validation.resolved) !== 70 ||
      Number(validation.active) !== 20 || Number(validation.out_of_range) !== 0 ||
      Number(validation.linked_test_accounts) !== 90 ||
      Number(accountValidation.residents) !== 80 || Number(accountValidation.non_residents) !== 10 ||
      Number(dispositionValidation.dispositions) !== 70 || Number(dispositionValidation.documented) !== 70 ||
      Number(mediationValidation.scheduled) !== 3
    ) {
      throw new Error('Pre-commit analytics fixture validation failed; the transaction will be rolled back.');
    }

    await connection.commit();
    console.log('Analytics test fixture imported successfully.');
    console.log(JSON.stringify({
      complaints: Number(validation.total),
      resolved: Number(validation.resolved),
      active: Number(validation.active),
      residentAccounts: Number(accountValidation.residents),
      nonResidentAccounts: Number(accountValidation.non_residents),
      documentedResolutions: Number(dispositionValidation.documented),
      scheduledMediations: Number(mediationValidation.scheduled),
    }, null, 2));
  } catch (error) {
    try { await connection.rollback(); } catch {}
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Analytics test fixture failed.');
  process.exitCode = 1;
});
