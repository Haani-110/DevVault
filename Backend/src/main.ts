import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app-setup';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);
  await app.listen(env.port);
  // Bind address is printed, not assumed: `docker compose up` is where most
  // people meet this app, and inside a container a 127.0.0.1 hint is a red
  // herring that wastes ten minutes.
  console.log(`DevVault API ready on http://localhost:${env.port}/api/v1 (Swagger at /api/docs)`);
}

void bootstrap();
