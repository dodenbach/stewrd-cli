import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { readJsoncFile, parseServers, buildResult } from "./base.js";
import type { ClientScanResult } from "../types.js";

function getConfigPaths(): string[] {
  const home = homedir();
  const paths: string[] = [];

  // Cursor stores MCP config in its settings directory
  if (process.platform === "darwin") {
    paths.push(
      join(home, ".cursor", "mcp.json"),
      join(home, "Library", "Application Support", "Cursor", "User", "globalStorage", "mcp.json")
    );
  } else if (process.platform === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    paths.push(
      join(home, ".cursor", "mcp.json"),
      join(appData, "Cursor", "User", "globalStorage", "mcp.json")
    );
  } else {
    paths.push(
      join(home, ".cursor", "mcp.json"),
      join(home, ".config", "Cursor", "User", "globalStorage", "mcp.json")
    );
  }

  return paths;
}

export async function scanCursor(): Promise<ClientScanResult> {
  const configPaths = getConfigPaths();
  const configPath = configPaths.find((p) => existsSync(p)) || configPaths[0];

  try {
    const data = await readJsoncFile(configPath);
    if (!data || typeof data !== "object") {
      return buildResult("Cursor", configPath, []);
    }

    const root = data as Record<string, unknown>;
    const mcpServers = root.mcpServers as
      | Record<string, Record<string, unknown>>
      | undefined;

    return buildResult("Cursor", configPath, parseServers(mcpServers));
  } catch (e) {
    return buildResult("Cursor", configPath, [], String(e));
  }
}
