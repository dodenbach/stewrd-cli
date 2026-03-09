/**
 * MCP Security Audit Engine
 *
 * Deep security analysis of MCP server configurations.
 * Goes beyond stewrd doctor — this is the security product.
 */

import { existsSync } from "fs";
import { stat } from "fs/promises";
import type { McpServer, ClientScanResult } from "../types.js";
import {
  fetchThreatFeed,
  checkTyposquat,
  isTrustedPublisher,
  SUSPICIOUS_ENV_PATTERNS,
  HIGH_RISK_COMMANDS,
  TRUSTED_PUBLISHERS,
  type Severity,
  type ThreatFeed,
} from "./threat-feed.js";
import { extractVersion } from "../lockfile.js";

export interface AuditFinding {
  severity: Severity;
  category: string;
  server: string;
  client: string;
  title: string;
  description: string;
  recommendation?: string;
}

export interface AuditReport {
  timestamp: string;
  serversScanned: number;
  clientsScanned: number;
  findings: AuditFinding[];
  score: number; // 0-100, higher is better
  threatFeedVersion: string;
}

/**
 * Run a full security audit on all discovered MCP servers.
 */
export async function runAudit(
  clients: ClientScanResult[]
): Promise<AuditReport> {
  const threatFeed = await fetchThreatFeed();
  const findings: AuditFinding[] = [];
  const seen = new Set<string>();
  let totalServers = 0;

  for (const client of clients) {
    for (const server of client.servers) {
      totalServers++;
      const key = `${server.name}:${client.client}`;
      if (seen.has(key)) continue;
      seen.add(key);

      findings.push(...auditServer(server, client, threatFeed));
    }
  }

  // Cross-client analysis
  findings.push(...auditCrossClient(clients));

  // Calculate score
  const score = calculateScore(findings, totalServers);

  return {
    timestamp: new Date().toISOString(),
    serversScanned: totalServers,
    clientsScanned: clients.filter((c) => c.exists).length,
    findings: findings.sort(
      (a, b) => severityWeight(b.severity) - severityWeight(a.severity)
    ),
    score,
    threatFeedVersion: threatFeed.updatedAt,
  };
}

function severityWeight(s: Severity): number {
  switch (s) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function calculateScore(findings: AuditFinding[], totalServers: number): number {
  if (totalServers === 0) return 100;

  let deductions = 0;
  for (const f of findings) {
    switch (f.severity) {
      case "critical":
        deductions += 20;
        break;
      case "high":
        deductions += 8;
        break;
      case "medium":
        deductions += 3;
        break;
      case "low":
        deductions += 1;
        break;
    }
  }

  // Scale deductions relative to number of servers
  // A single issue on 20 servers shouldn't tank the score as hard
  const scaledDeductions = Math.min(deductions, 100);
  return Math.max(0, 100 - scaledDeductions);
}

/**
 * Audit a single server across all security dimensions.
 */
function auditServer(
  server: McpServer,
  client: ClientScanResult,
  threatFeed: ThreatFeed
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // 1. Threat feed check
  findings.push(...checkThreatFeed(server, client, threatFeed));

  // 2. Supply chain checks
  findings.push(...checkSupplyChain(server, client));

  // 3. Permission analysis
  findings.push(...checkPermissions(server, client));

  // 4. Transport security
  findings.push(...checkTransportSecurity(server, client));

  // 5. Binary verification
  findings.push(...checkBinaryIntegrity(server, client));

  return findings;
}

/**
 * Check server against known threat database.
 */
function checkThreatFeed(
  server: McpServer,
  client: ClientScanResult,
  threatFeed: ThreatFeed
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const threat of threatFeed.entries) {
    // Match by name (exact or wildcard)
    if (threat.name !== "*" && threat.name !== server.name) continue;

    // For wildcard entries, check if the condition applies
    if (threat.name === "*") {
      // General vulnerability — check if server matches the pattern
      if (
        threat.description.includes("-y flag") &&
        server.args?.includes("-y")
      ) {
        // Already covered by supply chain checks
        continue;
      }
    }

    findings.push({
      severity: threat.severity,
      category: "threat-feed",
      server: server.name,
      client: client.client,
      title: `Known threat: ${threat.type}`,
      description: threat.description,
      recommendation: threat.reference
        ? `See: ${threat.reference}`
        : undefined,
    });
  }

  return findings;
}

