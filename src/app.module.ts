import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './modules/storage/storage.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    StorageModule,
    EvaluationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
