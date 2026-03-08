import chalk from "chalk";
import { removeServerFromClient } from "../utils/config-writer.js";
import {
  getClientConfigPath,
  parseClientId,
  CLIENT_NAMES,
  ALL_CLIENT_IDS,
} from "../utils/client-paths.js";
import { readLockfile, writeLockfile, removeFromLockfile } from "../lockfile.js";

interface RemoveOptions {
  client?: string;
}

export async function remove(
  serverName: string,
  options: RemoveOptions
): Promise<void> {
  const targetClientId = parseClientId(options.client || "claude-code");
  if (!targetClientId) {
    console.error(
      chalk.red(
        `Unknown client: ${options.client}\nValid clients: ${ALL_CLIENT_IDS.join(", ")}`
      )
    );
    process.exit(1);
  }

  const configPath = getClientConfigPath(targetClientId);
  const result = await removeServerFromClient(
    targetClientId,
    serverName,
    configPath
  );

  if (result.success) {
    console.log(
      chalk.green(
        `  ✓ Removed ${chalk.bold(serverName)} from ${CLIENT_NAMES[targetClientId]}`
      )
    );
    console.log(chalk.dim(`    Backup saved to: ${configPath}.bak`));

    // Update lockfile
    try {
      const lockfile = await readLockfile();
      if (lockfile && lockfile.servers[serverName]) {
        removeFromLockfile(lockfile, serverName);
        await writeLockfile(lockfile);
      }
    } catch {
      // Best-effort
    }
  } else {
    console.error(chalk.red(`  ✗ ${result.message}`));
    process.exit(1);
  }
}
