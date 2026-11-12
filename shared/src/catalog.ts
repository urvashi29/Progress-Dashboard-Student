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

/**
 * Skill identity is normalized the same way as module identity. Two module
 * skills that normalize to the same name are the same catalog skill, so the
 * exposure engine combines their module associations instead of duplicating
 * near-identical names.
 */
export function normalizeSkillName(raw: string): string {
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

type SkillSeed = {
  id: string
  name: string
  description: string
  importance: SkillImportance
  weight: number
  prerequisiteSkillIds?: string[]
  activityTemplates: ActivityTemplate[]
  portfolioEvidence: string[]
}

function skill(seed: SkillSeed): Skill {
  return {
    id: seed.id,
    name: seed.name,
    normalizedName: normalizeSkillName(seed.name),
    description: seed.description,
    importance: seed.importance,
    weight: seed.weight,
    estimated: true,
    confidence: 'low',
    prereqSkillNames: [],
    prereqSkillIds: seed.prerequisiteSkillIds ?? [],
    activityTemplates: seed.activityTemplates,
    portfolioEvidence: seed.portfolioEvidence,
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

/**
 * Curated initial skill mapping for all 13 modules. This is a curriculum
 * inference: it maps module content to skills, but no assessment evidence is
 * collected, so every skill remains an estimate until reviewed against the
 * actual learning materials and assessments.
 *
 * Some skills intentionally appear in more than one module (for example
 * `python-programming`, `data-wrangling`, `model-evaluation` and
 * `stakeholder-communication`). The exposure engine combines those module
 * associations with their catalog weights.
 */
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
        skill({
          id: 'programming-fundamentals',
          name: 'Programming fundamentals',
          description:
            'Writing clear, runnable programs using variables, expressions, functions and basic data structures.',
          importance: 'critical',
          weight: 0.5,
          activityTemplates: [
            activity('Concept review', 'reading', 20),
            activity('Guided practice set', 'practice', 40),
          ],
          portfolioEvidence: [
            'A short program that solves a real task, with comments explaining your logic.',
          ],
        }),
        skill({
          id: 'control-flow-debugging',
          name: 'Control flow and debugging',
          description:
            'Using conditionals, loops and debugging techniques to make a program behave predictably.',
          importance: 'core',
          weight: 0.3,
          prerequisiteSkillIds: ['programming-fundamentals'],
          activityTemplates: [activity('Debugging mini project', 'project', 45)],
          portfolioEvidence: [
            'A debugging write-up showing the bug, the diagnosis and the fix.',
          ],
        }),
        skill({
          id: 'computational-thinking',
          name: 'Computational thinking',
          description:
            'Breaking a problem into steps, choosing data structures and planning a solution before coding.',
          importance: 'supporting',
          weight: 0.2,
          activityTemplates: [activity('Checkpoint quiz', 'quiz', 15)],
          portfolioEvidence: [
            'A one-page solution plan that breaks a problem into testable steps.',
          ],
        }),
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
        skill({
          id: 'python-programming',
          name: 'Python programming',
          description:
            'Using Python and its scientific libraries to load, transform and compute with real data.',
          importance: 'critical',
          weight: 0.4,
          prerequisiteSkillIds: ['programming-fundamentals'],
          activityTemplates: [
            activity('Python and NumPy concept review', 'reading', 25),
            activity('Array practice set', 'practice', 40),
          ],
          portfolioEvidence: [
            'A Python notebook that loads, transforms and summarises a dataset.',
          ],
        }),
        skill({
          id: 'numerical-methods',
          name: 'Numerical methods',
          description:
            'Applying numerical techniques such as interpolation, optimisation and simulation to data problems.',
          importance: 'core',
          weight: 0.35,
          prerequisiteSkillIds: ['python-programming'],
          activityTemplates: [activity('Numerical methods mini project', 'project', 50)],
          portfolioEvidence: [
            'A notebook implementing two numerical methods and comparing their trade-offs.',
          ],
        }),
        skill({
          id: 'data-wrangling',
          name: 'Data wrangling',
          description:
            'Cleaning, reshaping and joining tabular data so it is ready for analysis or modelling.',
          importance: 'supporting',
          weight: 0.25,
          prerequisiteSkillIds: ['python-programming'],
          activityTemplates: [activity('Data wrangling quiz', 'quiz', 15)],
          portfolioEvidence: [
            'A cleaned dataset with a short note describing every transformation.',
          ],
        }),
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
        skill({
          id: 'sql-joins',
          name: 'SQL joins',
          description:
            'Querying and combining data from related tables with inner, outer and aggregate joins.',
          importance: 'critical',
          weight: 0.4,
          activityTemplates: [
            activity('SQL joins concept review', 'reading', 20),
            activity('Practice 12 join queries', 'practice', 30),
          ],
          portfolioEvidence: [
            'A query set that joins three related tables and explains each result.',
          ],
        }),
        skill({
          id: 'schema-design',
          name: 'Schema design and normalization',
          description:
            'Designing relational tables, keys and constraints that keep data consistent and maintainable.',
          importance: 'core',
          weight: 0.35,
          prerequisiteSkillIds: ['sql-joins'],
          activityTemplates: [activity('Design a normalized schema', 'project', 60)],
          portfolioEvidence: [
            'An entity-relationship diagram and normalized schema for a small application.',
          ],
        }),
        skill({
          id: 'transactions-indexing',
          name: 'Transactions and indexing',
          description:
            'Using transactions and indexes to protect data integrity and improve query performance.',
          importance: 'supporting',
          weight: 0.25,
          activityTemplates: [activity('Transactions checkpoint quiz', 'quiz', 20)],
          portfolioEvidence: [
            'A short benchmark note comparing a query before and after adding an index.',
          ],
        }),
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
        skill({
          id: 'chart-selection',
          name: 'Chart selection',
          description:
            'Choosing a chart type and visual encoding that honestly answers a specific data question.',
          importance: 'critical',
          weight: 0.35,
          prerequisiteSkillIds: ['data-wrangling'],
          activityTemplates: [
            activity('Chart selection concept review', 'reading', 20),
            activity('Rebuild five charts from raw data', 'practice', 45),
          ],
          portfolioEvidence: [
            'A chart gallery on one dataset with a note explaining why each chart fits.',
          ],
        }),
        skill({
          id: 'dashboard-design',
          name: 'Dashboard design',
          description:
            'Laying out filters, summaries and charts so a reader can follow a clear narrative.',
          importance: 'core',
          weight: 0.3,
          prerequisiteSkillIds: ['chart-selection'],
          activityTemplates: [activity('Single-page dashboard project', 'project', 60)],
          portfolioEvidence: [
            'A single-page dashboard with filters and an obvious reading order.',
          ],
        }),
        skill({
          id: 'storytelling-with-data',
          name: 'Storytelling with data',
          description:
            'Explaining what a chart means, what it does not show and what decision it supports.',
          importance: 'supporting',
          weight: 0.2,
          prerequisiteSkillIds: ['chart-selection'],
          activityTemplates: [activity('Narrative review quiz', 'quiz', 15)],
          portfolioEvidence: [
            'A five-slide data story with one message per slide.',
          ],
        }),
        skill({
          id: 'data-wrangling',
          name: 'Data wrangling',
          description:
            'Cleaning, reshaping and joining tabular data so it is ready for analysis or modelling.',
          importance: 'supporting',
          weight: 0.15,
          prerequisiteSkillIds: ['python-programming'],
          activityTemplates: [activity('Clean a messy dataset for charts', 'practice', 35)],
          portfolioEvidence: [
            'A reusable cleaning script or notebook with a short transformation log.',
          ],
        }),
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
        skill({
          id: 'kpi-definition',
          name: 'KPI definition',
          description:
            'Translating a business question into measurable indicators with clear definitions and owners.',
          importance: 'critical',
          weight: 0.4,
          prerequisiteSkillIds: ['storytelling-with-data'],
          activityTemplates: [
            activity('KPI framing review', 'reading', 20),
            activity('Define KPIs for a sample business', 'practice', 40),
          ],
          portfolioEvidence: [
            'A KPI tree for a real or fictional business, with definitions and data sources.',
          ],
        }),
        skill({
          id: 'experiment-analysis',
          name: 'Experiment analysis',
          description:
            'Designing and interpreting a simple A/B test while stating assumptions and limitations.',
          importance: 'core',
          weight: 0.35,
          prerequisiteSkillIds: ['kpi-definition'],
          activityTemplates: [activity('A/B analysis case study', 'project', 55)],
          portfolioEvidence: [
            'An A/B test analysis with assumptions, effect size and limitations.',
          ],
        }),
        skill({
          id: 'stakeholder-communication',
          name: 'Stakeholder communication',
          description:
            'Summarising analysis for non-technical stakeholders and recommending a clear next step.',
          importance: 'core',
          weight: 0.25,
          prerequisiteSkillIds: ['storytelling-with-data'],
          activityTemplates: [activity('Stakeholder memo quiz', 'quiz', 15)],
          portfolioEvidence: [
            'A stakeholder memo that recommends a decision and states the evidence.',
          ],
        }),
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
        skill({
          id: 'supervised-model-tuning',
          name: 'Supervised model tuning',
          description:
            'Training and tuning supervised models with sound validation and sensible hyperparameters.',
          importance: 'critical',
          weight: 0.35,
          prerequisiteSkillIds: ['python-programming', 'data-wrangling'],
          activityTemplates: [
            activity('Model tuning review', 'reading', 25),
            activity('Tune three estimators on one dataset', 'practice', 60),
          ],
          portfolioEvidence: [
            'A model comparison notebook with validation strategy and chosen trade-offs.',
          ],
        }),
        skill({
          id: 'feature-engineering',
          name: 'Feature engineering',
          description:
            'Creating, selecting and validating input features that improve a model without leaking data.',
          importance: 'core',
          weight: 0.3,
          prerequisiteSkillIds: ['data-wrangling'],
          activityTemplates: [activity('Feature pipeline project', 'project', 60)],
          portfolioEvidence: [
            'A reproducible feature pipeline that documents each transformation.',
          ],
        }),
        skill({
          id: 'model-evaluation',
          name: 'Model evaluation',
          description:
            'Choosing metrics, building validation splits and explaining model errors and limitations.',
          importance: 'core',
          weight: 0.2,
          prerequisiteSkillIds: ['supervised-model-tuning'],
          activityTemplates: [activity('Evaluation metrics quiz', 'quiz', 20)],
          portfolioEvidence: [
            'A model evaluation report with metrics, error analysis and limitations.',
          ],
        }),
        skill({
          id: 'python-programming',
          name: 'Python programming',
          description:
            'Using Python and its scientific libraries to load, transform and compute with real data.',
          importance: 'supporting',
          weight: 0.15,
          prerequisiteSkillIds: ['programming-fundamentals'],
          activityTemplates: [activity('Refactor a modelling notebook', 'practice', 40)],
          portfolioEvidence: [
            'A readable, reusable modelling notebook with functions and comments.',
          ],
        }),
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
        skill({
          id: 'neural-network-basics',
          name: 'Neural network basics',
          description:
            'Explaining layers, activations, loss functions and backpropagation in a small network.',
          importance: 'critical',
          weight: 0.4,
          prerequisiteSkillIds: ['supervised-model-tuning'],
          activityTemplates: [
            activity('Neural network primer', 'reading', 30),
            activity('Build a small MLP', 'practice', 60),
          ],
          portfolioEvidence: [
            'A small neural network with a short explanation of each design choice.',
          ],
        }),
        skill({
          id: 'training-regularization',
          name: 'Training and regularization',
          description:
            'Training networks with appropriate loss, optimiser, early stopping and regularization.',
          importance: 'core',
          weight: 0.35,
          prerequisiteSkillIds: ['neural-network-basics'],
          activityTemplates: [activity('Regularization experiment', 'project', 60)],
          portfolioEvidence: [
            'An experiment showing the effect of one regularization technique.',
          ],
        }),
        skill({
          id: 'pytorch-workflow',
          name: 'PyTorch workflow',
          description:
            'Using tensors, datasets, models and training loops in a reproducible PyTorch workflow.',
          importance: 'supporting',
          weight: 0.15,
          prerequisiteSkillIds: ['python-programming'],
          activityTemplates: [activity('PyTorch checkpoint quiz', 'quiz', 20)],
          portfolioEvidence: [
            'A clean PyTorch training script with a reproducible random seed.',
          ],
        }),
        skill({
          id: 'model-evaluation',
          name: 'Model evaluation',
          description:
            'Choosing metrics, building validation splits and explaining model errors and limitations.',
          importance: 'supporting',
          weight: 0.1,
          prerequisiteSkillIds: ['supervised-model-tuning'],
          activityTemplates: [activity('Compare two network evaluation setups', 'practice', 30)],
          portfolioEvidence: [
            'A short comparison of validation setups and their effect on reported metrics.',
          ],
        }),
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
        skill({
          id: 'cnn-architectures',
          name: 'CNN architectures',
          description:
            'Explaining and applying convolutional layers, pooling and modern image model designs.',
          importance: 'critical',
          weight: 0.4,
          prerequisiteSkillIds: ['neural-network-basics'],
          activityTemplates: [
            activity('CNN architecture review', 'reading', 25),
            activity('Train a small CNN', 'practice', 60),
          ],
          portfolioEvidence: [
            'A trained CNN with an architecture summary and test-set results.',
          ],
        }),
        skill({
          id: 'image-augmentation',
          name: 'Image augmentation',
          description:
            'Using augmentation responsibly and measuring whether it improves generalisation.',
          importance: 'core',
          weight: 0.35,
          prerequisiteSkillIds: ['cnn-architectures'],
          activityTemplates: [activity('Augmentation ablation project', 'project', 50)],
          portfolioEvidence: [
            'An ablation table showing how augmentation changed validation results.',
          ],
        }),
        skill({
          id: 'transfer-learning',
          name: 'Transfer learning',
          description:
            'Adapting a pre-trained vision model to a new dataset with sound fine-tuning choices.',
          importance: 'supporting',
          weight: 0.25,
          prerequisiteSkillIds: ['cnn-architectures'],
          activityTemplates: [activity('Transfer learning quiz', 'quiz', 15)],
          portfolioEvidence: [
            'A fine-tuned vision model with a note on what was frozen and why.',
          ],
        }),
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
        skill({
          id: 'text-representation',
          name: 'Text representation',
          description:
            'Turning text into tokens, embeddings or features that preserve the signal a model needs.',
          importance: 'critical',
          weight: 0.4,
          prerequisiteSkillIds: ['neural-network-basics'],
          activityTemplates: [
            activity('Text representation review', 'reading', 25),
            activity('Tokenization practice set', 'practice', 40),
          ],
          portfolioEvidence: [
            'A tokenisation and embedding experiment with example inputs and outputs.',
          ],
        }),
        skill({
          id: 'transformer-models',
          name: 'Transformer models',
          description:
            'Fine-tuning and evaluating transformer models for classification, generation or retrieval.',
          importance: 'core',
          weight: 0.35,
          prerequisiteSkillIds: ['text-representation'],
          activityTemplates: [activity('Fine-tune a transformer', 'project', 75)],
          portfolioEvidence: [
            'A fine-tuned transformer with a model card describing data and limits.',
          ],
        }),
        skill({
          id: 'sequence-evaluation',
          name: 'Sequence evaluation',
          description:
            'Evaluating language outputs with task-appropriate metrics and qualitative error analysis.',
          importance: 'supporting',
          weight: 0.15,
          prerequisiteSkillIds: ['transformer-models'],
          activityTemplates: [activity('Sequence metrics quiz', 'quiz', 20)],
          portfolioEvidence: [
            'An evaluation notebook that pairs automatic metrics with error examples.',
          ],
        }),
        skill({
          id: 'model-evaluation',
          name: 'Model evaluation',
          description:
            'Choosing metrics, building validation splits and explaining model errors and limitations.',
          importance: 'supporting',
          weight: 0.1,
          prerequisiteSkillIds: ['supervised-model-tuning'],
          activityTemplates: [activity('Design an NLP evaluation plan', 'practice', 30)],
          portfolioEvidence: [
            'An evaluation plan that states the task, metric and known failure modes.',
          ],
        }),
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
        skill({
          id: 'data-parallelism',
          name: 'Data parallelism',
          description:
            'Splitting training data across workers and reasoning about synchronisation and batch size.',
          importance: 'critical',
          weight: 0.4,
          prerequisiteSkillIds: ['training-regularization'],
          activityTemplates: [
            activity('Data parallelism review', 'reading', 25),
            activity('Simulate multi-worker training', 'practice', 60),
          ],
          portfolioEvidence: [
            'A small multi-worker training experiment with throughput measurements.',
          ],
        }),
        skill({
          id: 'distributed-training-ops',
          name: 'Distributed training operations',
          description:
            'Running, checkpointing and recovering distributed training jobs safely.',
          importance: 'core',
          weight: 0.35,
          prerequisiteSkillIds: ['data-parallelism'],
          activityTemplates: [activity('Distributed training runbook', 'project', 60)],
          portfolioEvidence: [
            'A runbook covering job start, checkpointing, failure recovery and cost controls.',
          ],
        }),
        skill({
          id: 'scalability-tradeoffs',
          name: 'Scalability tradeoffs',
          description:
            'Weighing cost, latency, throughput and complexity when scaling a training workload.',
          importance: 'supporting',
          weight: 0.25,
          prerequisiteSkillIds: ['data-parallelism'],
          activityTemplates: [activity('Scalability tradeoff quiz', 'quiz', 20)],
          portfolioEvidence: [
            'A one-page tradeoff analysis for two scaling strategies.',
          ],
        }),
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
        skill({
          id: 'azure-ml-workspace',
          name: 'Azure ML workspace',
          description:
            'Provisioning Azure ML resources, managing environments and running reproducible jobs.',
          importance: 'critical',
          weight: 0.35,
          prerequisiteSkillIds: ['supervised-model-tuning'],
          activityTemplates: [
            activity('Azure ML workspace review', 'reading', 25),
            activity('Provision a workspace and run a job', 'practice', 50),
          ],
          portfolioEvidence: [
            'A reproducible Azure ML job definition and a short setup guide.',
          ],
        }),
        skill({
          id: 'generative-deployment',
          name: 'Generative model deployment',
          description:
            'Deploying a generative model endpoint with sensible safety, cost and latency controls.',
          importance: 'core',
          weight: 0.35,
          prerequisiteSkillIds: ['azure-ml-workspace'],
          activityTemplates: [activity('Deploy a generative endpoint', 'project', 60)],
          portfolioEvidence: [
            'A deployed endpoint with usage limits, prompts and failure handling documented.',
          ],
        }),
        skill({
          id: 'responsible-ai',
          name: 'Responsible AI controls',
          description:
            'Identifying bias, safety, privacy and transparency risks and documenting mitigations.',
          importance: 'supporting',
          weight: 0.2,
          prerequisiteSkillIds: ['azure-ml-workspace'],
          activityTemplates: [activity('Responsible AI quiz', 'quiz', 20)],
          portfolioEvidence: [
            'A responsible-AI checklist completed for one model or application.',
          ],
        }),
        skill({
          id: 'model-evaluation',
          name: 'Model evaluation',
          description:
            'Choosing metrics, building validation splits and explaining model errors and limitations.',
          importance: 'supporting',
          weight: 0.1,
          prerequisiteSkillIds: ['supervised-model-tuning'],
          activityTemplates: [activity('Evaluate a generative endpoint', 'practice', 30)],
          portfolioEvidence: [
            'An evaluation sheet covering quality, safety and latency for a generative endpoint.',
          ],
        }),
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
        skill({
          id: 'model-serving',
          name: 'Model serving',
          description:
            'Packaging a model behind an API with validation, versioning and predictable latency.',
          importance: 'critical',
          weight: 0.4,
          prerequisiteSkillIds: ['python-programming'],
          activityTemplates: [
            activity('Serving patterns review', 'reading', 25),
            activity('Wrap a model in an API', 'practice', 60),
          ],
          portfolioEvidence: [
            'A containerised model API with input validation and a sample request.',
          ],
        }),
        skill({
          id: 'monitoring-drift',
          name: 'Monitoring and drift',
          description:
            'Tracking input drift, output quality and operational health after a model is deployed.',
          importance: 'core',
          weight: 0.35,
          prerequisiteSkillIds: ['model-serving'],
          activityTemplates: [activity('Drift monitoring project', 'project', 60)],
          portfolioEvidence: [
            'A monitoring dashboard or report with drift thresholds and alert rules.',
          ],
        }),
        skill({
          id: 'ml-cicd',
          name: 'CI/CD for ML',
          description:
            'Automating tests, training and deployment steps so model changes are repeatable and safe.',
          importance: 'supporting',
          weight: 0.25,
          prerequisiteSkillIds: ['model-serving'],
          activityTemplates: [activity('ML pipeline quiz', 'quiz', 20)],
          portfolioEvidence: [
            'A CI pipeline that runs tests and builds a model artefact on every change.',
          ],
        }),
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
        skill({
          id: 'problem-framing',
          name: 'Problem framing',
          description:
            'Turning an ambiguous stakeholder request into a scoped, testable data or ML problem.',
          importance: 'critical',
          weight: 0.4,
          prerequisiteSkillIds: ['stakeholder-communication'],
          activityTemplates: [
            activity('Problem framing review', 'reading', 20),
            activity('Write a project brief', 'project', 60),
          ],
          portfolioEvidence: [
            'A project brief with a problem statement, scope, success metric and risks.',
          ],
        }),
        skill({
          id: 'stakeholder-communication',
          name: 'Stakeholder communication',
          description:
            'Summarising analysis for non-technical stakeholders and recommending a clear next step.',
          importance: 'core',
          weight: 0.35,
          prerequisiteSkillIds: ['storytelling-with-data'],
          activityTemplates: [activity('Stakeholder update simulation', 'practice', 40)],
          portfolioEvidence: [
            'A recorded or written stakeholder update that explains a technical trade-off.',
          ],
        }),
        skill({
          id: 'delivery-ownership',
          name: 'Delivery ownership',
          description:
            'Planning, delivering and retrospectively improving a piece of technical work on a team.',
          importance: 'supporting',
          weight: 0.25,
          prerequisiteSkillIds: ['problem-framing'],
          activityTemplates: [activity('Delivery retrospective quiz', 'quiz', 15)],
          portfolioEvidence: [
            'A delivery retrospective with one improvement you would make next time.',
          ],
        }),
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
