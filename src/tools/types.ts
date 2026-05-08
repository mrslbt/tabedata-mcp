/**
 * Shared types for the tool registry.
 *
 * Mirrors the paypay-mcp pattern: every tool exports a ToolDefinition with
 * a zod input schema. The server wires them in `server.ts` so each tool file
 * stays focused on its handler.
 *
 * Bilingual rule: every tool description leads with English then provides the
 * Japanese translation after a blank line — so JP-native LLM clients can
 * reason about the tool natively.
 */

import type { z } from "zod";
import type { Config } from "../config.js";

export type ToolInputSchema = z.ZodObject<z.ZodRawShape>;

export interface ToolContext {
  config: Config;
}

export interface ToolDefinition<
  TInput extends ToolInputSchema = ToolInputSchema,
> {
  name: string;
  title: string;
  /** English-first description with a Japanese translation after a blank line. */
  description: string;
  inputSchema: TInput;
  handler: (
    input: z.infer<TInput>,
    ctx: ToolContext,
  ) => Promise<ToolResult>;
}

export type ToolResult =
  | { type: "text"; text: string }
  | { type: "json"; data: unknown };

export function textResult(text: string): ToolResult {
  return { type: "text", text };
}

export function jsonResult(data: unknown): ToolResult {
  return { type: "json", data };
}
