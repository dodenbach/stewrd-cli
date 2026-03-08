import chalk from "chalk";
import { scanAll } from "../scanners/index.js";
import { addServerToClient } from "../utils/config-writer.js";
import {
  getClientConfigPath,
  parseClientId,
  CLIENT_NAMES,
  ALL_CLIENT_IDS,
} from "../utils/client-paths.js";
import type { McpServer } from "../types.js";

interface AddOptions {
  client?: string;
  transport?: string;
  command?: string;
  url?: string;
  args?: string;
  description?: string;
}

export async function add(serverName: string, options: AddOptions): Promise<void> {
  const targetClientId = parseClientId(options.client || "claude-code");
  if (!targetClientId) {
    console.error(
      chalk.red(
        `Unknown client: ${options.client}\nValid clients: ${ALL_CLIENT_IDS.join(", ")}`
      )
    );
    process.exit(1);
  }

  // Check if this server already exists somewhere on the machine
  const scanResult = await scanAll();
  let existingServer: McpServer | null = null;

  for (const client of scanResult.clients) {
    const found = client.servers.find((s) => s.name === serverName);
    if (found) {
      existingServer = found;
      break;
    }
  }

  let server: McpServer;

  if (existingServer) {
    // Copy from existing config
    server = { ...existingServer };
    console.log(
      chalk.dim(`  Found ${serverName} in existing config, copying...`)
    );
  } else if (options.url) {
    // HTTP server
    server = {
      name: serverName,
      transport: "http",
      url: options.url,
      description: options.description,
    };
  } else if (options.command) {
    // Custom command
    const args = options.args ? options.args.split(" ") : undefined;
    server = {
      name: serverName,
      transport: options.command === "npx" ? "npx" : "stdio",
      command: options.command,
      args,
      description: options.description,
    };
  } else {
    // Try as npm package (assume npx)
    server = {
      name: serverName,
      transport: "npx",
      command: "npx",
      args: ["-y", serverName],
      description: options.description,
    };
    console.log(
      chalk.dim(`  No --command or --url specified, assuming npx package`)
    );
  }

  const configPath = getClientConfigPath(targetClientId);
  const result = await addServerToClient(targetClientId, server, configPath);

  if (result.action === "exists") {
    console.log(
      chalk.yellow(`  ⚠ ${serverName} already configured in ${CLIENT_NAMES[targetClientId]}`)
    );
  } else if (result.success) {
    console.log(
      chalk.green(
        `  ✓ Added ${chalk.bold(serverName)} to ${CLIENT_NAMES[targetClientId]}`
      )
    );
    console.log(chalk.dim(`    Config: ${configPath}`));

    // Show env vars needed
    if (server.env && Object.keys(server.env).length > 0) {
      console.log("");
      console.log(chalk.yellow("  Required environment variables:"));
      for (const [key, val] of Object.entries(server.env)) {
        const masked = val.startsWith("${") ? val : "***";
        console.log(chalk.dim(`    export ${key}=${masked}`));
      }
    }
  } else {
    console.error(chalk.red(`  ✗ Failed: ${result.message}`));
    process.exit(1);
  }
}