/**
 * Supply chain security checks.
 */
function checkSupplyChain(
  server: McpServer,
  client: ClientScanResult
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const pkg = getPackageName(server);

  if (!pkg) return findings;

  // Typosquat detection
  const typosquat = checkTyposquat(pkg);
  if (typosquat) {
    findings.push({
      severity: "critical",
      category: "supply-chain",
      server: server.name,
      client: client.client,
      title: "Possible typosquat package",
      description: typosquat,
      recommendation: `Verify you intended to install "${pkg}" and not the official package`,
    });
  }

  // Untrusted publisher
  if (server.transport === "npx" && !isTrustedPublisher(pkg)) {
    findings.push({
      severity: "low",
      category: "supply-chain",
      server: server.name,
      client: client.client,
      title: "Unverified publisher",
      description: `Package "${pkg}" is not from a known trusted publisher`,
      recommendation:
        "Review the package source and maintainer before trusting with system access",
    });
  }

  // Unpinned version
  const version = extractVersion(server);
  if (version === "latest" && server.transport === "npx") {
    findings.push({
      severity: "high",
      category: "supply-chain",
      server: server.name,
      client: client.client,
      title: "Unpinned package version",
      description: `Running "${pkg}" at latest — a compromised update auto-installs on next use`,
      recommendation: `Pin to a specific version: ${pkg}@<version>`,
    });
  }

  // Auto-install flag
  if (server.args?.includes("-y") || server.args?.includes("--yes")) {
    findings.push({
      severity: "medium",
      category: "supply-chain",
      server: server.name,
      client: client.client,
      title: "Auto-install enabled",
      description:
        "The -y flag bypasses npm install confirmation — packages install without user approval",
      recommendation:
        "Pin versions and verify packages before enabling auto-install",
    });
  }

  return findings;
}

/**
 * Permission and env var analysis.
 */
function checkPermissions(
  server: McpServer,
  client: ClientScanResult
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (!server.env) return findings;

  // Check for suspicious env var access
  for (const key of Object.keys(server.env)) {
    for (const pattern of SUSPICIOUS_ENV_PATTERNS) {
      if (pattern.test(key)) {
        findings.push({
          severity: "high",
          category: "permissions",
          server: server.name,
          client: client.client,
          title: "Suspicious environment variable access",
          description: `Server requests access to ${key} — this is unusual for MCP servers`,
          recommendation: `Verify the server needs ${key} and review its source code`,
        });
        break;
      }
    }

    // Plaintext secrets
    const val = server.env[key];
    if (
      val &&
      !val.startsWith("${") &&
      val.length > 8 &&
      (key.toLowerCase().includes("token") ||
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("password"))
    ) {
      findings.push({
        severity: "critical",
        category: "permissions",
        server: server.name,
        client: client.client,
        title: "Plaintext secret in config",
        description: `${key} contains a plaintext value — visible to anyone with file access`,
        recommendation: `Use environment variable reference: \${${key}}`,
      });
    }
  }

  // Cross-provider key access
  const envKeys = Object.keys(server.env);
  const hasMultipleProviderKeys = envKeys.filter(
    (k) =>
      k.includes("API_KEY") || k.includes("TOKEN") || k.includes("SECRET")
  );
  if (hasMultipleProviderKeys.length > 3) {
    findings.push({
      severity: "medium",
      category: "permissions",
      server: server.name,
      client: client.client,
      title: "Excessive credential access",
      description: `Server requests ${hasMultipleProviderKeys.length} credential env vars — unusually broad access`,
      recommendation: "Verify the server needs all these credentials",
    });
  }

  return findings;
}

/**
 * Transport and network security checks.
 */
