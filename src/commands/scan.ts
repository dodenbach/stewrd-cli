import ora from "ora";
import { scanAll } from "../scanners/index.js";
import { renderScanResult, renderScanJson } from "../utils/display.js";

interface ScanOptions {
  json?: boolean;
}

export async function scan(options: ScanOptions): Promise<void> {
  const spinner = ora({
    text: "Scanning for MCP servers...",
    color: "yellow",
  }).start();

  try {
    const result = await scanAll();
    spinner.stop();

    if (options.json) {
      renderScanJson(result);
    } else {
      renderScanResult(result);
    }
  } catch (e) {
    spinner.fail(`Scan failed: ${e}`);
    process.exit(1);
  }
}
