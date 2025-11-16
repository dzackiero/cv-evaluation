import { Module } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { EvaluationsController } from './evaluations.controller';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [StorageModule, PrismaModule],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
})
export class EvaluationsModule {}
