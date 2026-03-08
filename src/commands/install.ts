import chalk from "chalk";
import { REGISTRY } from "../registry/servers.js";
import { addServerToClient } from "../utils/config-writer.js";
import {
  getClientConfigPath,
  parseClientId,
  CLIENT_NAMES,
  ALL_CLIENT_IDS,
  type ClientId,
} from "../utils/client-paths.js";
import type { McpServer } from "../types.js";

interface InstallOptions {
  client?: string;
  all?: boolean;
}

function registryToMcpServer(
  entry: (typeof REGISTRY)[number]
): McpServer {
  const server: McpServer = {
    name: entry.name,
    transport: entry.transport,
    description: entry.description,
  };

  if (entry.transport === "http" && entry.url) {
    server.url = entry.url;
  } else if (entry.transport === "npx") {
    server.command = "npx";
    server.args = entry.args || ["-y", entry.package];
  } else if (entry.command) {
    server.command = entry.command;
    server.args = entry.args;
  }

  if (entry.env) {
    server.env = entry.env;
  }

  return server;
}

export async function install(
  serverName: string,
  options: InstallOptions
): Promise<void> {
  // Find in registry
  const entry = REGISTRY.find(
    (e) =>
      e.name.toLowerCase() === serverName.toLowerCase() ||
      e.package.toLowerCase() === serverName.toLowerCase()
  );

  if (!entry) {
    console.error(
      chalk.red(`\n  Server "${serverName}" not found in registry.`)
    );
    console.log(chalk.dim("  Run: stewrd search to browse available servers\n"));
    process.exit(1);
  }

  const server = registryToMcpServer(entry);
  const verified = entry.verified ? chalk.green(" (verified)") : "";

  console.log(
    `\n  Installing ${chalk.bold(entry.name)}${verified}`
  );
  console.log(chalk.dim(`  ${entry.description}\n`));

  // Determine target clients
  let targetClients: ClientId[];

  if (options.all) {
    targetClients = [...ALL_CLIENT_IDS];
  } else if (options.client) {
    const clientId = parseClientId(options.client);
    if (!clientId) {
      console.error(
        chalk.red(
          `  Unknown client: ${options.client}\n  Valid: ${ALL_CLIENT_IDS.join(", ")}`
        )
      );
      process.exit(1);
    }
    targetClients = [clientId];
  } else {
    // Default: claude-code
    targetClients = ["claude-code"];
  }

  let added = 0;
  let existed = 0;

  for (const clientId of targetClients) {
    const configPath = getClientConfigPath(clientId);
    const result = await addServerToClient(clientId, server, configPath);

    if (result.action === "added") {
      console.log(
        chalk.green(`  ✓ ${CLIENT_NAMES[clientId]}`)
      );
      added++;
    } else if (result.action === "exists") {
      console.log(
        chalk.dim(`  ○ ${CLIENT_NAMES[clientId]} (already configured)`)
      );
      existed++;
    } else {
      console.log(
        chalk.red(`  ✗ ${CLIENT_NAMES[clientId]}: ${result.message}`)
      );
    }
  }

  // Show env vars needed
  if (entry.env && Object.keys(entry.env).length > 0 && added > 0) {
    console.log(chalk.yellow("\n  Required environment variables:"));
    for (const [key, val] of Object.entries(entry.env)) {
      console.log(chalk.dim(`    export ${key}=your-value-here`));
    }
  }

  // Show repo link
  if (entry.repo && added > 0) {
    console.log(
      chalk.dim(`\n  Docs: https://github.com/${entry.repo}`)
    );
  }

  console.log("");
}
