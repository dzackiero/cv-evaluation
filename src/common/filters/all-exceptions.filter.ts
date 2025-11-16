import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from '../types/error-response.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, error } = this.getErrorDetails(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;

    const responseBody: ErrorResponse = {
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (error) {
      responseBody.error = error;
    }

    // Include error stack if in development mode
    if (process.env.NODE_ENV !== 'production' && stack) {
      responseBody.stack = stack;
    }

    const logMessage = Array.isArray(message) ? message.join(', ') : message;
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${logMessage}`,
        stack,
      );
    } else if (status >= 400) {
      this.logger.debug(`[${request.method}] ${request.url} - ${logMessage}`);
    }

    response.status(status).json(responseBody);
  }

  private getErrorDetails(exception: unknown): {
    status: number;
    message: string | string[];
    error?: string;
  } {
    if (exception instanceof HttpException) {
      const httpResponse = exception.getResponse();
      const status = exception.getStatus();

      if (typeof httpResponse === 'string') {
        return { status, message: httpResponse };
      }

      if (typeof httpResponse === 'object' && httpResponse !== null) {
        const response = httpResponse as Record<string, unknown>;
        const message = response.message ?? exception.message;
        const error = response.error;

        let finalMessage: string | string[];
        if (Array.isArray(message)) {
          finalMessage = message;
        } else if (typeof message === 'string') {
          finalMessage = message;
        } else {
          finalMessage = exception.message;
        }

        return {
          status,
          message: finalMessage,
          error: typeof error === 'string' ? error : undefined,
        };
      }
    }

    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message || 'Internal Server Error',
        error: 'Internal Server Error',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Unknown error occurred',
      error: 'Internal Server Error',
    };
  }
}
