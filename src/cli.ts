import { Command } from "commander";
import { scan } from "./commands/scan.js";
import { add } from "./commands/add.js";
import { remove } from "./commands/remove.js";
import { sync } from "./commands/sync.js";
import { doctor } from "./commands/doctor.js";

const program = new Command();

program
  .name("stewrd")
  .description(
    "The package manager for MCP servers. Discover, install, and sync across Claude, Cursor, and more."
  )
  .version("0.1.0");

program
  .command("scan")
  .description("Discover all MCP servers configured on this machine")
  .option("--json", "Output as JSON")
  .action(scan);

program
  .command("add <server>")
  .description("Add an MCP server to a client")
  .option(
    "-c, --client <client>",
    "Target client (claude-code, claude-desktop, cursor, windsurf, vscode)",
    "claude-code"
  )
  .option("--command <cmd>", "Server command (e.g., npx, node, python)")
  .option("--url <url>", "HTTP server URL")
  .option("--args <args>", "Command arguments (space-separated)")
  .option("-d, --description <desc>", "Server description")
  .action(add);

program
  .command("remove <server>")
  .alias("rm")
  .description("Remove an MCP server from a client")
  .option(
    "-c, --client <client>",
    "Target client",
    "claude-code"
  )
  .action(remove);

program
  .command("sync")
  .description("Sync MCP servers across all clients")
  .option("--dry-run", "Show what would be synced without making changes")
  .action(sync);

program
  .command("doctor")
  .description("Check MCP server configs for issues")
  .action(doctor);

program.parse();
