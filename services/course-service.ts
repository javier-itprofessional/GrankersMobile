import { Q } from '@nozbe/watermelondb';
import { database, Course, Route, Hole } from '@/database';
import { apiRequest } from './api';
import SEED_JSON from '../assets/seed/courses.json';

const LAZY_SYNC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Wire types (backend shape) ───────────────────────────────────────────────

interface WireHoleData {
  number: number;
  par: number;
  handicap: number;
  distance?: number;
  distance_yards?: number;
  elevation?: number;
  fairway_width?: number;
  fairway_length?: number;
  fairway_slope?: number;
  fairway_slope_percentage?: number;
}

interface WireRouteData {
  id: string;
  name: string;
  num_holes: number;
  par_total: number;
  slope?: number;
  course_rating?: number;
  tee_color?: string;
  gender?: string;
  total_distance?: number;
  holes: WireHoleData[];
}

interface WireCourseData {
  id: string;
  name: string;
  club_id?: string;
  city?: string;
  country?: string;
  routes: WireRouteData[];
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface HoleData {
  hole_number: number;
  par: number;
  handicap: number;
  distance_meters?: number;
  distance_yards?: number;
  elevation?: number;
  fairway_width?: number;
  fairway_length?: number;
  fairway_slope?: number;
  fairway_slope_percentage?: number;
}

export interface RouteData {
  id: string;
  externalId?: string;
  name: string;
  num_holes: number;
  par_total: number;
  slope?: number;
  course_rating?: number;
  teeColor?: string;
  gender?: string;
  totalDistance?: number;
  holes: HoleData[];
}

export interface CourseData {
  id: string;
  name: string;
  clubId?: string;
  city?: string;
  country?: string;
  routes: RouteData[];
}

export interface CourseListItem {
  id: string;          // external_id (backend UUID)
  internalId: string;  // same as id when served from memory; WatermelonDB id after persist
  name: string;
  city?: string;
  country?: string;
}

export interface RouteListItem {
  externalId: string;
  name: string;
  numHoles: number;
  parTotal: number;
}

// ─── Transforms ───────────────────────────────────────────────────────────────

function transformCourse(wire: WireCourseData): CourseData {
  return {
    id: wire.id,
    name: wire.name,
    clubId: wire.club_id,
    city: wire.city,
    country: wire.country,
    routes: wire.routes.map((r) => ({
      id: wire.id,
      externalId: r.id,
      name: r.name,
      num_holes: r.num_holes,
      par_total: r.par_total,
      slope: r.slope,
      course_rating: r.course_rating,
      teeColor: r.tee_color,
      gender: r.gender,
      totalDistance: r.total_distance,
      holes: (Array.isArray(r.holes) ? r.holes : []).map((h) => ({
        hole_number: h.number,
        par: h.par,
        handicap: h.handicap,
        distance_meters: h.distance,
        distance_yards: h.distance_yards,
        elevation: h.elevation,
        fairway_width: h.fairway_width,
        fairway_length: h.fairway_length,
        fairway_slope: h.fairway_slope,
        fairway_slope_percentage: h.fairway_slope_percentage,
      })),
    })),
  };
}

// ─── In-memory course catalog ─────────────────────────────────────────────────
// Loaded synchronously from bundled seed at module init — zero latency for
// listCourseNames() and getCourseRoutes() regardless of network/DB state.
// Refreshed from API on every login (background, non-blocking).

const _courseIndex = new Map<string, CourseListItem>();
const _routeIndex  = new Map<string, RouteListItem[]>();

function _buildCatalog(courses: WireCourseData[]): void {
  _courseIndex.clear();
  _routeIndex.clear();
  for (const c of courses) {
    _courseIndex.set(c.id, {
      id: c.id, internalId: c.id,
      name: c.name, city: c.city, country: c.country,
    });
    _routeIndex.set(c.id, (c.routes ?? []).map((r) => ({
      externalId: r.id,
      name: r.name,
      numHoles: r.num_holes,
      parTotal: r.par_total ?? 0,
    })));
  }
}

// Populate synchronously — no async, no DB, no network
_buildCatalog(SEED_JSON as unknown as WireCourseData[]);

// ─── Public API — course catalog (instant, served from memory) ────────────────

export async function listCourseNames(): Promise<CourseListItem[]> {
  // If catalog is empty (e.g. seed not yet generated) and a refresh is running, wait for it
  if (_courseIndex.size === 0 && _refreshPromise) {
    await _refreshPromise;
  }
  return Array.from(_courseIndex.values());
}

export async function getCourseRoutes(courseId: string): Promise<RouteListItem[]> {
  return _routeIndex.get(courseId) ?? [];
}

// Tracks the in-flight refresh so listCourseNames() can await it when needed
let _refreshPromise: Promise<void> | null = null;

// Called on login — refreshes the in-memory catalog from API and triggers a
// background WatermelonDB write (needed for hole data during gameplay).
// Never throws; falls back to seed on any error.
export async function refreshCourseCatalog(): Promise<void> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const wire = await apiRequest<WireCourseData[]>('/api/v1/courses/');
      _buildCatalog(wire);
      _kickOffPersist(wire.map(transformCourse));
    } catch {
      // Keep serving the seed / last known catalog
    }
  })().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

