export const DASHBOARD_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'modules', label: 'Modules' },
  { id: 'tracks', label: 'Learning Tracks' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'skillography', label: 'Skillography' },
] as const

export type DashboardTabId = (typeof DASHBOARD_TABS)[number]['id']

export function isDashboardTab(value: string | null): value is DashboardTabId {
  return DASHBOARD_TABS.some((tab) => tab.id === value)
}

export function tabLabel(id: DashboardTabId): string {
  return DASHBOARD_TABS.find((tab) => tab.id === id)?.label ?? id
}
