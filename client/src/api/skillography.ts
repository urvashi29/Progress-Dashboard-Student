import {
  CareerPathDetailResponseSchema,
  CareerPathListResponseSchema,
  SkillographyResponseSchema,
  type CareerPathDetailResponse,
  type CareerPathListResponse,
  type SkillographyResponse,
} from '@spd/shared'
import { apiRequest } from './client'

export async function fetchSkillography(signal?: AbortSignal): Promise<SkillographyResponse> {
  return apiRequest('/me/skillography', SkillographyResponseSchema, { signal })
}

export async function fetchCareerPaths(signal?: AbortSignal): Promise<CareerPathListResponse> {
  return apiRequest('/me/career-paths', CareerPathListResponseSchema, { signal })
}

export async function fetchCareerPath(
  slug: string,
  signal?: AbortSignal,
): Promise<CareerPathDetailResponse> {
  return apiRequest(
    `/me/career-paths/${encodeURIComponent(slug)}`,
    CareerPathDetailResponseSchema,
    { signal },
  )
}
