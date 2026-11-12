import {
  CatalogModuleSchema,
  CatalogResponseSchema,
  TrackSchema,
  type ActivityTemplate,
  type CatalogModule,
  type CatalogResponse,
  type Skill,
  type SkillImportance,
  type Track,
} from './modules'

export const CATALOG_NOTE =
  'Skills and activity suggestions are estimated from module progress, not measured proficiency.'

/**
 * Canonical module identity is the normalized module name. Spreadsheet column
 * position (M1..M13) must never be used to identify a module.
 */
export function normalizeModuleName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase()
}

export const TRACKS: readonly Track[] = TrackSchema.array()
  .length(4)
  .parse([
    { slug: 'foundations', name: 'Foundations', order: 1 },
    { slug: 'data-analytics', name: 'Data & Analytics', order: 2 },
    { slug: 'ai-ml', name: 'AI & ML', order: 3 },
    { slug: 'production-industry', name: 'Production & Industry', order: 4 },
  ])

function activity(
  title: string,
  type: ActivityTemplate['type'],
  minutes: number,
): ActivityTemplate {
  return { title, type, minutes }
}

function skill(
  name: string,
  importance: SkillImportance,
  weight: number,
  activityTemplates: ActivityTemplate[],
): Skill {
  return {
    name,
    importance,
    weight,
    estimated: true,
    confidence: 'low',
    prereqSkillNames: [],
    activityTemplates,
  }
}

type ModuleSeed = {
  slug: string
  name: string
  track: CatalogModule['track']
  catalogOrder: number
  minutesPerProgressPoint: number
  prerequisiteModuleSlugs?: string[]
  /**
   * Additional source labels that map to this module. The Excel export uses
   * full names (e.g. "Introduction to Computer Programming") while the catalog
   * uses short names; aliases keep module identity name-based, never positional.
   */
  aliases?: string[]
  skills: Skill[]
}

function defineModule(seed: ModuleSeed): CatalogModule {
  return {
    slug: seed.slug,
    name: seed.name,
    normalizedName: normalizeModuleName(seed.name),
    track: seed.track,
    catalogOrder: seed.catalogOrder,
    aliases: seed.aliases ?? [],
    prerequisiteModuleSlugs: seed.prerequisiteModuleSlugs ?? [],
    minutesPerProgressPoint: seed.minutesPerProgressPoint,
    skills: seed.skills,
  }
}

