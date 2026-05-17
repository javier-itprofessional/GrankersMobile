import { apiRequest, apiRequestFormData } from './api';

// ─── Wire types ────────────────────────────────────────────────────────────────

export interface UserProfile {
  uuid: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  dob: string | null;
  gender: string | null;
  language: string | null;
  profile_picture: string | null;
  role: string;
  status: string;
  home_club: string | null;
  date_joined: string;
  managed_club: { uuid: string; name: string } | null;
}

export interface UserLicense {
  uuid: string;
  license_number: string;
  golf_federation_uuid: string;
  golf_federation_name: string;
  golf_federation_code: string;
  handicap: number | null;
  license_expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  events_count: number;
  tours_count: number;
  clubs_count: number;
}

export interface UpcomingEvent {
  registration_uuid: string;
  event_name: string;
  event_slug: string;
  tour_name: string;
  tour_slug: string;
  golf_club_name: string | null;
  start_date: string | null;
  status: string;
  payment_status: string;
  fee_tier_name: string | null;
  price_paid: string | null;
  team_name: string | null;
  is_solo: boolean;
  team_size: string;
}

export interface GolfFederation {
  uuid: string;
  name: string;
  code: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export function getMyProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/api/v1/user/me/');
}

export function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>('/api/v1/user/me/dashboard-stats/');
}

export function getUpcomingEvents(): Promise<UpcomingEvent[]> {
  return apiRequest<UpcomingEvent[]>('/api/v1/user/me/upcoming-events/');
}

export function updateProfile(uuid: string, data: Partial<UserProfile>): Promise<UserProfile> {
  return apiRequest<UserProfile>(`/api/v1/user/${uuid}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function uploadProfilePicture(uuid: string, imageUri: string): Promise<UserProfile> {
  const form = new FormData();
  const filename = imageUri.split('/').pop() ?? 'photo.jpg';
  form.append('profile_picture', { uri: imageUri, name: filename, type: 'image/jpeg' } as any);
  return apiRequestFormData<UserProfile>(`/api/v1/user/${uuid}/`, form, 'PATCH');
}

export function getMyLicenses(): Promise<UserLicense[]> {
  return apiRequest<UserLicense[]>('/api/v1/user/me/licenses/');
}

export function createLicense(data: {
  license_number: string;
  golf_federation_uuid: string;
  handicap?: number | null;
  license_expiry_date?: string | null;
}): Promise<UserLicense> {
  return apiRequest<UserLicense>('/api/v1/user/me/licenses/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateLicense(licenseUuid: string, data: Partial<{
  license_number: string;
  golf_federation_uuid: string;
  handicap: number | null;
  license_expiry_date: string | null;
}>): Promise<UserLicense> {
  return apiRequest<UserLicense>(`/api/v1/user/me/licenses/${licenseUuid}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteLicense(licenseUuid: string): Promise<void> {
  return apiRequest<void>(`/api/v1/user/me/licenses/${licenseUuid}/`, {
    method: 'DELETE',
  });
}

export function getGolfFederations(): Promise<GolfFederation[]> {
  return apiRequest<GolfFederation[]>('/api/v1/golf-federation/');
}
