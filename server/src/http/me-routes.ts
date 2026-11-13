import { CoachAskRequestSchema } from '@spd/shared'
import { Router, type NextFunction, type Request, type Response } from 'express'
import {
  unavailableAssessmentDataAdapter,
  type AssessmentDataAdapter,
} from '../coach/assessment-adapter'
import { createGeminiCoachLlm, type CoachLlm } from '../coach/gemini'
import { CoachRateLimiter } from '../coach/rate-limit'
import {
  buildCoachAnswer,
  buildCoachModuleGuide,
  buildCoachSummary,
} from '../coach/service'
import { env } from '../config/env'
import type { Clock } from '../platform/time'
import { systemClock } from '../platform/time'
import type { Repositories } from '../repositories/contracts'
import { buildDashboard } from '../services/dashboard'
import { buildModuleDetail, buildModuleList } from '../services/modules'
import {
  buildCareerPathDetail,
  buildCareerPathMatches,
  buildSkillList,
  buildSkillography,
  type SkillographyInput,
} from '../services/skillography'
import { sessionIdentityResolver, type IdentityResolver } from './identity'

export interface CoachDependencies {
  /** `null` forces the deterministic fallback (used by tests and disabled setups). */
  llm?: CoachLlm | null
  assessmentData?: AssessmentDataAdapter
  rateLimiter?: CoachRateLimiter
  askRateLimiter?: CoachRateLimiter
}

export interface MeRouterDependencies {
  repositories: Repositories
  clock?: Clock
  identityResolver?: IdentityResolver
  timeZone?: string
  coach?: CoachDependencies
}

interface StudentContext {
  student: NonNullable<Awaited<ReturnType<Repositories['students']['getStudentProfile']>>>
  enrollment: NonNullable<Awaited<ReturnType<Repositories['enrollments']['getCurrentEnrollment']>>>
}

type AsyncHandler = (req: Request, res: Response) => Promise<void>

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next)
  }
}

async function loadStudentContext(
  dependencies: MeRouterDependencies,
  req: Request,
  res: Response,
): Promise<StudentContext | null> {
  const resolver = dependencies.identityResolver ?? sessionIdentityResolver
  const studentId = await resolver(req)

  if (studentId === null || studentId === undefined) {
    res.status(401).json({ error: 'unauthenticated' })
    return null
  }

  const [student, enrollment] = await Promise.all([
    dependencies.repositories.students.getStudentProfile(studentId),
    dependencies.repositories.enrollments.getCurrentEnrollment(studentId),
  ])

  if (!student) {
    res.status(401).json({ error: 'unauthenticated' })
    return null
  }
  if (!enrollment) {
    res.status(404).json({ error: 'enrollment_not_found' })
    return null
  }

  return { student, enrollment }
}

