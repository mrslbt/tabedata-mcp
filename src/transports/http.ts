/**
 * Streamable HTTP transport. Mirrors the paypay-mcp security model:
 *   - Refuses to start without MCP_AUTH_TOKEN.
 *   - Bearer auth on every request, compared with timingSafeEqual.
 *   - CORS defaults to no cross-origin access — opt in via MCP_HTTP_ALLOWED_ORIGINS.
 *
 * Spec: https://modelcontextprotocol.io/specification/server/transports
 *
 * Activation: v0.5. Wired in at v0.0.1 so the v0.5 cutover is config-only.
 */

import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Config } from "../config.js";
import { logger } from "../logger.js";
import { buildServer } from "../server.js";

export async function runHttp(config: Config): Promise<void> {
  if (!config.httpAuthToken) {
    throw new Error(
      "Refusing to start: MCP_TRANSPORT=http requires MCP_AUTH_TOKEN. " +
        "Set MCP_AUTH_TOKEN to a strong random string before enabling HTTP transport.",
    );
  }

  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && config.httpAllowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Mcp-Session-Id, Authorization",
    );
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url !== "/mcp") {
      res.writeHead(404);
      res.end();
      return;
    }

    if (!checkAuth(req, config)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    try {
      const sessionIdHeader = req.headers["mcp-session-id"];
      const sessionId = Array.isArray(sessionIdHeader)
        ? sessionIdHeader[0]
        : sessionIdHeader;

      let transport: StreamableHTTPServerTransport | undefined = sessionId
        ? sessions.get(sessionId)
        : undefined;

      if (!transport) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id: string) => {
            sessions.set(id, transport!);
            logger.info("MCP session opened", { sessionId: id });
          },
        });
        transport.onclose = () => {
          if (transport!.sessionId) {
            sessions.delete(transport!.sessionId);
            logger.info("MCP session closed", {
              sessionId: transport!.sessionId,
            });
          }
        };
        const server = buildServer(config);
        await server.connect(transport);
      }

      const body = await readBody(req);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      logger.error("HTTP handler failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal_server_error" }));
      }
    }
  });

  httpServer.listen(config.httpPort, config.httpHost, () => {
    logger.info("tabedata-mcp listening on HTTP", {
      host: config.httpHost,
      port: config.httpPort,
      allowedOrigins: config.httpAllowedOrigins,
    });
  });
}

function checkAuth(req: IncomingMessage, config: Config): boolean {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const presented = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(config.httpAuthToken!);
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
