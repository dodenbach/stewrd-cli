import { homedir } from "os";
import { join } from "path";
import { existsSync, readdirSync } from "fs";
import { readJsoncFile, parseServers, buildResult } from "./base.js";
import type { ClientScanResult, McpServer } from "../types.js";

function getPluginsDir(): string {
  return join(
    homedir(),
    ".claude",
    "plugins",
    "marketplaces",
    "claude-plugins-official",
    "external_plugins"
  );
}

export async function scanClaudePlugins(): Promise<ClientScanResult> {
  const pluginsDir = getPluginsDir();

  if (!existsSync(pluginsDir)) {
    return buildResult("Claude Plugins", pluginsDir, []);
  }

  const allServers: McpServer[] = [];

  try {
    const entries = readdirSync(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const mcpPath = join(pluginsDir, entry.name, ".mcp.json");
      if (!existsSync(mcpPath)) continue;

      try {
        const data = await readJsoncFile(mcpPath);
        if (!data || typeof data !== "object") continue;

        const root = data as Record<string, unknown>;

        // Some plugins wrap in mcpServers, others put servers at root
        let mcpServers: Record<string, Record<string, unknown>> | undefined;

        if (root.mcpServers) {
          mcpServers = root.mcpServers as Record<
            string,
            Record<string, unknown>
          >;
        } else {
          // Root-level format: each key is a server name with config as value
          // Check if any value looks like a server config (has type, url, or command)
          const maybeServers: Record<string, Record<string, unknown>> = {};
          for (const [key, val] of Object.entries(root)) {
            if (val && typeof val === "object" && !Array.isArray(val)) {
              const v = val as Record<string, unknown>;
              if (v.type || v.url || v.command) {
                maybeServers[key] = v;
              }
            }
          }
          if (Object.keys(maybeServers).length > 0) {
            mcpServers = maybeServers;
          }
        }

        const servers = parseServers(mcpServers);
        for (const server of servers) {
          if (!server.description) {
            server.description = `Plugin: ${entry.name}`;
          }
        }
        allServers.push(...servers);
      } catch {
        // Skip broken plugin configs
      }
    }

    return buildResult("Claude Plugins", pluginsDir, allServers);
  } catch (e) {
    return buildResult("Claude Plugins", pluginsDir, [], String(e));
  }
}
