import { Router, type NextFunction, type Request, type Response } from 'express'
import type { Clock } from '../platform/time'
import { systemClock } from '../platform/time'
import type { Repositories } from '../repositories/contracts'
import { buildDashboard } from '../services/dashboard'
import { buildModuleDetail, buildModuleList } from '../services/modules'
import { sessionIdentityResolver, type IdentityResolver } from './identity'

export interface MeRouterDependencies {
  repositories: Repositories
  clock?: Clock
  identityResolver?: IdentityResolver
  timeZone?: string
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

  return router
}