export function createMeRouter(dependencies: MeRouterDependencies): Router {
  const router = Router()
  const clock = dependencies.clock ?? systemClock
  const timeZone = dependencies.timeZone

  const coachDependencies = {
    llm:
      dependencies.coach?.llm !== undefined
        ? dependencies.coach.llm
        : createGeminiCoachLlm({
            provider: env.LLM_PROVIDER,
            apiKey: env.GEMINI_API_KEY,
            model: env.GEMINI_MODEL,
            timeoutMs: env.GEMINI_TIMEOUT_MS,
          }),
    assessmentData: dependencies.coach?.assessmentData ?? unavailableAssessmentDataAdapter,
    rateLimiter:
      dependencies.coach?.rateLimiter ??
      new CoachRateLimiter(
        env.COACH_RATE_LIMIT_MAX,
        env.COACH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
      ),
    askRateLimiter:
      dependencies.coach?.askRateLimiter ??
      new CoachRateLimiter(
        env.COACH_ASK_RATE_LIMIT_MAX,
        env.COACH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
      ),
  }

  function enforceCoachRateLimit(
    res: Response,
    limiter: CoachRateLimiter,
    key: string,
  ): boolean {
    const result = limiter.consume(key)
    if (result.allowed) return true
    res.setHeader('Retry-After', String(result.retryAfterSeconds))
    res.status(429).json({
      error: 'coach_rate_limited',
      message: 'The AI Coach rate limit was reached. Please try again shortly.',
      retryAfterSeconds: result.retryAfterSeconds,
    })
    return false
  }

  async function loadSkillographyInput(
    req: Request,
    res: Response,
  ): Promise<SkillographyInput | null> {
    const context = await loadStudentContext(dependencies, req, res)
    if (!context) return null

    const moduleProgress = await dependencies.repositories.moduleProgress.listModuleProgress(
      context.enrollment.id,
    )

    return {
      student: context.student,
      enrollment: context.enrollment,
      moduleProgress,
      now: clock.now(),
      timeZone,
    }
  }

  router.get(
    '/dashboard',
    asyncRoute(async (req, res) => {
      const context = await loadStudentContext(dependencies, req, res)
      if (!context) return

      const moduleProgress = await dependencies.repositories.moduleProgress.listModuleProgress(
        context.enrollment.id,
      )

      res.json(
        buildDashboard({
          student: context.student,
          enrollment: context.enrollment,
          moduleProgress,
          now: clock.now(),
          timeZone,
        }),
      )
    }),
  )

  router.get(
    '/coach',
    asyncRoute(async (req, res) => {
      const context = await loadStudentContext(dependencies, req, res)
      if (!context) return
      if (
        !enforceCoachRateLimit(
          res,
          coachDependencies.rateLimiter,
          `coach:${context.student.id}`,
        )
      ) {
        return
      }

      const moduleProgress = await dependencies.repositories.moduleProgress.listModuleProgress(
        context.enrollment.id,
      )

      res.json(
        await buildCoachSummary(
          {
            enrollment: context.enrollment,
            moduleProgress,
            now: clock.now(),
          },
          coachDependencies,
        ),
      )
    }),
  )

  router.post(
    '/coach/ask',
    asyncRoute(async (req, res) => {
      const context = await loadStudentContext(dependencies, req, res)
      if (!context) return
      if (
        !enforceCoachRateLimit(
          res,
          coachDependencies.askRateLimiter,
          `coach-ask:${context.student.id}`,
        )
      ) {
        return
      }

      const body = CoachAskRequestSchema.parse(req.body)
      const moduleProgress = await dependencies.repositories.moduleProgress.listModuleProgress(
        context.enrollment.id,
      )

      res.json(
        await buildCoachAnswer(
          {
            enrollment: context.enrollment,
            moduleProgress,
            now: clock.now(),
            question: body.question,
            moduleSlug: body.moduleSlug,
          },
          coachDependencies,
        ),
      )
    }),
  )

  router.post(
    '/coach/modules/:slug/guide',
    asyncRoute(async (req, res) => {
      const context = await loadStudentContext(dependencies, req, res)
      if (!context) return
      if (
        !enforceCoachRateLimit(
          res,
          coachDependencies.askRateLimiter,
          `coach-guide:${context.student.id}`,
        )
      ) {
        return
      }

      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug
      if (!slug) {
        res.status(404).json({ error: 'module_not_found', slug: slug ?? null })
        return
      }

      const moduleProgress = await dependencies.repositories.moduleProgress.listModuleProgress(
        context.enrollment.id,
      )
      const guide = await buildCoachModuleGuide(
        {
          enrollment: context.enrollment,
          moduleProgress,
          now: clock.now(),
          moduleSlug: slug,
        },
        coachDependencies,
      )

      if (!guide) {
        res.status(404).json({ error: 'module_not_found', slug })
        return
      }

      res.json(guide)
    }),
  )

  router.get(
    '/modules',
    asyncRoute(async (req, res) => {
      const context = await loadStudentContext(dependencies, req, res)
      if (!context) return

      const moduleProgress = await dependencies.repositories.moduleProgress.listModuleProgress(
        context.enrollment.id,
      )

      res.json(
        buildModuleList({
          enrollment: context.enrollment,
          moduleProgress,
          now: clock.now(),
          timeZone,
        }),
      )
    }),
  )

  router.get(
    '/modules/:slug',
    asyncRoute(async (req, res) => {
      const context = await loadStudentContext(dependencies, req, res)
      if (!context) return

      const moduleProgress = await dependencies.repositories.moduleProgress.listModuleProgress(
        context.enrollment.id,
      )
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug

      if (!slug) {
        res.status(404).json({ error: 'module_not_found', slug: slug ?? null })
        return
      }

      const detail = buildModuleDetail(
        {
          enrollment: context.enrollment,
          moduleProgress,
          now: clock.now(),
          timeZone,
        },
        slug,
      )

      if (!detail) {
        res.status(404).json({ error: 'module_not_found', slug })
        return
      }

      res.json(detail)
    }),
  )

  router.get(
    '/skills',
    asyncRoute(async (req, res) => {
      const input = await loadSkillographyInput(req, res)
      if (!input) return
      res.json(buildSkillList(input))
    }),
  )

  router.get(
    '/skillography',
    asyncRoute(async (req, res) => {
      const input = await loadSkillographyInput(req, res)
      if (!input) return
      res.json(buildSkillography(input))
    }),
  )

  router.get(
    '/career-paths',
    asyncRoute(async (req, res) => {
      const input = await loadSkillographyInput(req, res)
      if (!input) return
      res.json(buildCareerPathMatches(input))
    }),
  )

  router.get(
    '/career-paths/:slug',
    asyncRoute(async (req, res) => {
      const input = await loadSkillographyInput(req, res)
      if (!input) return

      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug
      if (!slug) {
        res.status(404).json({ error: 'career_path_not_found', slug: slug ?? null })
        return
      }

      const detail = buildCareerPathDetail(input, slug)
      if (!detail) {
        res.status(404).json({ error: 'career_path_not_found', slug })
        return
      }

      res.json(detail)
    }),
  )

  return router
}
