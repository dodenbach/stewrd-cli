import chalk from "chalk";
import ora from "ora";
import { existsSync } from "fs";
import { scanAll } from "../scanners/index.js";
import { addServerToClient } from "../utils/config-writer.js";
import {
  getClientConfigPath,
  CLIENT_NAMES,
  ALL_CLIENT_IDS,
  type ClientId,
} from "../utils/client-paths.js";
import type { McpServer } from "../types.js";

// HTTP-only servers can't be used in all clients
// stdio and npx work everywhere
function isCompatible(server: McpServer, _clientId: ClientId): boolean {
  // All transports work in all clients for now
  // Could add restrictions later (e.g., some clients don't support HTTP)
  return true;
}

interface SyncOptions {
  dryRun?: boolean;
}

export async function sync(options: SyncOptions): Promise<void> {
  const spinner = ora("Scanning all clients...").start();
  const scanResult = await scanAll();
  spinner.stop();

  // Build the master server list (union of all servers across clients)
  const masterServers = new Map<string, McpServer>();
  const serverSources = new Map<string, string[]>();

  for (const client of scanResult.clients) {
    for (const server of client.servers) {
      if (!masterServers.has(server.name)) {
        masterServers.set(server.name, server);
        serverSources.set(server.name, [client.client]);
      } else {
        serverSources.get(server.name)!.push(client.client);
      }
    }
  }

  if (masterServers.size === 0) {
    console.log(chalk.dim("\n  No MCP servers found. Nothing to sync.\n"));
    return;
  }

  console.log(
    `\n  ${chalk.bold("stewrd sync")} ${chalk.dim("— syncing MCP servers across clients")}\n`
  );
  console.log(
    chalk.dim(
      `  Found ${masterServers.size} unique server${masterServers.size === 1 ? "" : "s"} to sync\n`
    )
  );

  // Only sync to writable clients (not plugins — those are managed by Claude)
  const writableClients: ClientId[] = [
    "claude-code",
    "claude-desktop",
    "cursor",
    "windsurf",
    "vscode",
  ];

  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const clientId of writableClients) {
    const configPath = getClientConfigPath(clientId);
    const clientName = CLIENT_NAMES[clientId];

    // Find which servers this client is missing
    const existingClient = scanResult.clients.find(
      (c) => c.client === clientName
    );
    const existingNames = new Set(
      existingClient?.servers.map((s) => s.name) || []
    );

    const missing: McpServer[] = [];
    for (const [name, server] of masterServers) {
      if (!existingNames.has(name) && isCompatible(server, clientId)) {
        missing.push(server);
      }
    }

    if (missing.length === 0) continue;

    console.log(`  ${chalk.bold(clientName)} ${chalk.dim(`(${configPath})`)}`);

    for (const server of missing) {
      const sources = serverSources.get(server.name)!;
      const sourceLabel = chalk.dim(`← ${sources[0]}`);

      if (options.dryRun) {
        console.log(
          chalk.cyan(`    would add ${chalk.bold(server.name)} ${sourceLabel}`)
        );
        skipped++;
        continue;
      }

      const result = await addServerToClient(clientId, server, configPath);

      if (result.action === "added") {
        console.log(
          chalk.green(`    ✓ ${chalk.bold(server.name)} ${sourceLabel}`)
        );
        added++;
      } else if (result.action === "exists") {
        skipped++;
      } else {
        console.log(
          chalk.red(`    ✗ ${server.name}: ${result.message}`)
        );
        errors++;
      }
    }
    console.log("");
  }

  // Summary
  console.log(chalk.dim("  ─────────────────────────────────────────────────"));
  if (options.dryRun) {
    console.log(
      chalk.cyan(
        `  Dry run: ${skipped} server${skipped === 1 ? "" : "s"} would be synced`
      )
    );
    console.log(chalk.dim("  Run without --dry-run to apply changes"));
  } else if (added === 0 && errors === 0) {
    console.log(chalk.green("  All clients are already in sync!"));
  } else {
    if (added > 0) {
      console.log(
        chalk.green(`  ✓ Synced ${added} server${added === 1 ? "" : "s"}`)
      );
    }
    if (errors > 0) {
      console.log(chalk.red(`  ✗ ${errors} error${errors === 1 ? "" : "s"}`));
    }
    console.log(chalk.dim("  Backups saved as .bak files"));
  }
  console.log("");
}