// ─── WatermelonDB persist (background, for getCourseRouteData hole data) ──────

let _persistPromise: Promise<void> | null = null;

function _kickOffPersist(courses: CourseData[]): void {
  if (_persistPromise) return;
  _persistPromise = _doBulkPersist(courses).finally(() => {
    _persistPromise = null;
  });
}

// Upsert: updates existing courses/routes (matched by external_id) and inserts
// new ones. Never deletes records absent from the incoming data, so a partial
// seed doesn't wipe courses already in the DB.
async function _doBulkPersist(courses: CourseData[]): Promise<void> {
  const now = Date.now();
  const incomingCourseIds = courses.map((c) => c.id);

  // ── Phase 1: fetch existing records (reads before write transaction) ────────
  const existingCourses = await database.get<Course>('courses')
    .query(Q.where('external_id', Q.oneOf(incomingCourseIds))).fetch();
  const existingCourseMap = new Map(existingCourses.map((c) => [c.externalId, c]));

  const existingRoutes = existingCourses.length > 0
    ? await database.get<Route>('routes')
        .query(Q.where('course_id', Q.oneOf(existingCourses.map((c) => c.id)))).fetch()
    : [];
  const routesByCourseId = new Map<string, Route[]>();
  for (const r of existingRoutes) {
    if (!routesByCourseId.has(r.courseId)) routesByCourseId.set(r.courseId, []);
    routesByCourseId.get(r.courseId)!.push(r);
  }

  const existingHoles = existingRoutes.length > 0
    ? await database.get<Hole>('holes')
        .query(Q.where('route_id', Q.oneOf(existingRoutes.map((r) => r.id)))).fetch()
    : [];
  const holesByRouteId = new Map<string, Hole[]>();
  for (const h of existingHoles) {
    if (!holesByRouteId.has(h.routeId)) holesByRouteId.set(h.routeId, []);
    holesByRouteId.get(h.routeId)!.push(h);
  }

  // ── Phase 2: build batch ops ──────────────────────────────────────────────
  const ops: Parameters<typeof database.batch>[0][] = [];

  for (const courseData of courses) {
    const existingCourse = existingCourseMap.get(courseData.id);
    let courseId: string;

    if (existingCourse) {
      ops.push(existingCourse.prepareUpdate((r) => {
        r.name = courseData.name;
        r.clubId = courseData.clubId ?? null;
        r.city = courseData.city ?? null;
        r.country = courseData.country ?? null;
        r.syncedAt = now;
      }));
      courseId = existingCourse.id;
    } else {
      const created = database.get<Course>('courses').prepareCreate((r) => {
        r.externalId = courseData.id;
        r.name = courseData.name;
        r.clubId = courseData.clubId ?? null;
        r.city = courseData.city ?? null;
        r.country = courseData.country ?? null;
        r.syncedAt = now;
      });
      ops.push(created);
      courseId = created.id;
    }

    const courseRoutes = existingCourse ? (routesByCourseId.get(existingCourse.id) ?? []) : [];
    const existingRouteByExtId = new Map(
      courseRoutes.filter((r) => r.externalId).map((r) => [r.externalId!, r])
    );

    for (const routeData of courseData.routes) {
      const existingRoute = routeData.externalId
        ? existingRouteByExtId.get(routeData.externalId)
        : courseRoutes.find((r) => r.name === routeData.name);

      let routeId: string;

      if (existingRoute) {
        // Replace holes: delete old, create new
        for (const h of holesByRouteId.get(existingRoute.id) ?? []) {
          ops.push(h.prepareDestroyPermanently());
        }
        ops.push(existingRoute.prepareUpdate((r) => {
          r.name = routeData.name;
          r.numHoles = routeData.num_holes;
          r.parTotal = routeData.par_total;
          r.slope = routeData.slope ?? null;
          r.courseRating = routeData.course_rating ?? null;
          r.teeColor = routeData.teeColor ?? null;
          r.gender = routeData.gender ?? null;
          r.totalDistance = routeData.totalDistance ?? null;
          r.syncedAt = now;
        }));
        routeId = existingRoute.id;
      } else {
        const created = database.get<Route>('routes').prepareCreate((r) => {
          r.externalId = routeData.externalId ?? null;
          r.courseId = courseId;
          r.courseExternalId = courseData.id;
          r.name = routeData.name;
          r.numHoles = routeData.num_holes;
          r.parTotal = routeData.par_total;
          r.slope = routeData.slope ?? null;
          r.courseRating = routeData.course_rating ?? null;
          r.teeColor = routeData.teeColor ?? null;
          r.gender = routeData.gender ?? null;
          r.totalDistance = routeData.totalDistance ?? null;
          r.syncedAt = now;
        });
        ops.push(created);
        routeId = created.id;
      }

      for (const hole of routeData.holes) {
        ops.push(
          database.get<Hole>('holes').prepareCreate((h) => {
            h.routeId = routeId;
            h.holeNumber = hole.hole_number;
            h.par = hole.par;
            h.handicap = hole.handicap;
            h.distanceMeters = hole.distance_meters ?? null;
            h.distanceYards = hole.distance_yards ?? null;
            h.elevation = hole.elevation ?? null;
            h.fairwayWidth = hole.fairway_width ?? null;
            h.fairwayLength = hole.fairway_length ?? null;
            h.fairwaySlope = hole.fairway_slope ?? null;
            h.fairwaySlopePercentage = hole.fairway_slope_percentage ?? null;
          })
        );
      }
    }
  }

  const CHUNK = 1000;
  for (let i = 0; i < ops.length; i += CHUNK) {
    await database.write(async () => database.batch(...ops.slice(i, i + CHUNK)));
  }
}

