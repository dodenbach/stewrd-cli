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
      join(home, ".codeium", "windsurf", "mcp_config.json"),
      join(home, ".windsurf", "mcp_config.json")
    );
  } else if (process.platform === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    paths.push(
      join(appData, "Windsurf", "mcp_config.json"),
      join(home, ".windsurf", "mcp_config.json")
    );
  } else {
    paths.push(
      join(home, ".codeium", "windsurf", "mcp_config.json"),
      join(home, ".windsurf", "mcp_config.json")
    );
  }

  return paths;
}

export async function scanWindsurf(): Promise<ClientScanResult> {
  const configPaths = getConfigPaths();
  const configPath = configPaths.find((p) => existsSync(p)) || configPaths[0];

  try {
    const data = await readJsoncFile(configPath);
    if (!data || typeof data !== "object") {
      return buildResult("Windsurf", configPath, []);
    }

    const root = data as Record<string, unknown>;
    const mcpServers = (root.mcpServers || root.servers) as
      | Record<string, Record<string, unknown>>
      | undefined;

    return buildResult("Windsurf", configPath, parseServers(mcpServers));
  } catch (e) {
    return buildResult("Windsurf", configPath, [], String(e));
  }
}
