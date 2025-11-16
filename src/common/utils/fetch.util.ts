import { Logger } from '@nestjs/common';

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 1500,
): Promise<Response> {
  for (let i = 1; i <= retries; i++) {
    try {
      const response = await fetch(url, options);

      if (
        response.ok ||
        (response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429)
      ) {
        return response;
      }

      Logger.warn(
        `Fetch attempt ${i}/${retries} failed for ${url} - Status: ${response.status}`,
      );
      if (i === retries) return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Logger.warn(
        `Fetch attempt ${i}/${retries} failed for ${url} - Error: ${errorMessage}`,
      );
      if (i === retries) throw error;
    }
    // Exponential backoff
    await new Promise((res) => setTimeout(res, delay * Math.pow(2, i - 1)));
  }
  throw new Error('Fetch retries exhausted');
}
