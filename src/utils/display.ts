import chalk from "chalk";
import type { ClientScanResult, McpServer, ScanResult } from "../types.js";

const TRANSPORT_COLORS: Record<string, (s: string) => string> = {
  stdio: chalk.green,
  npx: chalk.cyan,
  http: chalk.yellow,
  "http+oauth": chalk.magenta,
  unknown: chalk.gray,
};

function transportLabel(server: McpServer): string {
  const colorFn = TRANSPORT_COLORS[server.transport] || chalk.gray;
  return colorFn(server.transport.padEnd(10));
}

function serverDetail(server: McpServer): string {
  if (server.url) return chalk.dim(truncate(server.url, 50));
  if (server.command === "npx" && server.args?.length) {
    const pkg = server.args.find((a) => !a.startsWith("-")) || "";
    return chalk.dim(pkg);
  }
  if (server.command) return chalk.dim(truncate(server.command, 50));
  return "";
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

function renderClient(result: ClientScanResult): void {
  const statusIcon = result.exists
    ? result.servers.length > 0
      ? chalk.green("●")
      : chalk.dim("○")
    : chalk.red("✗");

  const count =
    result.servers.length > 0
      ? chalk.white(` (${result.servers.length} server${result.servers.length === 1 ? "" : "s"})`)
      : chalk.dim(" (none)");

  console.log(`\n  ${statusIcon} ${chalk.bold(result.client)}${count}`);

  if (!result.exists) {
    console.log(chalk.dim(`    Config not found: ${result.configPath}`));
    return;
  }

  if (result.error) {
    console.log(chalk.red(`    Error: ${result.error}`));
    return;
  }

  if (result.servers.length === 0) {
    console.log(chalk.dim("    No MCP servers configured"));
    return;
  }

  for (let i = 0; i < result.servers.length; i++) {
    const server = result.servers[i];
    const isLast = i === result.servers.length - 1;
    const prefix = isLast ? "└─" : "├─";
    const name = chalk.white(server.name.padEnd(24));
    const transport = transportLabel(server);
    const detail = serverDetail(server);

    console.log(`    ${chalk.dim(prefix)} ${name} ${transport} ${detail}`);
  }
}

export function renderScanResult(result: ScanResult): void {
  console.log("");
  console.log(
    chalk.bold(
      `  stewrd scan ${chalk.dim("— MCP servers on this machine")}`
    )
  );

  const activeClients = result.clients.filter((c) => c.servers.length > 0);
  const emptyClients = result.clients.filter(
    (c) => c.exists && c.servers.length === 0
  );
  const missingClients = result.clients.filter((c) => !c.exists);

  // Show clients with servers first
  for (const client of activeClients) {
    renderClient(client);
  }

  // Then empty ones
  for (const client of emptyClients) {
    renderClient(client);
  }

  // Then missing ones
  for (const client of missingClients) {
    renderClient(client);
  }

  // Summary
  console.log("");
  console.log(
    chalk.dim("  ─────────────────────────────────────────────────")
  );

  const clientCount = result.clients.filter((c) => c.exists).length;
  console.log(
    `  ${chalk.bold(String(result.totalServers))} server${result.totalServers === 1 ? "" : "s"} across ${chalk.bold(String(clientCount))} client${clientCount === 1 ? "" : "s"}`
  );

  // Show unique servers vs duplicates
  const allNames = result.clients.flatMap((c) =>
    c.servers.map((s) => s.name)
  );
  const unique = new Set(allNames);
  if (unique.size < allNames.length) {
    const dupes = allNames.length - unique.size;
    console.log(
      chalk.dim(
        `  ${unique.size} unique, ${dupes} shared across clients`
      )
    );
  }

  console.log("");
}

export function renderScanJson(result: ScanResult): void {
  console.log(JSON.stringify(result, null, 2));
}