function checkTransportSecurity(
  server: McpServer,
  client: ClientScanResult
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // HTTP without auth on remote server
  if (server.transport === "http" && server.url) {
    if (server.url.startsWith("http://") && !server.url.includes("localhost") && !server.url.includes("127.0.0.1")) {
      findings.push({
        severity: "critical",
        category: "transport",
        server: server.name,
        client: client.client,
        title: "Unencrypted HTTP connection",
        description: `Server uses http:// (not https://) — traffic is unencrypted and interceptable`,
        recommendation: "Switch to HTTPS or use localhost only",
      });
    }

    // Skip auth check for Claude Plugins — auth is managed by the platform
    const isPlugin = client.client === "Claude Plugins";
    if (
      !isPlugin &&
      !server.oauth &&
      !server.env &&
      !server.url.includes("localhost") &&
      !server.url.includes("127.0.0.1")
    ) {
      findings.push({
        severity: "medium",
        category: "transport",
        server: server.name,
        client: client.client,
        title: "Remote server without visible authentication",
        description:
          "HTTP server has no OAuth config or auth env vars — may accept unauthenticated requests",
        recommendation: "Verify the server requires authentication",
      });
    }
  }

  return findings;
}

/**
 * Binary and command verification.
 */
function checkBinaryIntegrity(
  server: McpServer,
  client: ClientScanResult
): AuditFinding[] {
  const findings: AuditFinding[] = [];

  if (!server.command) return findings;

  // High-risk shell commands
  const cmd = server.command.split("/").pop() || server.command;
  if (HIGH_RISK_COMMANDS.includes(cmd)) {
    findings.push({
      severity: "critical",
      category: "binary",
      server: server.name,
      client: client.client,
      title: "Shell interpreter as MCP server",
      description: `Server runs "${server.command}" — a shell interpreter with arbitrary code execution`,
      recommendation:
        "MCP servers should be specific binaries, not shell interpreters",
    });
  }

  // Binary outside standard paths
  if (server.command.startsWith("/") && !server.command.includes("node_modules")) {
    const isInStandardPath =
      server.command.startsWith("/usr/") ||
      server.command.startsWith("/opt/") ||
      server.command.startsWith("/Applications/");

    if (!isInStandardPath) {
      findings.push({
        severity: "high",
        category: "binary",
        server: server.name,
        client: client.client,
        title: "Binary in non-standard location",
        description: `Executable at ${server.command} — not in /usr, /opt, or /Applications`,
        recommendation:
          "Verify the binary source, check its signature, and confirm its integrity",
      });
    }

    // Check if binary exists
    if (!existsSync(server.command)) {
      findings.push({
        severity: "medium",
        category: "binary",
        server: server.name,
        client: client.client,
        title: "Binary not found",
        description: `Executable at ${server.command} does not exist`,
        recommendation: "The server may fail to start — verify the path",
      });
    }
  }

  return findings;
}

/**
 * Cross-client analysis — look for inconsistencies.
 */
function auditCrossClient(clients: ClientScanResult[]): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Check for same server name with different configs across clients
  const serverConfigs = new Map<string, { config: string; client: string }[]>();

  for (const client of clients) {
    for (const server of client.servers) {
      const configKey = JSON.stringify({
        command: server.command,
        args: server.args,
        url: server.url,
      });

      if (!serverConfigs.has(server.name)) {
        serverConfigs.set(server.name, []);
      }
      serverConfigs.get(server.name)!.push({
        config: configKey,
        client: client.client,
      });
    }
  }

  for (const [name, configs] of serverConfigs) {
    const uniqueConfigs = new Set(configs.map((c) => c.config));
    if (uniqueConfigs.size > 1) {
      const clientList = configs.map((c) => c.client).join(", ");
      findings.push({
        severity: "medium",
        category: "consistency",
        server: name,
        client: clientList,
        title: "Inconsistent server configs across clients",
        description: `"${name}" has ${uniqueConfigs.size} different configurations across clients`,
        recommendation:
          "Use stewrd sync to standardize configs, then stewrd lock to pin them",
      });
    }
  }

  return findings;
}

/**
 * Extract the npm package name from a server config.
 */
function getPackageName(server: McpServer): string | null {
  if (server.transport !== "npx" || !server.args) return null;

  for (const arg of server.args) {
    if (arg.startsWith("-")) continue;
    // Strip version suffix for package name
    return arg.replace(/@[\d.].*$/, "");
  }

  return null;
}
