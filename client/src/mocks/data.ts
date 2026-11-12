import { MOCK_DASHBOARD } from '@spd/shared'
import type { ModuleDetailResponse } from '../api/contracts'
import { composeModuleDetail } from '../lib/moduleDetail'

export function buildModuleDetail(slug: string): ModuleDetailResponse | null {
  return composeModuleDetail(MOCK_DASHBOARD, slug)
}
