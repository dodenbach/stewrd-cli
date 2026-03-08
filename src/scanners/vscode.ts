import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { readJsoncFile, parseServers, buildResult } from "./base.js";
import type { ClientScanResult } from "../types.js";

function getConfigPaths(): string[] {
  const home = homedir();
  const paths: string[] = [];

  if (process.platform === "darwin") {
    paths.push(
      join(home, "Library", "Application Support", "Code", "User", "settings.json"),
      join(home, ".vscode", "mcp.json")
    );
  } else if (process.platform === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    paths.push(
      join(appData, "Code", "User", "settings.json"),
      join(home, ".vscode", "mcp.json")
    );
  } else {
    paths.push(
      join(home, ".config", "Code", "User", "settings.json"),
      join(home, ".vscode", "mcp.json")
    );
  }

  return paths;
}

export async function scanVSCode(): Promise<ClientScanResult> {
  const configPaths = getConfigPaths();

  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue;

    try {
      const data = await readJsoncFile(configPath);
      if (!data || typeof data !== "object") continue;

      const root = data as Record<string, unknown>;

      // VS Code nests MCP config under "mcp.servers" or "mcp" key in settings.json
      let mcpServers: Record<string, Record<string, unknown>> | undefined;

      if (root.mcpServers) {
        mcpServers = root.mcpServers as Record<string, Record<string, unknown>>;
      } else if (root.mcp && typeof root.mcp === "object") {
        const mcp = root.mcp as Record<string, unknown>;
        if (mcp.servers) {
          mcpServers = mcp.servers as Record<string, Record<string, unknown>>;
        }
      }

      if (mcpServers && Object.keys(mcpServers).length > 0) {
        return buildResult("VS Code", configPath, parseServers(mcpServers));
      }
    } catch {
      continue;
    }
  }

  return buildResult("VS Code", configPaths[0], []);
}
