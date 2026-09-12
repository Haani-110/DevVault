import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { configureApp } from './app-setup';

let cachedServer: express.Express | undefined;

/**
 * Serverless-style entrypoint: the Nest app is built once and reused across
 * warm invocations, since booting a DI container per request is pure latency.
 * Standalone runs use `main.ts`; both share `configureApp`, so their pipes,
 * CORS and docs are the same by construction.
 */
async function createApp(): Promise<express.Express> {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bufferLogs: true,
    // A function runtime can freeze a container between requests; a 5-minute
    // idle timeout would then fail a job mid-import for reasons nobody can see
    // in the logs. Import work is guarded server-side instead (see
    // ImportService.onApplicationBootstrap).
    abortOnError: false,
  });

  configureApp(app);
  await app.init();
  return server;
}

export default async function handler(req: express.Request, res: express.Response): Promise<void> {
  cachedServer ??= await createApp();
  await cachedServer(req, res);
}
