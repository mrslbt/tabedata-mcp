/**
 * stderr-only structured logger.
 *
 * stdio transport reserves stdout for the MCP framing. Anything written there
 * by mistake corrupts the protocol stream, so we never log to stdout.
 */

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, fields?: Record<string, unknown>): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) =>
    process.env.TABEDATA_DEBUG === "true" && emit("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) =>
    emit("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) =>
    emit("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) =>
    emit("error", message, fields),
};
