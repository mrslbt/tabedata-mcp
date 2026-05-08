#!/usr/bin/env node
/**
 * tabedata-mcp entry point.
 *
 * Dispatches to stdio or Streamable HTTP transport based on MCP_TRANSPORT.
 * Stdio is the default; HTTP requires MCP_AUTH_TOKEN.
 */

import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { runHttp } from "./transports/http.js";
import { runStdio } from "./transports/stdio.js";

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.transport === "http") {
    await runHttp(config);
  } else {
    await runStdio(config);
  }
}

main().catch((err) => {
  logger.error("fatal", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
