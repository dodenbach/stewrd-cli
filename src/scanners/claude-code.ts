import { homedir } from "os";
import { join } from "path";
import { readJsoncFile, parseServers, buildResult } from "./base.js";
import type { ClientScanResult } from "../types.js";

const CONFIG_PATHS = [
  join(homedir(), ".claude", ".mcp.json"),
  join(homedir(), ".claude.json"),
];

export async function scanClaudeCode(): Promise<ClientScanResult> {
  // Try .claude/.mcp.json first (dedicated MCP config), fall back to .claude.json
  for (const configPath of CONFIG_PATHS) {
    try {
      const data = await readJsoncFile(configPath);
      if (!data || typeof data !== "object") continue;

      const root = data as Record<string, unknown>;
      const mcpServers = root.mcpServers as
        | Record<string, Record<string, unknown>>
        | undefined;

      if (mcpServers && Object.keys(mcpServers).length > 0) {
        return buildResult("Claude Code", configPath, parseServers(mcpServers));
      }
    } catch (e) {
      return buildResult("Claude Code", configPath, [], String(e));
    }
  }

  return buildResult("Claude Code", CONFIG_PATHS[0], []);
}
