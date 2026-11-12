import { z } from 'zod'
import { IsoDateTimeSchema, PercentSchema, SlugSchema } from './common'
import { ActivityTemplateSchema } from './modules'
import { SkillStatusSchema } from './skillography'

export const CAREER_PATHWAYS_METHODOLOGY =
  'Career coverage is the mean estimated exposure of each pathway\u2019s required skills. ' +
  'It measures how much of the related curriculum you have covered, not professional readiness.'

export const CAREER_PATHWAY_LIMITATIONS: readonly string[] = [
  'Career pathways are suggestions to explore, not guarantees of employment or job readiness.',
  'Matching uses module completion and catalog skill weights only; it is not a hiring assessment.',
  'No assessment or portfolio evidence is tracked yet, so missing evidence is always listed as an action.',
  'A single completed module never qualifies you for a role on its own.',
]

export const CareerSkillImportanceSchema = z.enum(['required', 'helpful'])

export const CareerSkillSchema = z.object({
  skillId: SlugSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  importance: CareerSkillImportanceSchema,
  estimatedExposurePct: PercentSchema.nullable(),
  status: SkillStatusSchema,
  supportingModuleSlugs: z.array(SlugSchema),
  limitation: z.string().min(1),
})

export const MissingCompetencySchema = z.object({
  skillId: SlugSchema,
  name: z.string().min(1),
  status: SkillStatusSchema,
  reason: z.string().min(1),
  suggestedModuleSlugs: z.array(SlugSchema),
  practiceActivities: z.array(ActivityTemplateSchema),
  portfolioEvidence: z.array(z.string().min(1)),
})

export const NextLearningActivitySchema = z.object({
  skillId: SlugSchema,
  skillName: z.string().min(1),
  moduleSlug: SlugSchema.nullable(),
  moduleName: z.string().min(1).nullable(),
  title: z.string().min(1),
  type: ActivityTemplateSchema.shape.type,
  minutes: z.number().int().positive(),
})

export const CareerPathStageSchema = z.enum(['EXPLORING', 'BUILDING', 'DEVELOPING'])

export const CareerPathMatchSchema = z.object({
  slug: SlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  estimatedCoveragePct: PercentSchema,
  stage: CareerPathStageSchema,
  stageLabel: z.string().min(1),
  requiredSkills: z.array(CareerSkillSchema),
  helpfulSkills: z.array(CareerSkillSchema),
  moduleSlugs: z.array(SlugSchema),
  missingCompetencies: z.array(MissingCompetencySchema),
  suggestedProjects: z.array(z.string().min(1)),
  portfolioEvidence: z.array(z.string().min(1)),
  nextLearningActivities: z.array(NextLearningActivitySchema),
  explanation: z.array(z.string().min(1)),
  limitations: z.array(z.string().min(1)),
  pathwayNote: z.string().min(1),
  employmentClaim: z.literal(false),
})

export const CareerPathDefinitionSchema = z.object({
  slug: SlugSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  requiredSkillIds: z.array(SlugSchema).min(1),
  helpfulSkillIds: z.array(SlugSchema),
  moduleSlugs: z.array(SlugSchema).min(1),
  suggestedProjects: z.array(z.string().min(1)).min(1),
  portfolioEvidence: z.array(z.string().min(1)).min(1),
  pathwayNote: z.string().min(1),
})

export const CareerPathListResponseSchema = z.object({
  careerPaths: z.array(CareerPathMatchSchema),
  methodology: z.string().min(1),
  limitations: z.array(z.string().min(1)),
  generatedAt: IsoDateTimeSchema,
})

export const CareerPathDetailResponseSchema = z.object({
  careerPath: CareerPathMatchSchema,
  methodology: z.string().min(1),
  limitations: z.array(z.string().min(1)),
  generatedAt: IsoDateTimeSchema,
})

const PATHWAY_NOTE =
  'Explore this pathway by building the missing skills and portfolio evidence. It is not a guarantee of employment or a statement that you are job-ready.'

