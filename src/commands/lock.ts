import chalk from "chalk";
import ora from "ora";
import { scanAll } from "../scanners/index.js";
import {
  readLockfile,
  writeLockfile,
  createLockfile,
  addToLockfile,
  checkDrift,
  hashServerConfig,
  findLockfilePath,
} from "../lockfile.js";
import type { McpServer } from "../types.js";

interface LockOptions {
  global?: boolean;
  check?: boolean;
}

export async function lock(options: LockOptions): Promise<void> {
  const lockPath = findLockfilePath(options.global ? "global" : "project");

  // --check mode: verify current configs match lockfile
  if (options.check) {
    await checkLockfile(lockPath);
    return;
  }

  // Default: generate/update lockfile from current configs
  await generateLockfile(lockPath);
}

async function generateLockfile(lockPath: string): Promise<void> {
  const spinner = ora("Scanning servers to generate lockfile...").start();
  const scanResult = await scanAll();
  spinner.stop();

  // Build unique server map
  const servers = new Map<string, McpServer>();
  for (const client of scanResult.clients) {
    for (const server of client.servers) {
      if (!servers.has(server.name)) {
        servers.set(server.name, server);
      }
    }
  }

  if (servers.size === 0) {
    console.log(chalk.dim("\n  No servers found. Nothing to lock.\n"));
    return;
  }

  // Load existing lockfile to preserve source metadata
  const existing = await readLockfile(lockPath);

  const lockfile = createLockfile();

  for (const [name, server] of servers) {
    // Preserve source from existing lockfile if available
    const source = existing?.servers[name]?.source || "manual";
    addToLockfile(lockfile, server, source);
  }

  const writtenPath = await writeLockfile(lockfile, lockPath);

  console.log(
    `\n  ${chalk.bold("stewrd lock")} ${chalk.dim("— lockfile generated")}\n`
  );
  console.log(
    chalk.green(
      `  ✓ Locked ${servers.size} server${servers.size === 1 ? "" : "s"}`
    )
  );
  console.log(chalk.dim(`  → ${writtenPath}`));
  console.log(
    chalk.dim("  Commit this file to share MCP configs with your team\n")
  );
}

async function checkLockfile(lockPath: string): Promise<void> {
  const lockfile = await readLockfile(lockPath);

  if (!lockfile) {
    console.log(
      chalk.yellow(
        "\n  No lockfile found. Run stewrd lock to generate one.\n"
      )
    );
    process.exit(1);
  }

  const spinner = ora("Checking configs against lockfile...").start();
  const scanResult = await scanAll();
  spinner.stop();

  // Build unique server map from current configs
  const current = new Map<string, McpServer>();
  for (const client of scanResult.clients) {
    for (const server of client.servers) {
      if (!current.has(server.name)) {
        current.set(server.name, server);
      }
    }
  }

  console.log(
    `\n  ${chalk.bold("stewrd lock --check")} ${chalk.dim("— verifying lockfile")}\n`
  );

  let drifted = 0;
  let missing = 0;
  let extra = 0;
  let ok = 0;

  // Check locked servers against current
  for (const [name, locked] of Object.entries(lockfile.servers)) {
    const live = current.get(name);

    if (!live) {
      console.log(
        chalk.yellow(`  ⚠ ${chalk.bold(name)} — missing from configs`)
      );
      missing++;
      continue;
    }

    const drift = checkDrift(live, locked);
    if (drift) {
      console.log(
        chalk.yellow(`  ⚠ ${chalk.bold(name)} — ${drift}`)
      );
      drifted++;
    } else {
      ok++;
    }
  }

  // Check for servers not in lockfile
  for (const [name] of current) {
    if (!lockfile.servers[name]) {
      console.log(
        chalk.cyan(`  + ${chalk.bold(name)} — not in lockfile`)
      );
      extra++;
    }
  }

  // Summary
  console.log(
    chalk.dim("\n  ─────────────────────────────────────────────────")
  );

  if (drifted === 0 && missing === 0 && extra === 0) {
    console.log(chalk.green("  ✓ All servers match lockfile"));
  } else {
    if (ok > 0) {
      console.log(chalk.green(`  ✓ ${ok} server${ok === 1 ? "" : "s"} match`));
    }
    if (drifted > 0) {
      console.log(
        chalk.yellow(
          `  ⚠ ${drifted} server${drifted === 1 ? "" : "s"} drifted`
        )
      );
    }
    if (missing > 0) {
      console.log(
        chalk.yellow(
          `  ⚠ ${missing} locked server${missing === 1 ? "" : "s"} missing`
        )
      );
    }
    if (extra > 0) {
      console.log(
        chalk.cyan(
          `  + ${extra} unlocked server${extra === 1 ? "" : "s"} (run stewrd lock to add)`
        )
      );
    }
    console.log(
      chalk.dim("  Run stewrd lock to update the lockfile")
    );
  }
  console.log("");

  if (drifted > 0 || missing > 0) {
    process.exit(1);
  }
}
