/**
 * Environment-driven config. Keeps the rest of the codebase free of `process.env`
 * lookups so transports + tools can be tested with explicit Config objects.
 *
 * Mirrors the paypay-mcp dispatch model: MCP_TRANSPORT chooses stdio vs HTTP.
 * HTTP refuses to start without an auth token to prevent unauthenticated remote
 * exposure behind same-host proxies.
 */

export type Transport = "stdio" | "http";

export interface Config {
  transport: Transport;
  /** HTTP transport only. */
  httpHost: string;
  httpPort: number;
  httpAuthToken: string | undefined;
  httpAllowedOrigins: string[];
}

const DEFAULT_HTTP_PORT = 8787;
const DEFAULT_HTTP_HOST = "127.0.0.1";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const transport: Transport =
    env.MCP_TRANSPORT === "http" ? "http" : "stdio";

  const httpPort = env.MCP_HTTP_PORT
    ? Number.parseInt(env.MCP_HTTP_PORT, 10)
    : DEFAULT_HTTP_PORT;
  if (!Number.isFinite(httpPort) || httpPort <= 0 || httpPort > 65535) {
    throw new Error(`Invalid MCP_HTTP_PORT: ${env.MCP_HTTP_PORT}`);
  }

  const httpHost = env.MCP_HTTP_HOST ?? DEFAULT_HTTP_HOST;
  const httpAuthToken = env.MCP_AUTH_TOKEN;
  const httpAllowedOrigins = (env.MCP_HTTP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    transport,
    httpHost,
    httpPort,
    httpAuthToken,
    httpAllowedOrigins,
  };
}
