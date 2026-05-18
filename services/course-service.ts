import { Q } from '@nozbe/watermelondb';
import { database, Course, Route, Hole } from '@/database';
import { apiRequest } from './api';

const LAZY_SYNC_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days — holes rarely change

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

// Lightweight types for search dropdowns — no routes or holes loaded.
export interface CourseListItem {
  id: string;          // external_id (backend UUID)
  internalId: string;  // WatermelonDB row id — used to fetch routes
  name: string;
  city?: string;
  country?: string;
}

export interface RouteListItem {
  externalId: string;  // backend UUID
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
      holes: r.holes.map((h) => ({
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

// ─── Public API ───────────────────────────────────────────────────────────────

// Returns course names only — 1 DB query, no routes or holes loaded.
// Use this for search dropdowns; call getCourseRoutes() after selection.
export async function listCourseNames(): Promise<CourseListItem[]> {
  const rows = await database.get<Course>('courses').query().fetch();
  return rows.map((c) => ({
    id: c.externalId,
    internalId: c.id,
    name: c.name,
    city: c.city ?? undefined,
    country: c.country ?? undefined,
  }));
}

// Returns routes for a specific course — 1 DB query, no holes loaded.
export async function getCourseRoutes(courseInternalId: string): Promise<RouteListItem[]> {
  const rows = await database.get<Route>('routes')
    .query(Q.where('course_id', courseInternalId)).fetch();
  return rows.map((r) => ({
    externalId: r.externalId ?? r.id,
    name: r.name,
    numHoles: r.numHoles,
    parTotal: r.parTotal,
  }));
}

// Returns all courses from local DB (populated by sync). Falls back to network
// only if local DB is empty — avoids a fetch on every app open.
export async function listCourses(): Promise<CourseData[]> {
  const localCourses = await database.get<Course>('courses').query().fetch();
  if (localCourses.length > 0) {
    return batchCourseRecordsToData(localCourses);
  }
  // First-run fallback: fetch all and cache
  const wire = await apiRequest<WireCourseData[]>('/api/v1/courses/');
  const courses = wire.map(transformCourse);
  for (const c of courses) {
    for (const r of c.routes) {
      await persistCourse(c, r);
    }
  }
  return courses;
}

// 3 queries total instead of N+1+M: courses → all routes → all holes, assembled in memory.
async function batchCourseRecordsToData(localCourses: Course[]): Promise<CourseData[]> {
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

// Returns route data for a specific course+route, using local cache when fresh.
export async function getCourseRouteData(
  courseName: string,
  routeName: string
): Promise<RouteData | null> {
  const cached = await getFromCache(courseName, routeName);
  if (cached) return cached;
  return fetchAndCache(courseName, routeName);
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

// ─── Local cache reads ────────────────────────────────────────────────────────

async function courseRecordToData(courseRecord: Course): Promise<CourseData> {
  const routes = await database.get<Route>('routes')
    .query(Q.where('course_id', courseRecord.id)).fetch();
  const routeData = await Promise.all(routes.map(routeRecordToData));
  return {
    id: courseRecord.externalId,
    name: courseRecord.name,
    clubId: courseRecord.clubId ?? undefined,
    city: courseRecord.city ?? undefined,
    country: courseRecord.country ?? undefined,
    routes: routeData,
  };
}

async function routeRecordToData(routeRecord: Route): Promise<RouteData> {
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

async function getFromCache(courseName: string, routeName: string): Promise<RouteData | null> {
  // course_external_id stores the backend UUID, not the name — resolve via Course.name first.
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

  return routeRecordToData(route);
}

// ─── Lazy fetch from backend + persist ───────────────────────────────────────

async function fetchAndCache(courseName: string, routeName: string): Promise<RouteData | null> {
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

// ─── Persist (used by lazy fetch and initial listCourses fallback) ────────────

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

    // Upsert route by external_id when available, otherwise by name
    const routeQuery = routeData.externalId
      ? Q.and(Q.where('course_id', courseRecord.id), Q.where('external_id', routeData.externalId))
      : Q.and(Q.where('course_id', courseRecord.id), Q.where('name', routeData.name));

    const oldRoutes = await database.get<Route>('routes').query(routeQuery).fetch();

    let routeRecord: Route;
    if (oldRoutes.length > 0) {
      routeRecord = oldRoutes[0];
      // Delete old holes before recreating — lazy fetch always sends the full set
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
