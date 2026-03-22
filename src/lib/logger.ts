type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  error?: { message: string; stack?: string };
  [key: string]: unknown;
}

function log(
  level: LogLevel,
  module: string,
  message: string,
  extra?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...extra,
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

function serializeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

export const logger = {
  info(module: string, message: string, extra?: Record<string, unknown>): void {
    log("info", module, message, extra);
  },

  warn(module: string, message: string, extra?: Record<string, unknown>): void {
    log("warn", module, message, extra);
  },

  error(
    module: string,
    message: string,
    err?: unknown,
    extra?: Record<string, unknown>
  ): void {
    log("error", module, message, {
      ...(err !== undefined ? { error: serializeError(err) } : {}),
      ...extra,
    });
  },
};
