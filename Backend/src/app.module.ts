import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { configureApp } from './app-setup';
import { AuthModule } from './auth/auth.module';
import { env, isTest } from './config/env';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { ImportModule } from './import/import.module';
import { NotesModule } from './notes/notes.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { SecurityModule } from './common/security/security.module';
import { SnippetsModule } from './snippets/snippets.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

/**
 * `configureApp` is where the HTTP layer (helmet, CORS, validation, the error
 * filter, Swagger) is defined; both entrypoints call it so they can't drift.
 * Re-exported here so tooling that looked for it on the module still finds it.
 */
export { configureApp };

@Module({
  imports: [
    // A per-IP limiter is the only cheap defence against a script hammering
    // /auth/login, and it only works if it is global: guards attached one
    // controller at a time are guards waiting to be forgotten on the next one.
    // The auth routes that matter tighten this further with @Throttle, and
    // health opts out with @SkipThrottle.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: env.throttle.windowMs, limit: env.throttle.limit }],
      // Skipped under test only. A suite that fires 30 requests in a second is
      // exercising the limiter's arithmetic rather than the app's behaviour, and
      // a 429 mid-suite reads as a broken endpoint. The `@Throttle` limits on the
      // auth routes are real and unchanged in every other environment.
      skipIf: () => isTest,
    }),
    SecurityModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    NotesModule,
    ProjectsModule,
    TasksModule,
    SnippetsModule,
    DashboardModule,
    ImportModule,
    EmailModule,
    AiModule,
    HealthModule,
  ],
  providers: [
    // Registered as an APP_GUARD, so every route inherits it — including any
    // route added later. Without this line the ThrottlerModule above does
    // nothing at all.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
