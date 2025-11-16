import { transports, format } from 'winston';
import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston';

export const LoggerFactory = (appName = 'Application') => {
  const DEBUG = process.env.DEBUG === 'true';
  const LOG_FORMAT = process.env.LOG_FORMAT ?? 'text';
  const NODE_ENV = process.env.NODE_ENV;

  let consoleFormat = format.combine(
    format.timestamp(),
    format.ms(),
    nestWinstonModuleUtilities.format.nestLike(appName, {
      colors: true,
      prettyPrint: true,
    }),
  );

  if (LOG_FORMAT === 'json') {
    consoleFormat = format.combine(
      format.timestamp(),
      format.ms(),
      format.errors({ stack: true }),
      format.json(),
    );
  }

  return WinstonModule.createLogger({
    level: DEBUG ? 'debug' : 'info',
    transports: [
      new transports.Console({
        format: consoleFormat,
        silent: NODE_ENV === 'test',
      }),
    ],
  });
};
