import { Module } from '@nestjs/common';
import { SnippetsController } from './snippets.controller';
import { SnippetsService } from './snippets.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SnippetsController],
  providers: [SnippetsService],
})
export class SnippetsModule {}
