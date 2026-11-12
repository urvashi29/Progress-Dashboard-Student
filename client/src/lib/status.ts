import type {
  HealthStatus,
  ModuleProgressBand,
  RecommendationType,
  SkillImportance,
} from '@spd/shared'

export type Tone = 'positive' | 'neutral' | 'warning' | 'danger' | 'muted' | 'info'

export const HEALTH_TONE: Record<HealthStatus, Tone> = {
  GETTING_STARTED: 'neutral',
  ON_TRACK: 'positive',
  SLIGHTLY_BEHIND: 'warning',
  BEHIND: 'warning',
  CRITICAL: 'danger',
}

export const MODULE_BAND_LABEL: Record<ModuleProgressBand, string> = {
  STRONG: 'Strong',
  ON_TRACK: 'On Track',
  NEEDS_ATTENTION: 'Needs Attention',
  NOT_STARTED: 'Not Started',
  NOT_IN_PLAN: 'Not in Plan',
}

export const MODULE_BAND_TONE: Record<ModuleProgressBand, Tone> = {
  STRONG: 'positive',
  ON_TRACK: 'info',
  NEEDS_ATTENTION: 'warning',
  NOT_STARTED: 'neutral',
  NOT_IN_PLAN: 'muted',
}

export const RECOMMENDATION_LABEL: Record<RecommendationType, string> = {
  START_MODULE: 'Start module',
  RESCUE_MODULE: 'Rescue module',
  NEAR_FINISH: 'Near finish',
  QUICK_WIN: 'Quick win',
  UNBLOCK: 'Unblock',
  MOMENTUM: 'Momentum',
}

export const SKILL_IMPORTANCE_LABEL: Record<SkillImportance, string> = {
  critical: 'Critical skill',
  core: 'Core skill',
  supporting: 'Supporting skill',
}