// Called once at app startup (before login). Seeds WatermelonDB from the
// bundled JSON so hole data is available for gameplay without network access.
export async function seedDatabaseIfEmpty(): Promise<void> {
  const seed = SEED_JSON as unknown as WireCourseData[];
  if (seed.length === 0) return;
  const count = await database.get<Course>('courses').query().fetchCount();
  if (count > 0) return;
  await _doBulkPersist(seed.map(transformCourse));
}

// ─── Gameplay data (hole-level, uses WatermelonDB cache) ─────────────────────

export async function listCourses(): Promise<CourseData[]> {
  const localCourses = await database.get<Course>('courses').query().fetch();
  if (localCourses.length > 0) return _batchCourseRecordsToData(localCourses);
  // DB empty (first run before background persist finishes) — return from catalog
  return Array.from(_courseIndex.values()).map((c) => ({
    id: c.id, name: c.name, city: c.city, country: c.country,
    routes: _routeIndex.get(c.id)?.map((r) => ({
      id: c.id, externalId: r.externalId, name: r.name,
      num_holes: r.numHoles, par_total: r.parTotal, holes: [],
    })) ?? [],
  }));
}

export async function getCourseRouteData(
  courseName: string,
  routeName: string
): Promise<RouteData | null> {
  const cached = await _getFromCache(courseName, routeName);
  if (cached) return cached;
  return _fetchAndCache(courseName, routeName);
}

export async function getHolePars(courseName: string, routeName: string): Promise<number[]> {
  const data = await getCourseRouteData(courseName, routeName);
  if (!data) return new Array(18).fill(4);
  return data.holes.map((h) => h.par);
}

export async function getHoleHandicaps(courseName: string, routeName: string): Promise<number[]> {
  const data = await getCourseRouteData(courseName, routeName);
  if (!data) return new Array(18).fill(0);
  return data.holes.map((h) => h.handicap);
}

// ─── WatermelonDB cache reads ─────────────────────────────────────────────────

