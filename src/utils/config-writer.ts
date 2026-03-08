import { readFile, writeFile, copyFile } from "fs/promises";
import { existsSync } from "fs";
import { dirname } from "path";
import { mkdir } from "fs/promises";
import * as jsonc from "jsonc-parser";
import type { McpServer } from "../types.js";

type ClientId =
  | "claude-code"
  | "claude-desktop"
  | "cursor"
  | "windsurf"
  | "vscode";

interface WriteResult {
  success: boolean;
  action: "added" | "exists" | "error";
  message: string;
}

function serverToConfig(
  server: McpServer
): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  if (server.url) {
    config.type = "http";
    config.url = server.url;
    if (server.oauth) {
      config.type = "http";
      config.oauth = server.oauth;
    }
  } else if (server.command) {
    if (server.transport === "stdio" || server.command !== "npx") {
      config.type = "stdio";
    }
    config.command = server.command;
    if (server.args) config.args = server.args;
  }

  if (server.env && Object.keys(server.env).length > 0) {
    config.env = server.env;
  }

  return config;
}

async function ensureDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function readOrCreateConfig(
  path: string
): Promise<Record<string, unknown>> {
  if (!existsSync(path)) {
    return {};
  }
  const content = await readFile(path, "utf-8");
  return (jsonc.parse(content) as Record<string, unknown>) || {};
}

async function backupAndWrite(
  path: string,
  data: Record<string, unknown>
): Promise<void> {
  await ensureDir(path);

  if (existsSync(path)) {
    await copyFile(path, path + ".bak");
  }

  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function addServerToClient(
  clientId: ClientId,
  server: McpServer,
  configPath: string
): Promise<WriteResult> {
  try {
    const config = await readOrCreateConfig(configPath);

    // All clients use mcpServers key (except VS Code which uses mcp.servers)
    if (clientId === "vscode") {
      const mcp = (config.mcp as Record<string, unknown>) || {};
      const servers =
        (mcp.servers as Record<string, Record<string, unknown>>) || {};

      if (servers[server.name]) {
        return {
          success: true,
          action: "exists",
          message: `${server.name} already configured`,
        };
      }

      servers[server.name] = serverToConfig(server);
      mcp.servers = servers;
      config.mcp = mcp;
    } else {
      const servers =
        (config.mcpServers as Record<string, Record<string, unknown>>) || {};

      if (servers[server.name]) {
        return {
          success: true,
          action: "exists",
          message: `${server.name} already configured`,
        };
      }

      servers[server.name] = serverToConfig(server);
      config.mcpServers = servers;
    }

    await backupAndWrite(configPath, config);

    return {
      success: true,
      action: "added",
      message: `Added ${server.name}`,
    };
  } catch (e) {
    return {
      success: false,
      action: "error",
      message: String(e),
    };
  }
}

export async function removeServerFromClient(
  clientId: ClientId,
  serverName: string,
  configPath: string
): Promise<WriteResult> {
  try {
    if (!existsSync(configPath)) {
      return {
        success: false,
        action: "error",
        message: "Config file not found",
      };
    }

    const config = await readOrCreateConfig(configPath);

    if (clientId === "vscode") {
      const mcp = (config.mcp as Record<string, unknown>) || {};
      const servers =
        (mcp.servers as Record<string, Record<string, unknown>>) || {};
      if (!servers[serverName]) {
        return {
          success: true,
          action: "exists",
          message: `${serverName} not found`,
        };
      }
      delete servers[serverName];
      mcp.servers = servers;
      config.mcp = mcp;
    } else {
      const servers =
        (config.mcpServers as Record<string, Record<string, unknown>>) || {};
      if (!servers[serverName]) {
        return {
          success: true,
          action: "exists",
          message: `${serverName} not found`,
        };
      }
      delete servers[serverName];
      config.mcpServers = servers;
    }

    await backupAndWrite(configPath, config);

    return {
      success: true,
      action: "added",
      message: `Removed ${serverName}`,
    };
  } catch (e) {
    return {
      success: false,
      action: "error",
      message: String(e),
    };
  }
}

export { type ClientId, type WriteResult };
