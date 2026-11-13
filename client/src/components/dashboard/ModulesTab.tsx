import { TRACKS, getModuleBySlug, type DashboardModule } from '@spd/shared'
import { useMemo, useState } from 'react'
import { formatPercent } from '../../lib/format'
import { MODULE_BAND_LABEL, MODULE_BAND_TONE } from '../../lib/status'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'

type ModulesTabProps = {
  modules: DashboardModule[]
  onOpenModule: (slug: string) => void
}

type StatusFilter = 'all' | 'completed' | 'in-progress' | 'not-started' | 'not-in-plan'
type SortOption = 'catalog' | 'progress-desc' | 'progress-asc' | 'name'

function statusFor(module: DashboardModule): Exclude<StatusFilter, 'all'> {
  if (!module.inPlan) return 'not-in-plan'
  if (module.progressPct >= 100) return 'completed'
  if (module.progressPct > 0) return 'in-progress'
  return 'not-started'
}

export function ModulesTab({ modules, onOpenModule }: ModulesTabProps) {
  const [query, setQuery] = useState('')
  const [track, setTrack] = useState<'all' | DashboardModule['track']>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortOption>('catalog')

  const hasFilters = query.trim() !== '' || track !== 'all' || status !== 'all' || sort !== 'catalog'

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = modules.filter((module) => {
      if (track !== 'all' && module.track !== track) return false
      if (status !== 'all' && statusFor(module) !== status) return false
      if (!normalizedQuery) return true

      const catalog = getModuleBySlug(module.moduleSlug)
      const skillText = catalog?.skills.map((skill) => skill.name).join(' ') ?? ''
      return `${module.name} ${skillText}`.toLowerCase().includes(normalizedQuery)
    })

    return filtered.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'progress-desc' || sort === 'progress-asc') {
        const aValue = a.inPlan ? a.progressPct : -1
        const bValue = b.inPlan ? b.progressPct : -1
        return sort === 'progress-desc' ? bValue - aValue : aValue - bValue
      }
      return a.catalogOrder - b.catalogOrder
    })
  }, [modules, query, track, status, sort])

  function clearFilters() {
    setQuery('')
    setTrack('all')
    setStatus('all')
    setSort('catalog')
  }

  return (
    <section className="tab-panel" aria-labelledby="modules-tab-heading">
      <div className="section-heading">
        <h2 id="modules-tab-heading">Module explorer</h2>
        <p className="muted">
          Search, filter and sort all modules. “Not in plan” is different from an assigned module at
          0% progress.
        </p>
      </div>

      <div className="explorer-toolbar" role="search">
        <div className="field-inline field-inline--search">
          <label htmlFor="module-search">Search modules</label>
          <input
            id="module-search"
            type="search"
            placeholder="Search by module or skill"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="field-inline">
          <label htmlFor="module-track-filter">Track</label>
          <select
            id="module-track-filter"
            value={track}
            onChange={(event) =>
              setTrack(event.target.value === 'all' ? 'all' : (event.target.value as DashboardModule['track']))
            }
          >
            <option value="all">All tracks</option>
            {TRACKS.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field-inline">
          <label htmlFor="module-status-filter">Progress status</label>
          <select
            id="module-status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="in-progress">In progress</option>
            <option value="not-started">Not started</option>
            <option value="not-in-plan">Not in plan</option>
          </select>
        </div>

        <div className="field-inline">
          <label htmlFor="module-sort">Sort by</label>
          <select
            id="module-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
          >
            <option value="catalog">Catalog order</option>
            <option value="progress-desc">Progress: high to low</option>
            <option value="progress-asc">Progress: low to high</option>
            <option value="name">Module name</option>
          </select>
        </div>

        <div className="explorer-toolbar__actions">
          <span className="explorer-count" role="status" aria-live="polite">
            {visible.length} of {modules.length} modules
          </span>
          <Button variant="ghost" className="btn--sm" onClick={clearFilters} disabled={!hasFilters}>
            Clear filters
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="state-panel state-panel--empty">
          <h3>No modules match your filters</h3>
          <p>Try a different search term or clear the active filters.</p>
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="module-list">
          {visible.map((module) => {
            const catalog = getModuleBySlug(module.moduleSlug)
            const trackName = TRACKS.find((entry) => entry.slug === module.track)?.name ?? module.track

            return (
              <article className="module-row" key={module.moduleSlug} aria-label={module.name}>
                <div className="module-row__top">
                  <div>
                    <p className="module-row__track">{trackName}</p>
                    <h3>{module.name}</h3>
                  </div>
                  <StatusBadge
                    label={MODULE_BAND_LABEL[module.band]}
                    tone={MODULE_BAND_TONE[module.band]}
                  />
                </div>

                {module.inPlan ? (
                  <>
                    <div className="module-row__progress-label">
                      <span>Progress</span>
                      <strong>{formatPercent(module.progressPct)}</strong>
                    </div>
                    <ProgressBar
                      value={module.progressPct}
                      label={`${module.name} progress`}
                      tone="info"
                      size="sm"
                    />
                  </>
                ) : (
                  <p className="module-row__not-in-plan">
                    Not included in your current plan. Ask your program team if you need access.
                  </p>
                )}

                {catalog ? (
                  <div className="module-row__skills" aria-label={`${module.name} associated skills`}>
                    {catalog.skills.slice(0, 4).map((skill) => (
                      <span className="skill-chip" key={skill.id}>
                        {skill.name}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="module-row__actions">
                  <Button
                    variant="secondary"
                    className="btn--sm"
                    onClick={() => onOpenModule(module.moduleSlug)}
                  >
                    View Details
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
