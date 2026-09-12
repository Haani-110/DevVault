import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { allowedOrigins, isProduction } from './config/env';

/** Origins allowed to call the API from a browser. */
export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // No Origin header means the request is not browser-driven (curl, health
    // checks, same-origin, server-to-server) — those are not a CORS question.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Local dev only: the Vite port moves between machines and worktrees, and
    // a localhost caller can already read everything a same-origin page can.
    if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Auth is a bearer header, never a cookie, so there is nothing for
  // `credentials: true` to enable here — only a wider surface.
  credentials: false,
  maxAge: 600,
};

/**
 * Wires up everything the HTTP layer needs, in one place.
 *
 * `main.ts` (standalone) and `server.ts` (serverless handler) used to be two
 * copies of the same 35 lines — which is exactly how a pipe, a header or a
 * CORS rule ends up applied in one and silently missing in the other.
 */
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  app.enableCors(corsOptions);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // A silently dropped field becomes a bug report that reads "my update
      // didn't save"; rejecting it names the problem where it starts.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  setupSwagger(app);
}

function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('DevVault API')
    .setDescription('DevVault Developer Productivity Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
}
