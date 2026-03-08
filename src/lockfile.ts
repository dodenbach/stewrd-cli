/**
 * stewrd.lock — Lockfile for reproducible MCP server configurations.
 *
 * Like package-lock.json but for MCP servers. Records exact versions,
 * transport configs, and registry sources so teams get identical setups.
 *
 * File format: JSON at .stewrd/lock.json (project) or ~/.stewrd/lock.json (global)
 */

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { mkdir } from "fs/promises";
import { createHash } from "crypto";
import type { McpServer, Transport } from "./types.js";

export interface LockedServer {
  name: string;
  version: string;
  transport: Transport;
  source: "curated" | "official" | "manual";
  integrity: string; // sha256 hash of config
  command?: string;
  args?: string[];
  url?: string;
  env?: string[]; // env var names only (not values — those are secrets)
  lockedAt: string;
}

export interface Lockfile {
  lockfileVersion: 1;
  generatedAt: string;
  generatedBy: string;
  servers: Record<string, LockedServer>;
}

/**
 * Compute a deterministic hash of a server config.
 * Used to detect drift between lockfile and actual configs.
 */
export function hashServerConfig(server: McpServer): string {
  const canonical = JSON.stringify({
    transport: server.transport,
    command: server.command || null,
    args: server.args || [],
    url: server.url || null,
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/**
 * Extract version from server args (e.g., "-y @package@1.2.3" → "1.2.3")
 */
export function extractVersion(server: McpServer): string {
  if (server.args) {
    for (const arg of server.args) {
      // Match @scope/package@version or package@version
      const match = arg.match(/@(\d+\.\d+[\w.-]*)/);
      if (match) return match[1];
    }
    // Check for -y package (unpinned)
    for (const arg of server.args) {
      if (arg.startsWith("-")) continue;
      if (!arg.includes("@") || arg.startsWith("@")) {
        // No version pinned
        return "latest";
      }
    }
  }
  if (server.url) return "remote";
  return "unknown";
}

/**
 * Create a LockedServer entry from an McpServer + metadata.
 */
export function lockServer(
  server: McpServer,
  source: LockedServer["source"]
): LockedServer {
  const locked: LockedServer = {
    name: server.name,
    version: extractVersion(server),
    transport: server.transport,
    source,
    integrity: hashServerConfig(server),
    lockedAt: new Date().toISOString(),
  };

  if (server.command) locked.command = server.command;
  if (server.args) locked.args = server.args;
  if (server.url) locked.url = server.url;
  if (server.env) locked.env = Object.keys(server.env);

  return locked;
}

/**
 * Find the lockfile path. Checks:
 * 1. .stewrd/lock.json in current directory (project-level)
 * 2. ~/.stewrd/lock.json (global fallback)
 */
export function findLockfilePath(mode: "project" | "global" = "project"): string {
  if (mode === "global") {
    const home = process.env.HOME || process.env.USERPROFILE || "~";
    return resolve(home, ".stewrd", "lock.json");
  }
  return resolve(process.cwd(), ".stewrd", "lock.json");
}

/**
 * Read the lockfile from disk. Returns null if not found.
 */
export async function readLockfile(
  path?: string
): Promise<Lockfile | null> {
  const lockPath = path || findLockfilePath();

  if (!existsSync(lockPath)) {
    // Try global fallback
    const globalPath = findLockfilePath("global");
    if (lockPath !== globalPath && existsSync(globalPath)) {
      const content = await readFile(globalPath, "utf-8");
      return JSON.parse(content) as Lockfile;
    }
    return null;
  }

  const content = await readFile(lockPath, "utf-8");
  return JSON.parse(content) as Lockfile;
}

/**
 * Write the lockfile to disk.
 */
export async function writeLockfile(
  lockfile: Lockfile,
  path?: string
): Promise<string> {
  const lockPath = path || findLockfilePath();
  const dir = dirname(lockPath);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(
    lockPath,
    JSON.stringify(lockfile, null, 2) + "\n",
    "utf-8"
  );

  return lockPath;
}

/**
 * Create an empty lockfile.
 */
export function createLockfile(): Lockfile {
  return {
    lockfileVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: `stewrd@0.2.0`,
    servers: {},
  };
}

/**
 * Add or update a server in a lockfile.
 */
export function addToLockfile(
  lockfile: Lockfile,
  server: McpServer,
  source: LockedServer["source"]
): Lockfile {
  lockfile.servers[server.name] = lockServer(server, source);
  lockfile.generatedAt = new Date().toISOString();
  return lockfile;
}

/**
 * Remove a server from a lockfile.
 */
export function removeFromLockfile(
  lockfile: Lockfile,
  serverName: string
): Lockfile {
  delete lockfile.servers[serverName];
  lockfile.generatedAt = new Date().toISOString();
  return lockfile;
}

/**
 * Compare a live McpServer against its locked entry.
 * Returns null if they match, or a description of the drift.
 */
export function checkDrift(
  server: McpServer,
  locked: LockedServer
): string | null {
  const currentHash = hashServerConfig(server);
  if (currentHash !== locked.integrity) {
    return `config changed (locked: ${locked.integrity}, current: ${currentHash})`;
  }

  const currentVersion = extractVersion(server);
  if (currentVersion !== locked.version && locked.version !== "latest") {
    return `version drift (locked: ${locked.version}, current: ${currentVersion})`;
  }

  return null;
}