async function _getFromCache(courseName: string, routeName: string): Promise<RouteData | null> {
  const courseRows = await database.get<Course>('courses')
    .query(Q.where('name', courseName)).fetch();
  if (courseRows.length === 0) return null;

  const routes = await database.get<Route>('routes')
    .query(Q.and(Q.where('course_id', courseRows[0].id), Q.where('name', routeName)))
    .fetch();
  if (routes.length === 0) return null;

  const route = routes[0];
  if (Date.now() - route.syncedAt > LAZY_SYNC_TTL_MS) return null;

  const holes = await database.get<Hole>('holes')
    .query(Q.where('route_id', route.id)).fetch();
  if (holes.length === 0) return null;

  return _routeRecordToData(route);
}

async function _fetchAndCache(courseName: string, routeName: string): Promise<RouteData | null> {
  try {
    const wire = await apiRequest<WireCourseData[]>(
      `/api/v1/courses/?name=${encodeURIComponent(courseName)}&route=${encodeURIComponent(routeName)}`
    );
    const course = wire[0] ? transformCourse(wire[0]) : null;
    if (!course) return null;
    const route = course.routes.find((r) => r.name === routeName);
    if (!route) return null;
    await persistCourse(course, route);
    return route;
  } catch {
    return null;
  }
}

async function _routeRecordToData(routeRecord: Route): Promise<RouteData> {
  const holes = await database.get<Hole>('holes')
    .query(Q.where('route_id', routeRecord.id)).fetch();
  return {
    id: routeRecord.courseExternalId,
    externalId: routeRecord.externalId ?? undefined,
    name: routeRecord.name,
    num_holes: routeRecord.numHoles,
    par_total: routeRecord.parTotal,
    slope: routeRecord.slope ?? undefined,
    course_rating: routeRecord.courseRating ?? undefined,
    teeColor: routeRecord.teeColor ?? undefined,
    gender: routeRecord.gender ?? undefined,
    totalDistance: routeRecord.totalDistance ?? undefined,
    holes: holes
      .sort((a, b) => a.holeNumber - b.holeNumber)
      .map((h) => ({
        hole_number: h.holeNumber,
        par: h.par,
        handicap: h.handicap,
        distance_meters: h.distanceMeters ?? undefined,
        distance_yards: h.distanceYards ?? undefined,
        elevation: h.elevation ?? undefined,
        fairway_width: h.fairwayWidth ?? undefined,
        fairway_length: h.fairwayLength ?? undefined,
        fairway_slope: h.fairwaySlope ?? undefined,
        fairway_slope_percentage: h.fairwaySlopePercentage ?? undefined,
      })),
  };
}

async function _batchCourseRecordsToData(localCourses: Course[]): Promise<CourseData[]> {
  const courseIds = localCourses.map((c) => c.id);
  const allRoutes = await database.get<Route>('routes')
    .query(Q.where('course_id', Q.oneOf(courseIds))).fetch();
  const routeIds = allRoutes.map((r) => r.id);
  const allHoles = routeIds.length > 0
    ? await database.get<Hole>('holes').query(Q.where('route_id', Q.oneOf(routeIds))).fetch()
    : [];

  const routesByCourseId = new Map<string, Route[]>();
  for (const r of allRoutes) {
    if (!routesByCourseId.has(r.courseId)) routesByCourseId.set(r.courseId, []);
    routesByCourseId.get(r.courseId)!.push(r);
  }
  const holesByRouteId = new Map<string, Hole[]>();
  for (const h of allHoles) {
    if (!holesByRouteId.has(h.routeId)) holesByRouteId.set(h.routeId, []);
    holesByRouteId.get(h.routeId)!.push(h);
  }

  return localCourses.map((courseRecord) => {
    const routes = routesByCourseId.get(courseRecord.id) ?? [];
    return {
      id: courseRecord.externalId,
      name: courseRecord.name,
      clubId: courseRecord.clubId ?? undefined,
      city: courseRecord.city ?? undefined,
      country: courseRecord.country ?? undefined,
      routes: routes.map((routeRecord) => {
        const holes = (holesByRouteId.get(routeRecord.id) ?? [])
          .sort((a, b) => a.holeNumber - b.holeNumber);
        return {
          id: routeRecord.courseExternalId,
          externalId: routeRecord.externalId ?? undefined,
          name: routeRecord.name,
          num_holes: routeRecord.numHoles,
          par_total: routeRecord.parTotal,
          slope: routeRecord.slope ?? undefined,
          course_rating: routeRecord.courseRating ?? undefined,
          teeColor: routeRecord.teeColor ?? undefined,
          gender: routeRecord.gender ?? undefined,
          totalDistance: routeRecord.totalDistance ?? undefined,
          holes: holes.map((h) => ({
            hole_number: h.holeNumber,
            par: h.par,
            handicap: h.handicap,
            distance_meters: h.distanceMeters ?? undefined,
            distance_yards: h.distanceYards ?? undefined,
            elevation: h.elevation ?? undefined,
            fairway_width: h.fairwayWidth ?? undefined,
            fairway_length: h.fairwayLength ?? undefined,
            fairway_slope: h.fairwaySlope ?? undefined,
            fairway_slope_percentage: h.fairwaySlopePercentage ?? undefined,
          })),
        };
      }),
    };
  });
}

