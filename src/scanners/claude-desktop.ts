import { homedir } from "os";
import { join } from "path";
import { readJsoncFile, parseServers, buildResult } from "./base.js";
import type { ClientScanResult } from "../types.js";

function getConfigPath(): string {
  if (process.platform === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json"
    );
  }
  if (process.platform === "win32") {
    return join(
      process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
      "Claude",
      "claude_desktop_config.json"
    );
  }
  // Linux
  return join(
    homedir(),
    ".config",
    "claude",
    "claude_desktop_config.json"
  );
}

export async function scanClaudeDesktop(): Promise<ClientScanResult> {
  const configPath = getConfigPath();
  try {
    const data = await readJsoncFile(configPath);
    if (!data || typeof data !== "object") {
      return buildResult("Claude Desktop", configPath, []);
    }

    const root = data as Record<string, unknown>;
    const mcpServers = root.mcpServers as
      | Record<string, Record<string, unknown>>
      | undefined;

    return buildResult(
      "Claude Desktop",
      configPath,
      parseServers(mcpServers)
    );
  } catch (e) {
    return buildResult("Claude Desktop", configPath, [], String(e));
  }
}
