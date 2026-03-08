import { homedir } from "os";
import { join } from "path";
import type { ClientId } from "./config-writer.js";

export function getClientConfigPath(clientId: ClientId): string {
  const home = homedir();

  switch (clientId) {
    case "claude-code":
      return join(home, ".claude", ".mcp.json");

    case "claude-desktop":
      if (process.platform === "darwin") {
        return join(
          home,
          "Library",
          "Application Support",
          "Claude",
          "claude_desktop_config.json"
        );
      }
      if (process.platform === "win32") {
        return join(
          process.env.APPDATA || join(home, "AppData", "Roaming"),
          "Claude",
          "claude_desktop_config.json"
        );
      }
      return join(home, ".config", "claude", "claude_desktop_config.json");

    case "cursor":
      return join(home, ".cursor", "mcp.json");

    case "windsurf":
      if (process.platform === "darwin") {
        return join(home, ".codeium", "windsurf", "mcp_config.json");
      }
      return join(home, ".windsurf", "mcp_config.json");

    case "vscode":
      if (process.platform === "darwin") {
        return join(
          home,
          "Library",
          "Application Support",
          "Code",
          "User",
          "settings.json"
        );
      }
      if (process.platform === "win32") {
        return join(
          process.env.APPDATA || join(home, "AppData", "Roaming"),
          "Code",
          "User",
          "settings.json"
        );
      }
      return join(home, ".config", "Code", "User", "settings.json");
  }
}

export const CLIENT_NAMES: Record<ClientId, string> = {
  "claude-code": "Claude Code",
  "claude-desktop": "Claude Desktop",
  cursor: "Cursor",
  windsurf: "Windsurf",
  vscode: "VS Code",
};

export const ALL_CLIENT_IDS: ClientId[] = [
  "claude-code",
  "claude-desktop",
  "cursor",
  "windsurf",
  "vscode",
];

export function parseClientId(input: string): ClientId | null {
  const normalized = input.toLowerCase().replace(/\s+/g, "-");
  const aliases: Record<string, ClientId> = {
    "claude-code": "claude-code",
    claude: "claude-code",
    cc: "claude-code",
    "claude-desktop": "claude-desktop",
    desktop: "claude-desktop",
    cd: "claude-desktop",
    cursor: "cursor",
    windsurf: "windsurf",
    vscode: "vscode",
    "vs-code": "vscode",
    code: "vscode",
  };
  return aliases[normalized] || null;
}
