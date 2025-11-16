import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): { message: string; documentation: string; version: string } {
    return {
      message: 'Welcome to the CV Evaluation API',
      documentation: 'Visit /docs for API documentation',
      version: '1.0',
    };
  }
}
