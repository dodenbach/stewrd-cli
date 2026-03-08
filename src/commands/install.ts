import chalk from "chalk";
import ora from "ora";
import {
  searchOfficialRegistry,
  getServerFromRegistry,
  registryEntryToMcpServer,
  formatRegistryEntry,
} from "../registry/mcp-registry.js";
import { REGISTRY as LOCAL_REGISTRY } from "../registry/servers.js";
import { addServerToClient } from "../utils/config-writer.js";
import {
  getClientConfigPath,
  parseClientId,
  CLIENT_NAMES,
  ALL_CLIENT_IDS,
  type ClientId,
} from "../utils/client-paths.js";
import type { McpServer } from "../types.js";
import {
  readLockfile,
  writeLockfile,
  createLockfile,
  addToLockfile,
  type LockedServer,
} from "../lockfile.js";

interface InstallOptions {
  client?: string;
  all?: boolean;
}

function localRegistryToMcpServer(
  entry: (typeof LOCAL_REGISTRY)[number]
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
  // First check local curated registry (fast, no network)
  const localEntry = LOCAL_REGISTRY.find(
    (e) =>
      e.name.toLowerCase() === serverName.toLowerCase() ||
      e.package.toLowerCase() === serverName.toLowerCase()
  );

  let server: McpServer | null = null;
  let source = "local";

  if (localEntry) {
    server = localRegistryToMcpServer(localEntry);
    source = "curated";
  } else {
    // Search the official MCP registry
    const spinner = ora(
      `Searching official MCP registry for "${serverName}"...`
    ).start();

    try {
      // Try exact name match first
      let entry = await getServerFromRegistry(serverName);

      // If not found, try searching
      if (!entry) {
        const results = await searchOfficialRegistry(serverName, 5);
        if (results.servers.length > 0) {
          // Take the first result
          entry = results.servers[0];
          const info = formatRegistryEntry(entry);
          spinner.stop();
          console.log(
            chalk.dim(`\n  No exact match. Using closest: ${info.name}`)
          );
        }
      }

      if (entry) {
        spinner.stop();
        server = registryEntryToMcpServer(entry);
        source = "official";

        if (!server) {
          console.error(
            chalk.red(
              `\n  Found "${serverName}" in registry but couldn't parse its config.`
            )
          );
          console.log(
            chalk.dim(
              "  This server may use an unsupported transport type.\n"
            )
          );
          process.exit(1);
        }
      } else {
        spinner.stop();
        console.error(
          chalk.red(`\n  Server "${serverName}" not found.`)
        );
        console.log(chalk.dim("  Try: stewrd search <query>"));
        console.log(
          chalk.dim(
            "  Browse: https://registry.modelcontextprotocol.io\n"
          )
        );
        process.exit(1);
      }
    } catch (e) {
      spinner.fail(`Registry lookup failed: ${e}`);
      console.log(
        chalk.dim(
          "\n  Tip: check your internet connection or try stewrd add for manual config\n"
        )
      );
      process.exit(1);
    }
  }

  if (!server) {
    process.exit(1);
    return;
  }

  const sourceLabel =
    source === "curated"
      ? chalk.dim(" (curated)")
      : chalk.dim(" (official registry)");

  console.log(
    `\n  Installing ${chalk.bold(server.name)}${sourceLabel}`
  );
  if (server.description) {
    console.log(chalk.dim(`  ${server.description}\n`));
  }

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
    targetClients = ["claude-code"];
  }

  let added = 0;

  for (const clientId of targetClients) {
    const configPath = getClientConfigPath(clientId);
    const result = await addServerToClient(clientId, server, configPath);

    if (result.action === "added") {
      console.log(chalk.green(`  ✓ ${CLIENT_NAMES[clientId]}`));
      added++;
    } else if (result.action === "exists") {
      console.log(
        chalk.dim(`  ○ ${CLIENT_NAMES[clientId]} (already configured)`)
      );
    } else {
      console.log(
        chalk.red(`  ✗ ${CLIENT_NAMES[clientId]}: ${result.message}`)
      );
    }
  }

  // Update lockfile
  if (added > 0) {
    try {
      const lockfile = (await readLockfile()) || createLockfile();
      const lockSource: LockedServer["source"] =
        source === "curated" ? "curated" : "official";
      addToLockfile(lockfile, server, lockSource);
      await writeLockfile(lockfile);
    } catch {
      // Lockfile update is best-effort, don't fail the install
    }
  }

  // Show env vars needed
  if (server.env && Object.keys(server.env).length > 0 && added > 0) {
    console.log(chalk.yellow("\n  Required environment variables:"));
    for (const key of Object.keys(server.env)) {
      console.log(chalk.dim(`    export ${key}=your-value-here`));
    }
  }

  console.log("");
}
