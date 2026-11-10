import { MODULES, MOCK_DASHBOARD, MOCK_STUDENTS, TRACKS } from '@spd/shared'

const moduleCountByTrack = new Map(
  TRACKS.map((track) => [
    track.slug,
    MODULES.filter((entry) => entry.track === track.slug).length,
  ]),
)

export default function App() {
  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Phase 0 · Foundation</p>
        <h1>Student Progress Dashboard</h1>
        <p className="lede">
          Workspaces, shared contracts, catalog, and the SQLite schema are ready. Auth, Excel
          import, the dashboard, and the coach arrive in later phases.
        </p>
      </header>

      <section aria-labelledby="catalog-heading">
        <h2 id="catalog-heading">Catalog skeleton</h2>
        <p className="muted">
          4 tracks · 13 modules. Modules are identified by normalized name, never by spreadsheet
          position.
        </p>
        <ul className="track-grid">
          {TRACKS.map((track) => (
            <li key={track.slug} className="card">
              <h3>{track.name}</h3>
              <p className="metric">{moduleCountByTrack.get(track.slug) ?? 0} modules</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="mocks-heading">
        <h2 id="mocks-heading">Mock API data</h2>
        <p className="muted">
          Fictional data only, using reserved example.com addresses. Real student data never enters
          this repository.
        </p>
        <ul className="identity-list">
          {MOCK_STUDENTS.map((student) => (
            <li key={student.id}>
              <strong>{student.name}</strong>
              <span>{student.email}</span>
            </li>
          ))}
        </ul>
        <p className="muted">
          Overall progress is the platform value ({MOCK_DASHBOARD.overallProgressPct}%); the module
          average ({MOCK_DASHBOARD.progressComparison.moduleAveragePct}%) is reference only.
        </p>
      </section>

      <section aria-labelledby="invariants-heading" className="notes">
        <h2 id="invariants-heading">Foundation invariants</h2>
        <ul>
          <li>Excel overall_progress_pct stays authoritative; module averages are never relabeled as overall.</li>
          <li>Missing modules (in plan = false) are distinct from real 0% progress.</li>
          <li>Skills are inferred and marked estimated; no measured proficiency is claimed.</li>
          <li>No real names, emails, spreadsheets, credentials, or local databases are committed.</li>
        </ul>
      </section>
    </main>
  )
}