export const MODULES: readonly CatalogModule[] = CatalogModuleSchema.array()
  .length(13)
  .parse([
    defineModule({
      slug: 'intro-to-computer-programming',
      name: 'Intro to Computer Programming',
      track: 'foundations',
      catalogOrder: 1,
      minutesPerProgressPoint: 4,
      aliases: ['Introduction to Computer Programming'],
      skills: [
        skill('Programming fundamentals', 'critical', 0.5, [
          activity('Concept review', 'reading', 20),
          activity('Guided practice set', 'practice', 40),
        ]),
        skill('Control flow and debugging', 'core', 0.3, [
          activity('Debugging mini project', 'project', 45),
        ]),
        skill('Computational thinking', 'supporting', 0.2, [
          activity('Checkpoint quiz', 'quiz', 15),
        ]),
      ],
    }),
    defineModule({
      slug: 'numerical-programming-in-python',
      name: 'Numerical Programming in Python',
      track: 'foundations',
      catalogOrder: 2,
      minutesPerProgressPoint: 5,
      prerequisiteModuleSlugs: ['intro-to-computer-programming'],
      skills: [
        skill('Python data types and NumPy', 'critical', 0.45, [
          activity('NumPy concept review', 'reading', 25),
          activity('Array practice set', 'practice', 40),
        ]),
        skill('Numerical methods', 'core', 0.35, [
          activity('Numerical methods mini project', 'project', 50),
        ]),
        skill('Data wrangling with pandas', 'supporting', 0.2, [
          activity('Data wrangling quiz', 'quiz', 15),
        ]),
      ],
    }),
    defineModule({
      slug: 'relational-databases',
      name: 'Relational Databases',
      track: 'foundations',
      catalogOrder: 3,
      minutesPerProgressPoint: 6,
      prerequisiteModuleSlugs: ['intro-to-computer-programming'],
      skills: [
        skill('SQL joins', 'critical', 0.4, [
          activity('SQL joins concept review', 'reading', 20),
          activity('Practice 12 join queries', 'practice', 30),
        ]),
        skill('Schema design and normalization', 'core', 0.35, [
          activity('Design a normalized schema', 'project', 60),
        ]),
        skill('Transactions and indexing', 'supporting', 0.25, [
          activity('Transactions checkpoint quiz', 'quiz', 20),
        ]),
      ],
    }),
    defineModule({
      slug: 'data-visualization-tools',
      name: 'Data Visualization Tools',
      track: 'data-analytics',
      catalogOrder: 4,
      minutesPerProgressPoint: 5,
      prerequisiteModuleSlugs: ['numerical-programming-in-python'],
      skills: [
        skill('Chart selection', 'critical', 0.4, [
          activity('Chart selection concept review', 'reading', 20),
          activity('Rebuild five charts from raw data', 'practice', 45),
        ]),
        skill('Dashboard design', 'core', 0.35, [
          activity('Single-page dashboard project', 'project', 60),
        ]),
        skill('Storytelling with data', 'supporting', 0.25, [
          activity('Narrative review quiz', 'quiz', 15),
        ]),
      ],
    }),
    defineModule({
      slug: 'applied-business-analytics',
      name: 'Applied Business Analytics',
      track: 'data-analytics',
      catalogOrder: 5,
      minutesPerProgressPoint: 6,
      prerequisiteModuleSlugs: ['data-visualization-tools'],
      skills: [
        skill('KPI definition', 'critical', 0.4, [
          activity('KPI framing review', 'reading', 20),
          activity('Define KPIs for a sample business', 'practice', 40),
        ]),
        skill('Experiment analysis', 'core', 0.35, [
          activity('A/B analysis case study', 'project', 55),
        ]),
        skill('Business communication', 'supporting', 0.25, [
          activity('Stakeholder memo quiz', 'quiz', 15),
        ]),
      ],
    }),
    defineModule({
      slug: 'advanced-machine-learning',
      name: 'Advanced Machine Learning',
      track: 'ai-ml',
      catalogOrder: 6,
      minutesPerProgressPoint: 8,
      prerequisiteModuleSlugs: ['numerical-programming-in-python', 'relational-databases'],
      skills: [
        skill('Supervised model tuning', 'critical', 0.4, [
          activity('Model tuning review', 'reading', 25),
          activity('Tune three estimators on one dataset', 'practice', 60),
        ]),
        skill('Feature engineering', 'core', 0.35, [
          activity('Feature pipeline project', 'project', 60),
        ]),
        skill('Model evaluation', 'supporting', 0.25, [
          activity('Evaluation metrics quiz', 'quiz', 20),
        ]),
      ],
    }),
    defineModule({
      slug: 'intro-to-deep-learning',
      name: 'Intro to Deep Learning',
      track: 'ai-ml',
      catalogOrder: 7,
      minutesPerProgressPoint: 8,
      aliases: ['Introduction to Deep Learning'],
      prerequisiteModuleSlugs: ['advanced-machine-learning'],
      skills: [
        skill('Neural network basics', 'critical', 0.4, [
          activity('Neural network primer', 'reading', 30),
          activity('Build a small MLP', 'practice', 60),
        ]),
        skill('Training and regularization', 'core', 0.35, [
          activity('Regularization experiment', 'project', 60),
        ]),
        skill('PyTorch workflow', 'supporting', 0.25, [
          activity('PyTorch checkpoint quiz', 'quiz', 20),
        ]),
      ],
    }),
    defineModule({
      slug: 'dl-for-computer-vision',
      name: 'DL for Computer Vision',
      track: 'ai-ml',
      catalogOrder: 8,
      minutesPerProgressPoint: 9,
      aliases: ['Deep Learning for Computer Vision'],
      prerequisiteModuleSlugs: ['intro-to-deep-learning'],
      skills: [
        skill('CNN architectures', 'critical', 0.4, [
          activity('CNN architecture review', 'reading', 25),
          activity('Train a small CNN', 'practice', 60),
        ]),
        skill('Image augmentation', 'core', 0.35, [
          activity('Augmentation ablation project', 'project', 50),
        ]),
        skill('Transfer learning', 'supporting', 0.25, [
          activity('Transfer learning quiz', 'quiz', 15),
        ]),
      ],
    }),
    defineModule({
      slug: 'dl-for-nlp',
      name: 'DL for NLP',
      track: 'ai-ml',
      catalogOrder: 9,
      minutesPerProgressPoint: 9,
      aliases: ['Deep Learning for NLP'],
      prerequisiteModuleSlugs: ['intro-to-deep-learning'],
      skills: [
        skill('Text representation', 'critical', 0.4, [
          activity('Text representation review', 'reading', 25),
          activity('Tokenization practice set', 'practice', 40),
        ]),
        skill('Transformer models', 'core', 0.35, [
          activity('Fine-tune a transformer', 'project', 75),
        ]),
        skill('Sequence evaluation', 'supporting', 0.25, [
          activity('Sequence metrics quiz', 'quiz', 20),
        ]),
      ],
    }),
    defineModule({
      slug: 'distributed-ml',
      name: 'Distributed ML',
      track: 'ai-ml',
      catalogOrder: 10,
      minutesPerProgressPoint: 10,
      aliases: ['Distributed Machine Learning'],
      prerequisiteModuleSlugs: ['intro-to-deep-learning'],
      skills: [
        skill('Data parallelism', 'critical', 0.4, [
          activity('Data parallelism review', 'reading', 25),
          activity('Simulate multi-worker training', 'practice', 60),
        ]),
        skill('Distributed training operations', 'core', 0.35, [
          activity('Distributed training runbook', 'project', 60),
        ]),
        skill('Scalability tradeoffs', 'supporting', 0.25, [
          activity('Scalability tradeoff quiz', 'quiz', 20),
        ]),
      ],
    }),
    defineModule({
      slug: 'ml-genai-with-microsoft-azure',
      name: 'ML & GenAI with Microsoft Azure',
      track: 'ai-ml',
      catalogOrder: 11,
      minutesPerProgressPoint: 8,
      aliases: ['Machine Learning & Generative AI with Microsoft Azure'],
      prerequisiteModuleSlugs: ['advanced-machine-learning'],
      skills: [
        skill('Azure ML workspace', 'critical', 0.4, [
          activity('Azure ML workspace review', 'reading', 25),
          activity('Provision a workspace and run a job', 'practice', 50),
        ]),
        skill('Generative model deployment', 'core', 0.35, [
          activity('Deploy a generative endpoint', 'project', 60),
        ]),
        skill('Responsible AI controls', 'supporting', 0.25, [
          activity('Responsible AI quiz', 'quiz', 20),
        ]),
      ],
    }),
    defineModule({
      slug: 'productionization-of-ml-systems',
      name: 'Productionization of ML Systems',
      track: 'production-industry',
      catalogOrder: 12,
      minutesPerProgressPoint: 9,
      prerequisiteModuleSlugs: ['distributed-ml'],
      skills: [
        skill('Model serving', 'critical', 0.4, [
          activity('Serving patterns review', 'reading', 25),
          activity('Wrap a model in an API', 'practice', 60),
        ]),
        skill('Monitoring and drift', 'core', 0.35, [
          activity('Drift monitoring project', 'project', 60),
        ]),
        skill('CI/CD for ML', 'supporting', 0.25, [
          activity('ML pipeline quiz', 'quiz', 20),
        ]),
      ],
    }),
    defineModule({
      slug: 'industry-immersion',
      name: 'Industry Immersion',
      track: 'production-industry',
      catalogOrder: 13,
      minutesPerProgressPoint: 10,
      prerequisiteModuleSlugs: [
        'productionization-of-ml-systems',
        'ml-genai-with-microsoft-azure',
      ],
      skills: [
        skill('Problem framing', 'critical', 0.4, [
          activity('Problem framing review', 'reading', 20),
          activity('Write a project brief', 'project', 60),
        ]),
        skill('Stakeholder communication', 'core', 0.35, [
          activity('Stakeholder update simulation', 'practice', 40),
        ]),
        skill('Delivery ownership', 'supporting', 0.25, [
          activity('Delivery retrospective quiz', 'quiz', 15),
        ]),
      ],
    }),
  ])

