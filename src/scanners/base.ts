import { readFile } from "fs/promises";
import { existsSync } from "fs";
import * as jsonc from "jsonc-parser";
import type { ClientScanResult, McpServer, Transport } from "../types.js";

export async function readJsoncFile(path: string): Promise<unknown | null> {
  if (!existsSync(path)) return null;
  const content = await readFile(path, "utf-8");
  return jsonc.parse(content);
}

export function detectTransport(server: Record<string, unknown>): Transport {
  if (server.type === "http" || server.url) {
    if (server.oauth) return "http+oauth";
    return "http";
  }
  if (typeof server.command === "string") {
    if (server.command === "npx" || server.command === "npx.cmd") return "npx";
    return "stdio";
  }
  return "unknown";
}

export function parseServers(
  mcpServers: Record<string, Record<string, unknown>> | undefined
): McpServer[] {
  if (!mcpServers || typeof mcpServers !== "object") return [];

  return Object.entries(mcpServers).map(([name, config]) => {
    const transport = detectTransport(config);
    const server: McpServer = { name, transport };

    if (config.command) server.command = String(config.command);
    if (Array.isArray(config.args))
      server.args = config.args.map((a) => String(a));
    if (config.url) server.url = String(config.url);
    if (config.env && typeof config.env === "object")
      server.env = config.env as Record<string, string>;
    if (config.description) server.description = String(config.description);
    if (config.oauth && typeof config.oauth === "object")
      server.oauth = config.oauth as McpServer["oauth"];

    return server;
  });
}

export function buildResult(
  client: string,
  configPath: string,
  servers: McpServer[],
  error?: string
): ClientScanResult {
  return {
    client,
    configPath,
    exists: existsSync(configPath),
    servers,
    error,
  };
}
