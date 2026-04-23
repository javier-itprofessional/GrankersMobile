import { Q } from '@nozbe/watermelondb';
import { database, Course, Route, Hole } from '@/database';
import { apiRequest } from './api';

const SYNC_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Wire types (backend shape) ───────────────────────────────────────────────

interface WireHoleData {
  number: number;
  par: number;
  handicap: number;
  distance?: number;
}

interface WireRouteData {
  id: string;
  name: string;
  num_holes: number;
  par_total: number;
  slope?: number;
  course_rating?: number;
  holes: WireHoleData[];
}

interface WireCourseData {
  id: string;
  name: string;
  city?: string;
  country?: string;
  routes: WireRouteData[];
}

// ─── Internal types ───────────────────────────────────────────────────────────

export interface HoleData {
  hole_number: number;
  par: number;
  handicap: number;
  distance_meters?: number;
}

export interface RouteData {
  id: string;
  name: string;
  num_holes: number;
  par_total: number;
  slope?: number;
  course_rating?: number;
  holes: HoleData[];
}

export interface CourseData {
  id: string;
  name: string;
  city?: string;
  country?: string;
  routes: RouteData[];
}

function transformCourse(wire: WireCourseData): CourseData {
  return {
    ...wire,
    routes: wire.routes.map((r) => ({
      ...r,
      holes: r.holes.map((h) => ({
        hole_number: h.number,
        par: h.par,
        handicap: h.handicap,
        distance_meters: h.distance,
      })),
    })),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

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

export async function listCourses(): Promise<CourseData[]> {
  const wire = await apiRequest<WireCourseData[]>('/api/v1/courses/');
  return wire.map(transformCourse);
}

// ─── Local cache ──────────────────────────────────────────────────────────────

async function getFromCache(courseName: string, routeName: string): Promise<RouteData | null> {
  const routes = await database
    .get<Route>('routes')
    .query(Q.and(Q.where('course_external_id', courseName), Q.where('name', routeName)))
    .fetch();

  if (routes.length === 0) return null;

  const route = routes[0];
  if (Date.now() - route.syncedAt > SYNC_TTL_MS) return null;

  const holes = await database
    .get<Hole>('holes')
    .query(Q.where('route_id', route.id))
    .fetch();

  if (holes.length === 0) return null;

  return {
    id: route.courseExternalId,
    name: route.name,
    num_holes: route.numHoles,
    par_total: route.parTotal,
    slope: route.slope ?? undefined,
    course_rating: route.courseRating ?? undefined,
    holes: holes
      .sort((a, b) => a.holeNumber - b.holeNumber)
      .map((h) => ({
        hole_number: h.holeNumber,
        par: h.par,
        handicap: h.handicap,
        distance_meters: h.distanceMeters ?? undefined,
        distance_yards: h.distanceYards ?? undefined,
      })),
  };
}

// ─── Fetch from backend + persist ─────────────────────────────────────────────

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
  } catch (error) {
    console.error('[CourseService] Error fetching course:', error);
    return null;
  }
}

async function persistCourse(courseData: CourseData, routeData: RouteData): Promise<void> {
  await database.write(async () => {
    let courseRecord: Course;
    const existing = await database
      .get<Course>('courses')
      .query(Q.where('external_id', courseData.id))
      .fetch();

    if (existing.length > 0) {
      courseRecord = existing[0];
      await courseRecord.update((r) => { r.syncedAt = Date.now(); });
    } else {
      courseRecord = await database.get<Course>('courses').create((r) => {
        r.externalId = courseData.id;
        r.name = courseData.name;
        r.city = courseData.city ?? null;
        r.country = courseData.country ?? null;
        r.syncedAt = Date.now();
      });
    }

    const oldRoutes = await database
      .get<Route>('routes')
      .query(Q.and(Q.where('course_id', courseRecord.id), Q.where('name', routeData.name)))
      .fetch();

    for (const old of oldRoutes) {
      const oldHoles = await database.get<Hole>('holes').query(Q.where('route_id', old.id)).fetch();
      for (const h of oldHoles) await h.destroyPermanently();
      await old.destroyPermanently();
    }

    const routeRecord = await database.get<Route>('routes').create((r) => {
      r.courseId = courseRecord.id;
      r.courseExternalId = courseData.id;
      r.name = routeData.name;
      r.numHoles = routeData.num_holes;
      r.parTotal = routeData.par_total;
      r.slope = routeData.slope ?? null;
      r.courseRating = routeData.course_rating ?? null;
      r.syncedAt = Date.now();
    });

    for (const hole of routeData.holes) {
      await database.get<Hole>('holes').create((h) => {
        h.routeId = routeRecord.id;
        h.holeNumber = hole.hole_number;
        h.par = hole.par;
        h.handicap = hole.handicap;
        h.distanceMeters = hole.distance_meters ?? null;
      });
    }
  });
}
