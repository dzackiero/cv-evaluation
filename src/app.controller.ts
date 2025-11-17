import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello() {
    return {
      message: 'Welcome to the CV Evaluation API',
      documentation: 'https://cv-evaluation.up.railway.app/docs',
      version: '1.0.0',
    };
  }
}
