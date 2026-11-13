import { useRef, type KeyboardEvent } from 'react'
import { DASHBOARD_TABS, type DashboardTabId } from '../../lib/tabs'

type DashboardTabsProps = {
  activeTab: DashboardTabId
  onChange: (tab: DashboardTabId) => void
}

export function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = DASHBOARD_TABS.findIndex((tab) => tab.id === activeTab)

  function focusTab(index: number) {
    const next = DASHBOARD_TABS[index]
    if (!next) return
    onChange(next.id)
    tabRefs.current[index]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusTab((index + 1) % DASHBOARD_TABS.length)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusTab((index - 1 + DASHBOARD_TABS.length) % DASHBOARD_TABS.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusTab(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusTab(DASHBOARD_TABS.length - 1)
    }
  }

  return (
    <div className="dashboard-tabs" role="tablist" aria-label="Dashboard sections">
      {DASHBOARD_TABS.map((tab, index) => {
        const selected = tab.id === activeTab
        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`dashboard-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`dashboard-panel-${tab.id}`}
            tabIndex={selected || (activeIndex < 0 && index === 0) ? 0 : -1}
            className="dashboard-tab"
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
