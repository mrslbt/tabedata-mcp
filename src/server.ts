/**
 * MCP server wiring. Builds an McpServer with every tool registered, all
 * input validated via zod, and all errors uniformly serialized into MCP
 * tool-error responses.
 *
 * Both transports (stdio + Streamable HTTP) call buildServer() so the only
 * difference between local and remote use is the connect() target.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./config.js";
import { logger } from "./logger.js";
import { getTools } from "./tools/index.js";
import type { ToolContext } from "./tools/types.js";

const SERVER_NAME = "tabedata-mcp";
const SERVER_VERSION = "1.0.2";

export function buildServer(config: Config): McpServer {
  const ctx: ToolContext = { config };
  const tools = getTools(config);

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
      },
      async (args: unknown) => {
        try {
          const parsed = tool.inputSchema.parse(args);
          const result = await tool.handler(parsed, ctx);
          if (result.type === "text") {
            return { content: [{ type: "text" as const, text: result.text }] };
          }
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result.data, null, 2),
              },
            ],
          };
        } catch (err) {
          logger.error("Tool handler failed", {
            tool: tool.name,
            error: err instanceof Error ? err.message : String(err),
          });
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Error in ${tool.name}: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
          };
        }
      },
    );
  }

  return server;
}
