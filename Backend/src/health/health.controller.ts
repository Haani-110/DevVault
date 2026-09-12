import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type HealthStatus = 'ok' | 'degraded';

interface HealthReport {
  status: HealthStatus;
  database: 'up' | 'down';
  /** Process uptime, in seconds — the one thing worth knowing first after a restart. */
  uptimeSeconds: number;
  timestamp: string;
}

/**
 * A liveness endpoint for the frontend's connection indicator.
 *
 * `GET /api/v1/` returns Nest's 404, which still proves the HTTP layer is up —
 * but it can't tell "API fine, database gone" apart from "API down", and that
 * distinction is exactly what the UI shows a user who cannot save. The probe is
 * a `SELECT 1` with a deadline, because an unreachable database otherwise hangs
 * the request open and the UI keeps claiming everything is fine.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'API and database are both reachable' })
  @ApiResponse({ status: 503, description: 'API is up but the database is not' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthReport> {
    const database = await this.probeDatabase();

    if (database !== 'up') {
      // 503 rather than 200: a monitor, a load balancer or a browser can all act
      // on it without having to parse the body.
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async probeDatabase(): Promise<'up' | 'down'> {
    try {
      // $queryRaw executes through Prisma's normal client, so the DATABASE_URL
      // password cannot reach an error message. 1500ms is generous against the
      // 5s UI poll, and short enough that a wedged pool can't hang health.
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        timeoutAfter(1500, 'database probe timed out'),
      ]);
      return 'up';
    } catch {
      return 'down';
    }
  }
}

function timeoutAfter(ms: number, message: string): Promise<never> {
  return new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    // Do not keep the process alive just for a probe timer.
    timer.unref?.();
  });
}