export const CAREER_PATHS: readonly z.infer<typeof CareerPathDefinitionSchema>[] =
  CareerPathDefinitionSchema.array().parse([
    {
      slug: 'junior-python-developer',
      title: 'Junior Python Developer',
      description:
        'Build and maintain small Python applications, scripts and database-backed services with tests and clear documentation.',
      requiredSkillIds: [
        'programming-fundamentals',
        'control-flow-debugging',
        'python-programming',
        'sql-joins',
        'schema-design',
      ],
      helpfulSkillIds: ['numerical-methods', 'data-wrangling', 'model-serving'],
      moduleSlugs: [
        'intro-to-computer-programming',
        'numerical-programming-in-python',
        'relational-databases',
        'productionization-of-ml-systems',
      ],
      suggestedProjects: [
        'A command-line tool that imports a CSV, validates it and writes a clean report.',
        'A small REST API backed by a relational database with input validation and tests.',
        'A data-cleaning package with a README, examples and an automated test suite.',
      ],
      portfolioEvidence: [
        'A public repository with setup instructions and tests.',
        'A short README explaining the problem, design decisions and trade-offs.',
      ],
      pathwayNote: PATHWAY_NOTE,
    },
    {
      slug: 'junior-data-analyst',
      title: 'Junior Data Analyst',
      description:
        'Turn business questions into clean analyses, useful dashboards and clear recommendations for stakeholders.',
      requiredSkillIds: ['data-wrangling', 'sql-joins', 'chart-selection', 'kpi-definition'],
      helpfulSkillIds: [
        'dashboard-design',
        'storytelling-with-data',
        'experiment-analysis',
        'schema-design',
      ],
      moduleSlugs: [
        'numerical-programming-in-python',
        'relational-databases',
        'data-visualization-tools',
        'applied-business-analytics',
      ],
      suggestedProjects: [
        'An end-to-end dashboard for a public dataset with documented metric definitions.',
        'A KPI review that compares two periods and recommends one business action.',
        'A reproducible A/B test analysis with assumptions and limitations.',
      ],
      portfolioEvidence: [
        'A dashboard link or screenshots with a written explanation of the decisions it supports.',
        'An analysis notebook with a stakeholder summary on the first page.',
      ],
      pathwayNote: PATHWAY_NOTE,
    },
    {
      slug: 'junior-machine-learning-engineer',
      title: 'Junior Machine Learning Engineer',
      description:
        'Train, evaluate and explain supervised and deep learning models, with strong data handling and validation habits.',
      requiredSkillIds: [
        'python-programming',
        'supervised-model-tuning',
        'feature-engineering',
        'model-evaluation',
        'neural-network-basics',
      ],
      helpfulSkillIds: [
        'training-regularization',
        'pytorch-workflow',
        'cnn-architectures',
        'transformer-models',
        'data-wrangling',
      ],
      moduleSlugs: [
        'numerical-programming-in-python',
        'advanced-machine-learning',
        'intro-to-deep-learning',
        'dl-for-computer-vision',
        'dl-for-nlp',
      ],
      suggestedProjects: [
        'A model comparison notebook with a validation strategy and error analysis.',
        'An image classifier with an ablation table and a short model card.',
        'A fine-tuned NLP model evaluated with task-appropriate metrics.',
      ],
      portfolioEvidence: [
        'A model card that states intended use, data, metrics and known failure modes.',
        'A reproducible notebook or repository with a documented training command.',
      ],
      pathwayNote: PATHWAY_NOTE,
    },
    {
      slug: 'mlops-ml-platform-associate',
      title: 'MLOps / ML Platform Associate',
      description:
        'Help teams package, deploy, monitor and scale machine learning systems reliably and repeatably.',
      requiredSkillIds: [
        'model-serving',
        'monitoring-drift',
        'ml-cicd',
        'data-parallelism',
        'distributed-training-ops',
      ],
      helpfulSkillIds: [
        'scalability-tradeoffs',
        'azure-ml-workspace',
        'model-evaluation',
        'python-programming',
      ],
      moduleSlugs: [
        'advanced-machine-learning',
        'distributed-ml',
        'ml-genai-with-microsoft-azure',
        'productionization-of-ml-systems',
      ],
      suggestedProjects: [
        'A containerised model API with health checks, input validation and a sample client.',
        'A drift-monitoring report with thresholds, alert rules and a rollback plan.',
        'A CI pipeline that tests, trains and publishes a versioned model artefact.',
      ],
      portfolioEvidence: [
        'A deployment runbook covering start-up, rollback and on-call checks.',
        'A monitoring dashboard or report with example alerts.',
      ],
      pathwayNote: PATHWAY_NOTE,
    },
    {
      slug: 'junior-ai-application-developer',
      title: 'Junior AI Application Developer',
      description:
        'Build applications that use generative and classical AI models responsibly, with evaluation and guardrails.',
      requiredSkillIds: [
        'python-programming',
        'transformer-models',
        'generative-deployment',
        'responsible-ai',
        'azure-ml-workspace',
      ],
      helpfulSkillIds: [
        'neural-network-basics',
        'model-serving',
        'problem-framing',
        'text-representation',
        'model-evaluation',
      ],
      moduleSlugs: [
        'numerical-programming-in-python',
        'intro-to-deep-learning',
        'dl-for-nlp',
        'ml-genai-with-microsoft-azure',
        'productionization-of-ml-systems',
      ],
      suggestedProjects: [
        'A small assistant application that retrieves documents and cites its sources.',
        'A prompt and evaluation sheet covering quality, safety and cost.',
        'A deployed generative endpoint with usage limits and failure handling.',
      ],
      portfolioEvidence: [
        'A demo application with a README and a responsible-AI checklist.',
        'An evaluation report with example prompts, outputs and known limitations.',
      ],
      pathwayNote: PATHWAY_NOTE,
    },
  ])

export function getCareerPath(
  slug: string,
): z.infer<typeof CareerPathDefinitionSchema> | undefined {
  return CAREER_PATHS.find((entry) => entry.slug === slug)
}

export type CareerSkillImportance = z.infer<typeof CareerSkillImportanceSchema>
export type CareerSkill = z.infer<typeof CareerSkillSchema>
export type MissingCompetency = z.infer<typeof MissingCompetencySchema>
export type NextLearningActivity = z.infer<typeof NextLearningActivitySchema>
export type CareerPathStage = z.infer<typeof CareerPathStageSchema>
export type CareerPathMatch = z.infer<typeof CareerPathMatchSchema>
export type CareerPathDefinition = z.infer<typeof CareerPathDefinitionSchema>
export type CareerPathListResponse = z.infer<typeof CareerPathListResponseSchema>
export type CareerPathDetailResponse = z.infer<typeof CareerPathDetailResponseSchema>
