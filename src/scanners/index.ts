import { scanClaudeCode } from "./claude-code.js";
import { scanClaudeDesktop } from "./claude-desktop.js";
import { scanClaudePlugins } from "./claude-plugins.js";
import { scanCursor } from "./cursor.js";
import { scanWindsurf } from "./windsurf.js";
import { scanVSCode } from "./vscode.js";
import type { ScanResult } from "../types.js";

export async function scanAll(): Promise<ScanResult> {
  const clients = await Promise.all([
    scanClaudeCode(),
    scanClaudeDesktop(),
    scanClaudePlugins(),
    scanCursor(),
    scanWindsurf(),
    scanVSCode(),
  ]);

  const totalServers = clients.reduce((sum, c) => sum + c.servers.length, 0);

  return {
    clients,
    totalServers,
    timestamp: new Date().toISOString(),
  };
}
