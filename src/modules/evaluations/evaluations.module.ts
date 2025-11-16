import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { EvaluationsService } from './services/evaluations.service';
import { EvaluationDocumentsService } from './services/evaluation-documents.service';
import { SystemDocumentsService } from './services/system-documents.service';
import { EvaluationsController } from './controllers/evaluations.controller';
import { SystemDocumentsController } from './controllers/system-documents.controller';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../../prisma/prisma.module';
import {
  CvEvaluationProcessor,
  ProjectEvaluationProcessor,
} from './processors/evaluation.processor';
import { OverallScoringProcessor } from './processors/overall-scoring.processor';

@Module({
  imports: [
    StorageModule,
    PrismaModule,
    ConfigModule,
    BullModule.registerQueue(
      { name: 'cv-evaluation' },
      { name: 'project-evaluation' },
      { name: 'overall-scoring' },
    ),
    BullModule.registerFlowProducer({ name: 'evaluation-flow' }),
  ],
  controllers: [EvaluationsController, SystemDocumentsController],
  providers: [
    EvaluationsService,
    SystemDocumentsService,
    EvaluationDocumentsService,

    // processors
    CvEvaluationProcessor,
    ProjectEvaluationProcessor,
    OverallScoringProcessor,
  ],
})
export class EvaluationsModule {}
