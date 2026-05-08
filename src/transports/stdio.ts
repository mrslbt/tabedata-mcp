import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Config } from "../config.js";
import { logger } from "../logger.js";
import { buildServer } from "../server.js";

export async function runStdio(config: Config): Promise<void> {
  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("tabedata-mcp ready on stdio");
}
