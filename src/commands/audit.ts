import chalk from "chalk";
import ora from "ora";
import { scanAll } from "../scanners/index.js";
import { runAudit, type AuditFinding, type AuditReport } from "../security/audit-engine.js";
import type { Severity } from "../security/threat-feed.js";

interface AuditOptions {
  json?: boolean;
  ci?: boolean;
}

const SEVERITY_COLORS: Record<Severity, (s: string) => string> = {
  critical: chalk.bgRed.white.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.dim,
};

const SEVERITY_ICONS: Record<Severity, string> = {
  critical: "!!!",
  high: " ! ",
  medium: " ~ ",
  low: " - ",
};

function scoreColor(score: number): (s: string) => string {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  return chalk.red;
}

function scoreGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export async function audit(options: AuditOptions): Promise<void> {
  const spinner = ora("Scanning servers and running security audit...").start();

  const scanResult = await scanAll();
  const report = await runAudit(scanResult.clients);

  spinner.stop();

  // JSON output mode
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    if (options.ci && report.score < 70) {
      process.exit(1);
    }
    return;
  }

  // Terminal output
  const grade = scoreGrade(report.score);
  const color = scoreColor(report.score);

  console.log(
    `\n  ${chalk.bold("stewrd audit")} ${chalk.dim("— MCP security audit")}\n`
  );

  // Score card
  console.log(
    `  Security Score: ${color(`${report.score}/100`)} ${chalk.dim(`(${grade})`)}`
  );
  console.log(
    chalk.dim(
      `  ${report.serversScanned} servers across ${report.clientsScanned} clients\n`
    )
  );

  // Group findings by severity
  const bySeverity = groupBy(report.findings, (f) => f.severity);
  const severityOrder: Severity[] = ["critical", "high", "medium", "low"];

  for (const severity of severityOrder) {
    const findings = bySeverity[severity];
    if (!findings || findings.length === 0) continue;

    const label = severity.toUpperCase();
    const colorFn = SEVERITY_COLORS[severity];
    const icon = SEVERITY_ICONS[severity];

    console.log(
      `  ${colorFn(`[${icon}]`)} ${colorFn(label)} ${chalk.dim(`(${findings.length})`)}`
    );

    // Group findings by category for cleaner output
    const byCategory = groupBy(findings, (f) => f.category);

    for (const [category, catFindings] of Object.entries(byCategory)) {
      for (const finding of catFindings) {
        console.log(
          `       ${chalk.bold(finding.server)} ${chalk.dim(`(${finding.client})`)}`
        );
        console.log(
          `       ${finding.title}`
        );
        console.log(
          chalk.dim(`       ${finding.description}`)
        );
        if (finding.recommendation) {
          console.log(
            chalk.dim(`       Fix: ${finding.recommendation}`)
          );
        }
        console.log("");
      }
    }
  }

  if (report.findings.length === 0) {
    console.log(chalk.green("  No security issues found.\n"));
  }

  // Summary
  console.log(
    chalk.dim("  ─────────────────────────────────────────────────")
  );

  const criticals = bySeverity["critical"]?.length || 0;
  const highs = bySeverity["high"]?.length || 0;
  const mediums = bySeverity["medium"]?.length || 0;
  const lows = bySeverity["low"]?.length || 0;

  const parts: string[] = [];
  if (criticals > 0) parts.push(chalk.bgRed.white(` ${criticals} critical `));
  if (highs > 0) parts.push(chalk.red(`${highs} high`));
  if (mediums > 0) parts.push(chalk.yellow(`${mediums} medium`));
  if (lows > 0) parts.push(chalk.dim(`${lows} low`));

  if (parts.length > 0) {
    console.log(`  ${parts.join(chalk.dim(" · "))}`);
  }

  console.log(
    chalk.dim(
      `  Threat feed: ${report.threatFeedVersion}`
    )
  );
  console.log("");

  // CI mode — exit with error if score is below threshold
  if (options.ci) {
    if (report.score < 70) {
      console.log(
        chalk.red(
          `  CI check failed: score ${report.score} < 70\n`
        )
      );
      process.exit(1);
    } else {
      console.log(
        chalk.green(
          `  CI check passed: score ${report.score} >= 70\n`
        )
      );
    }
  }
}

function groupBy<T>(
  items: T[],
  key: (item: T) => string
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}