// ─── Persist individual course+route (used by lazy fetch) ─────────────────────

export async function persistCourse(courseData: CourseData, routeData: RouteData): Promise<void> {
  await database.write(async () => {
    const now = Date.now();

    let courseRecord: Course;
    const existing = await database.get<Course>('courses')
      .query(Q.where('external_id', courseData.id)).fetch();

    if (existing.length > 0) {
      courseRecord = existing[0];
      await courseRecord.update((r) => {
        r.name = courseData.name;
        r.clubId = courseData.clubId ?? null;
        r.city = courseData.city ?? null;
        r.country = courseData.country ?? null;
        r.syncedAt = now;
      });
    } else {
      courseRecord = await database.get<Course>('courses').create((r) => {
        r.externalId = courseData.id;
        r.name = courseData.name;
        r.clubId = courseData.clubId ?? null;
        r.city = courseData.city ?? null;
        r.country = courseData.country ?? null;
        r.syncedAt = now;
      });
    }

    const routeQuery = routeData.externalId
      ? Q.and(Q.where('course_id', courseRecord.id), Q.where('external_id', routeData.externalId))
      : Q.and(Q.where('course_id', courseRecord.id), Q.where('name', routeData.name));

    const oldRoutes = await database.get<Route>('routes').query(routeQuery).fetch();

    let routeRecord: Route;
    if (oldRoutes.length > 0) {
      routeRecord = oldRoutes[0];
      const oldHoles = await database.get<Hole>('holes')
        .query(Q.where('route_id', routeRecord.id)).fetch();
      for (const h of oldHoles) await h.destroyPermanently();
      await routeRecord.update((r) => {
        r.externalId = routeData.externalId ?? null;
        r.name = routeData.name;
        r.numHoles = routeData.num_holes;
        r.parTotal = routeData.par_total;
        r.slope = routeData.slope ?? null;
        r.courseRating = routeData.course_rating ?? null;
        r.teeColor = routeData.teeColor ?? null;
        r.gender = routeData.gender ?? null;
        r.totalDistance = routeData.totalDistance ?? null;
        r.syncedAt = now;
      });
    } else {
      routeRecord = await database.get<Route>('routes').create((r) => {
        r.externalId = routeData.externalId ?? null;
        r.courseId = courseRecord.id;
        r.courseExternalId = courseData.id;
        r.name = routeData.name;
        r.numHoles = routeData.num_holes;
        r.parTotal = routeData.par_total;
        r.slope = routeData.slope ?? null;
        r.courseRating = routeData.course_rating ?? null;
        r.teeColor = routeData.teeColor ?? null;
        r.gender = routeData.gender ?? null;
        r.totalDistance = routeData.totalDistance ?? null;
        r.syncedAt = now;
      });
    }

    for (const hole of routeData.holes) {
      await database.get<Hole>('holes').create((h) => {
        h.routeId = routeRecord.id;
        h.holeNumber = hole.hole_number;
        h.par = hole.par;
        h.handicap = hole.handicap;
        h.distanceMeters = hole.distance_meters ?? null;
        h.distanceYards = hole.distance_yards ?? null;
        h.elevation = hole.elevation ?? null;
        h.fairwayWidth = hole.fairway_width ?? null;
        h.fairwayLength = hole.fairway_length ?? null;
        h.fairwaySlope = hole.fairway_slope ?? null;
        h.fairwaySlopePercentage = hole.fairway_slope_percentage ?? null;
      });
    }
  });
}
