import chalk from "chalk";
import ora from "ora";
import { scanAll } from "../scanners/index.js";
import type { McpServer, ClientScanResult } from "../types.js";

interface Issue {
  severity: "warn" | "info";
  server: string;
  client: string;
  message: string;
  fix?: string;
}

function checkServer(
  server: McpServer,
  client: ClientScanResult
): Issue[] {
  const issues: Issue[] = [];

  // Check for unpinned npx versions
  if (server.transport === "npx" && server.args) {
    const pkg = server.args.find((a) => !a.startsWith("-"));
    if (pkg && !pkg.includes("@") && !pkg.endsWith("@latest")) {
      issues.push({
        severity: "warn",
        server: server.name,
        client: client.client,
        message: "Unpinned npm package version",
        fix: `stewrd add ${server.name} --command npx --args "-y ${pkg}@<version>"`,
      });
    }
    // Check for -y flag (auto-install)
    if (server.args.includes("-y") || server.args.includes("--yes")) {
      issues.push({
        severity: "info",
        server: server.name,
        client: client.client,
        message:
          "Auto-install enabled (-y flag) — packages install without confirmation",
      });
    }
  }

  // Check for binary executables (not from npm)
  if (server.transport === "stdio" && server.command) {
    if (
      server.command.startsWith("/") &&
      !server.command.includes("node_modules")
    ) {
      issues.push({
        severity: "warn",
        server: server.name,
        client: client.client,
        message: `Direct binary executable: ${server.command}`,
        fix: "Verify the binary source and integrity",
      });
    }
  }

  // Check for plaintext tokens in env
  if (server.env) {
    for (const [key, val] of Object.entries(server.env)) {
      if (
        !val.startsWith("${") &&
        (key.toLowerCase().includes("token") ||
          key.toLowerCase().includes("secret") ||
          key.toLowerCase().includes("key") ||
          key.toLowerCase().includes("password"))
      ) {
        issues.push({
          severity: "warn",
          server: server.name,
          client: client.client,
          message: `Plaintext secret in env: ${key}`,
          fix: `Use environment variable reference: \${${key}}`,
        });
      }
    }
  }

  // Check for HTTP without auth
  if (server.transport === "http" && server.url) {
    if (
      !server.env &&
      !server.oauth &&
      !server.url.includes("localhost") &&
      !server.url.includes("127.0.0.1")
    ) {
      issues.push({
        severity: "info",
        server: server.name,
        client: client.client,
        message: "HTTP server with no visible auth configuration",
      });
    }
  }

  return issues;
}

export async function doctor(): Promise<void> {
  const spinner = ora("Running health check...").start();
  const scanResult = await scanAll();
  spinner.stop();

  const allIssues: Issue[] = [];

  for (const client of scanResult.clients) {
    for (const server of client.servers) {
      allIssues.push(...checkServer(server, client));
    }
  }

  // Check for servers only in one client (sync opportunity)
  const serverClients = new Map<string, string[]>();
  for (const client of scanResult.clients) {
    for (const server of client.servers) {
      if (!serverClients.has(server.name)) {
        serverClients.set(server.name, []);
      }
      serverClients.get(server.name)!.push(client.client);
    }
  }

  const activeClients = scanResult.clients.filter(
    (c) => c.exists
  ).length;

  for (const [name, clients] of serverClients) {
    if (clients.length === 1 && activeClients > 1) {
      allIssues.push({
        severity: "info",
        server: name,
        client: clients[0],
        message: `Only configured in ${clients[0]} — missing from ${activeClients - 1} other client${activeClients > 2 ? "s" : ""}`,
        fix: `stewrd sync`,
      });
    }
  }

  console.log(
    `\n  ${chalk.bold("stewrd doctor")} ${chalk.dim("— MCP health check")}\n`
  );

  const warnings = allIssues.filter((i) => i.severity === "warn");
  const infos = allIssues.filter((i) => i.severity === "info");

  if (warnings.length > 0) {
    console.log(chalk.yellow(`  ⚠ WARNINGS (${warnings.length})`));
    for (const issue of warnings) {
      console.log(
        `    ${chalk.yellow("⚠")} ${chalk.bold(issue.server)} ${chalk.dim(`(${issue.client})`)}`
      );
      console.log(`      ${issue.message}`);
      if (issue.fix) {
        console.log(chalk.dim(`      Fix: ${issue.fix}`));
      }
    }
    console.log("");
  }

  if (infos.length > 0) {
    console.log(chalk.blue(`  ℹ INFO (${infos.length})`));
    for (const issue of infos) {
      console.log(
        `    ${chalk.blue("ℹ")} ${chalk.bold(issue.server)} ${chalk.dim(`(${issue.client})`)}`
      );
      console.log(`      ${issue.message}`);
      if (issue.fix) {
        console.log(chalk.dim(`      Fix: ${issue.fix}`));
      }
    }
    console.log("");
  }

  if (allIssues.length === 0) {
    console.log(chalk.green("  ✓ All MCP servers look healthy!\n"));
  }

  // Summary
  console.log(chalk.dim("  ─────────────────────────────────────────────────"));
  console.log(
    `  Checked ${scanResult.totalServers} server${scanResult.totalServers === 1 ? "" : "s"} across ${activeClients} client${activeClients === 1 ? "" : "s"}`
  );
  if (warnings.length > 0) {
    console.log(
      chalk.yellow(
        `  ${warnings.length} warning${warnings.length === 1 ? "" : "s"} found`
      )
    );
  }
  console.log("");
}
