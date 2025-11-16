import { Logger } from '@nestjs/common';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly isRetryable: boolean,
    public readonly statusCode?: number,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = 'LLMError';
    Object.setPrototypeOf(this, LLMError.prototype);
  }
}

interface RetryConfig {
  maxRetries?: number;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  timeoutMs?: number;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  timeoutMs: 60000,
};

let logger: Logger;

function getLogger(): Logger {
  if (!logger) {
    logger = new Logger('LLMResilience');
  }
  return logger;
}

function calculateBackoffDelay(
  attempt: number,
  config: Required<RetryConfig>,
): number {
  const exponentialDelay = config.initialRetryDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxRetryDelayMs);
  const jitter = cappedDelay * 0.1 * (Math.random() - 0.5);
  return Math.max(cappedDelay + jitter, 0);
}

function isRetryableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const err = error as Record<string, unknown>;

  if (err.status === 429) {
    return true;
  }
  if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    return true;
  }
  if (typeof err.status === 'number' && err.status >= 500 && err.status < 600) {
    return true;
  }
  if (
    err.code === 'ECONNRESET' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'EHOSTUNREACH' ||
    err.code === 'ENETUNREACH'
  ) {
    return true;
  }
  if (err.code === 'ENOTFOUND' || err.code === 'GETADDRINFO') {
    return true;
  }

  return false;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), timeoutMs),
    ),
  ]);
}

function logRetryAttempt(
  attempt: number,
  maxRetries: number,
  operation: string,
  error?: unknown,
): void {
  const log = getLogger();
  const errorObj = error instanceof Error ? error : new Error(String(error));
  const errorRecord = error as Record<string, unknown>;

  log.warn(
    `[Retry ${attempt}/${maxRetries}] ${operation} - ${errorObj.message}`,
    {
      attempt,
      maxRetries,
      operation,
      errorCode:
        typeof errorRecord?.code === 'string' ? errorRecord.code : 'UNKNOWN',
      errorStatus:
        typeof errorRecord?.status === 'number'
          ? errorRecord.status
          : undefined,
      stack: errorObj.stack,
    },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes generateObject with retry logic, exponential backoff, and timeout
 * @param params - Parameters for generateObject call
 * @param config - Retry configuration (optional)
 * @returns The generated object
 */
export async function generateObjectWithRetry<T extends z.ZodType>(
  params: {
    model: any;
    temperature: number;
    schema: T;
    prompt: string;
  },
  config?: RetryConfig,
): Promise<z.infer<T>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const log = getLogger();
  let lastError: Error | undefined;

  log.debug(
    `Starting generateObject with retry (maxRetries: ${finalConfig.maxRetries}, timeout: ${finalConfig.timeoutMs}ms)`,
  );

  for (let attempt = 0; attempt < finalConfig.maxRetries; attempt++) {
    try {
      log.debug(
        `Attempt ${attempt + 1}/${finalConfig.maxRetries} - generateObject`,
      );

      const result = await withTimeout(
        generateObject(params),
        finalConfig.timeoutMs,
        'generateObject timeout',
      );

      log.debug(
        `✓ generateObject succeeded on attempt ${attempt + 1}/${finalConfig.maxRetries}`,
      );
      return result.object as z.infer<T>;
    } catch (error) {
      lastError = error as Error;
      const isRetryable = isRetryableError(error);

      logRetryAttempt(
        attempt + 1,
        finalConfig.maxRetries,
        'generateObject',
        lastError,
      );

      if (attempt >= finalConfig.maxRetries - 1 || !isRetryable) {
        break;
      }

      const delay = calculateBackoffDelay(attempt, finalConfig);
      log.debug(
        `Waiting ${Math.round(delay)}ms before retry attempt ${attempt + 2}`,
      );
      await sleep(delay);
    }
  }

  const errorRecord = lastError as unknown as Record<string, unknown>;
  const statusCode =
    typeof errorRecord?.status === 'number' ? errorRecord.status : undefined;
  const isRetryable = isRetryableError(lastError);

  throw new LLMError(
    `generateObject failed after ${finalConfig.maxRetries} attempts: ${lastError?.message}`,
    isRetryable,
    statusCode,
    lastError instanceof Error ? lastError : undefined,
  );
}

/**
 * Executes generateText with retry logic, exponential backoff, and timeout
 * @param params - Parameters for generateText call
 * @param config - Retry configuration (optional)
 * @returns The generated text
 * @throws LLMError if all retry attempts fail
 */
export async function generateTextWithRetry(
  params: {
    model: any;
    temperature: number;
    prompt: string;
  },
  config?: RetryConfig,
): Promise<string> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const log = getLogger();
  let lastError: Error | undefined;

  log.debug(
    `Starting generateText with retry (maxRetries: ${finalConfig.maxRetries}, timeout: ${finalConfig.timeoutMs}ms)`,
  );

  for (let attempt = 0; attempt < finalConfig.maxRetries; attempt++) {
    try {
      log.debug(
        `Attempt ${attempt + 1}/${finalConfig.maxRetries} - generateText`,
      );

      const result = await withTimeout(
        generateText(params),
        finalConfig.timeoutMs,
        'generateText timeout',
      );

      log.debug(
        `✓ generateText succeeded on attempt ${attempt + 1}/${finalConfig.maxRetries}`,
      );
      return result.text;
    } catch (error) {
      lastError = error as Error;
      const isRetryable = isRetryableError(error);

      logRetryAttempt(
        attempt + 1,
        finalConfig.maxRetries,
        'generateText',
        lastError,
      );

      // If this is the last attempt or error is not retryable, break
      if (attempt >= finalConfig.maxRetries - 1 || !isRetryable) {
        break;
      }

      // Calculate and apply backoff
      const delay = calculateBackoffDelay(attempt, finalConfig);
      log.debug(
        `Waiting ${Math.round(delay)}ms before retry attempt ${attempt + 2}`,
      );
      await sleep(delay);
    }
  }

  const errorRecord = lastError as unknown as Record<string, unknown>;
  const statusCode =
    typeof errorRecord?.status === 'number' ? errorRecord.status : undefined;
  const isRetryable = isRetryableError(lastError);

  throw new LLMError(
    `generateText failed after ${finalConfig.maxRetries} attempts: ${lastError?.message}`,
    isRetryable,
    statusCode,
    lastError instanceof Error ? lastError : undefined,
  );
}
