import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './modules/storage/storage.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
      }),
      inject: [ConfigService],
    }),

    // modules
    StorageModule,
    EvaluationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