const MODULE_BY_SLUG = new Map(MODULES.map((entry) => [entry.slug, entry]))
const MODULE_BY_NORMALIZED_NAME = new Map(MODULES.map((entry) => [entry.normalizedName, entry]))

export function getModuleBySlug(slug: string): CatalogModule | undefined {
  return MODULE_BY_SLUG.get(slug)
}

/**
 * Resolves a raw spreadsheet module name to a catalog module by normalized
 * name (and later, alias). Returns undefined so callers can report unknowns
 * instead of failing the whole import.
 */
export function findModuleByName(rawName: string): CatalogModule | undefined {
  const normalized = normalizeModuleName(rawName)
  const direct = MODULE_BY_NORMALIZED_NAME.get(normalized)
  if (direct) return direct
  return MODULES.find((entry) =>
    entry.aliases.some((alias) => normalizeModuleName(alias) === normalized),
  )
}

export function getModulesByTrack(track: Track['slug']): CatalogModule[] {
  return MODULES.filter((entry) => entry.track === track).sort(
    (a, b) => a.catalogOrder - b.catalogOrder,
  )
}

export function buildCatalogResponse(): CatalogResponse {
  return CatalogResponseSchema.parse({
    tracks: TRACKS,
    modules: MODULES,
    skillsAreEstimated: true,
    note: CATALOG_NOTE,
  })
}
