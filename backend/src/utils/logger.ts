import { isProduction } from '../config/env';

type LogArgs = readonly unknown[];

function stamp(): string {
  return new Date().toISOString();
}

function serialize(args: LogArgs): LogArgs {
  return args.map((arg) => (arg instanceof Error ? `${arg.name}: ${arg.message}` : arg)) as LogArgs;
}

/**
 * 极简结构化日志。
 * 开发环境保留详细输出，生产环境只保留 warn / error。
 */
export const logger = {
  debug(...args: LogArgs): void {
    if (!isProduction) {
      console.debug(`[${stamp()}] [debug]`, ...serialize(args));
    }
  },
  info(...args: LogArgs): void {
    if (!isProduction) {
      console.info(`[${stamp()}] [info]`, ...serialize(args));
    }
  },
  warn(...args: LogArgs): void {
    console.warn(`[${stamp()}] [warn]`, ...serialize(args));
  },
  error(...args: LogArgs): void {
    console.error(`[${stamp()}] [error]`, ...serialize(args));
  },
};
