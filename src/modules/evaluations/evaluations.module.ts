import { Module } from '@nestjs/common';
import { EvaluationsService } from './services/evaluations.service';
import { SystemDocsService } from './services/system-docs.service';
import { EvaluationDocumentService } from './services/evaluation-document.service';
import {
  EvaluationsController,
  TestController,
} from './controllers/evaluations.controller';
import { SystemDocsController } from './controllers/system-docs.controller';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [StorageModule, PrismaModule],
  controllers: [EvaluationsController, SystemDocsController, TestController],
  providers: [EvaluationsService, SystemDocsService, EvaluationDocumentService],
})
export class EvaluationsModule {}
