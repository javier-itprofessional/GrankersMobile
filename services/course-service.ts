import { Q } from '@nozbe/watermelondb';
import { database, Course, Route, Hole } from '@/database';
import { apiRequest } from './api';

const SYNC_TTL_MS = 24 * 60 * 60 * 1000;  // re-sync cada 24h

// ─── Tipos de la API ──────────────────────────────────────────────────────────

export interface HoleData {
  hole_number: number;
  par: number;
  handicap: number;
  distancia_metros?: number;
  distancia_yards?: number;
}

export interface RouteData {
  id: string;                     // ID del backend
  nombre: string;
  num_hoyos: number;
  par_total: number;
  slope?: number;
  course_rating?: number;
  holes: HoleData[];
}

export interface CourseData {
  id: string;
  nombre: string;
  ciudad?: string;
  pais?: string;
  routes: RouteData[];
}

// ─── API pública del servicio ─────────────────────────────────────────────────

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

// Lista de campos disponibles (para select-course screen)
export async function listCourses(): Promise<CourseData[]> {
  return apiRequest<CourseData[]>('/api/v1/courses/');
}

// ─── Caché local ──────────────────────────────────────────────────────────────

async function getFromCache(courseName: string, routeName: string): Promise<RouteData | null> {
  const routes = await database
    .get<Route>('routes')
    .query(Q.and(Q.where('course_external_id', courseName), Q.where('nombre', routeName)))
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
    nombre: route.nombre,
    num_hoyos: route.numHoyos,
    par_total: route.parTotal,
    slope: route.slope ?? undefined,
    course_rating: route.courseRating ?? undefined,
    holes: holes
      .sort((a, b) => a.holeNumber - b.holeNumber)
      .map((h) => ({
        hole_number: h.holeNumber,
        par: h.par,
        handicap: h.handicap,
        distancia_metros: h.distanciaMetros ?? undefined,
        distancia_yards: h.distanciaYards ?? undefined,
      })),
  };
}

// ─── Fetch desde backend + persistir en WatermelonDB ─────────────────────────

async function fetchAndCache(courseName: string, routeName: string): Promise<RouteData | null> {
  try {
    // GET /api/v1/courses/?nombre={courseName}&route={routeName}
    const results = await apiRequest<CourseData[]>(
      `/api/v1/courses/?nombre=${encodeURIComponent(courseName)}&route=${encodeURIComponent(routeName)}`
    );

    const course = results[0];
    if (!course) return null;

    const route = course.routes.find((r) => r.nombre === routeName);
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
    // Upsert Course
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
        r.nombre = courseData.nombre;
        r.ciudad = courseData.ciudad ?? null;
        r.pais = courseData.pais ?? null;
        r.syncedAt = Date.now();
      });
    }

    // Borrar Route + Holes previos
    const oldRoutes = await database
      .get<Route>('routes')
      .query(Q.and(Q.where('course_id', courseRecord.id), Q.where('nombre', routeData.nombre)))
      .fetch();

    for (const old of oldRoutes) {
      const oldHoles = await database.get<Hole>('holes').query(Q.where('route_id', old.id)).fetch();
      for (const h of oldHoles) await h.destroyPermanently();
      await old.destroyPermanently();
    }

    // Crear Route
    const routeRecord = await database.get<Route>('routes').create((r) => {
      r.courseId = courseRecord.id;
      r.courseExternalId = courseData.id;
      r.nombre = routeData.nombre;
      r.numHoyos = routeData.num_hoyos;
      r.parTotal = routeData.par_total;
      r.slope = routeData.slope ?? null;
      r.courseRating = routeData.course_rating ?? null;
      r.syncedAt = Date.now();
    });

    // Crear Holes
    for (const hole of routeData.holes) {
      await database.get<Hole>('holes').create((h) => {
        h.routeId = routeRecord.id;
        h.holeNumber = hole.hole_number;
        h.par = hole.par;
        h.handicap = hole.handicap;
        h.distanciaMetros = hole.distancia_metros ?? null;
        h.distanciaYards = hole.distancia_yards ?? null;
      });
    }
  });
}
