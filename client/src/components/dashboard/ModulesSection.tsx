import { TRACKS, type DashboardModule } from '@spd/shared'
import { ModuleCard } from './ModuleCard'

export function ModulesSection({ modules }: { modules: DashboardModule[] }) {
  return (
    <section className="section" aria-labelledby="modules-heading">
      <div className="section-heading">
        <h2 id="modules-heading">Your modules</h2>
        <p className="muted">
          Modules follow the curated catalog order. “Not in Plan” means the module was not part of
          your enrollment — it is different from a module you have started at 0%.
        </p>
      </div>

      {TRACKS.map((track) => {
        const trackModules = modules
          .filter((entry) => entry.track === track.slug)
          .sort((a, b) => a.catalogOrder - b.catalogOrder)
        if (trackModules.length === 0) return null

        return (
          <div key={track.slug} className="module-group">
            <h3 className="module-group__title">{track.name}</h3>
            <div className="module-grid">
              {trackModules.map((module) => (
                <ModuleCard key={module.moduleSlug} module={module} />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
