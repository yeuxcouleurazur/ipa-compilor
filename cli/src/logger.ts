import chalk from "chalk";
import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";

// ─── Color Palette ────────────────────────────────────────────────────────────
const c = {
  cyan: chalk.hex("#00D4FF"),
  purple: chalk.hex("#7B2FFF"),
  pink: chalk.hex("#FF006E"),
  green: chalk.hex("#00FF88"),
  yellow: chalk.hex("#FFB800"),
  gray: chalk.hex("#4A5568"),
  white: chalk.white,
  dim: chalk.dim,
};

export type LogLevel = "info" | "success" | "warn" | "error" | "debug" | "step" | "data";

interface LogEntry {
  ts: string;
  level: LogLevel;
  tag: string;
  message: string;
}

export class Logger {
  private static instance: Logger;
  private logFile?: ReturnType<typeof createWriteStream>;
  private sessionId: string;
  private stepCounter = 0;

  constructor(private tag = "IPA") {
    this.sessionId = Date.now().toString(36).toUpperCase();
    this.initFileLogger();
  }

  static getInstance(): Logger {
    if (!Logger.instance) Logger.instance = new Logger();
    return Logger.instance;
  }

  private initFileLogger(): void {
    try {
      const logDir = join(process.cwd(), "artifacts", "logs");
      mkdirSync(logDir, { recursive: true });
      const logPath = join(logDir, `session-${this.sessionId}.log`);
      this.logFile = createWriteStream(logPath, { flags: "a" });
    } catch {
      // Non-fatal: file logging unavailable
    }
  }

  private write(entry: LogEntry): void {
    this.logFile?.write(JSON.stringify(entry) + "\n");
  }

  private prefix(level: LogLevel): string {
    const ts = new Date().toISOString().slice(11, 19);
    const tsStr = c.gray(`[${ts}]`);

    const icons: Record<LogLevel, string> = {
      info: c.cyan("ℹ"),
      success: c.green("✓"),
      warn: c.yellow("⚠"),
      error: c.pink("✗"),
      debug: c.purple("◈"),
      step: c.cyan("→"),
      data: c.purple("◆"),
    };

    const tags: Record<LogLevel, string> = {
      info: c.cyan("INFO "),
      success: c.green("DONE "),
      warn: c.yellow("WARN "),
      error: c.pink("ERROR"),
      debug: c.purple("DEBUG"),
      step: c.cyan("STEP "),
      data: c.purple("DATA "),
    };

    return `  ${tsStr} ${icons[level]} ${c.gray("|")} ${tags[level]} ${c.gray("|")} `;
  }

  info(msg: string): void {
    console.log(this.prefix("info") + c.white(msg));
    this.write({ ts: new Date().toISOString(), level: "info", tag: this.tag, message: msg });
  }

  success(msg: string): void {
    console.log(this.prefix("success") + c.green(msg));
    this.write({ ts: new Date().toISOString(), level: "success", tag: this.tag, message: msg });
  }

  warn(msg: string): void {
    console.log(this.prefix("warn") + c.yellow(msg));
    this.write({ ts: new Date().toISOString(), level: "warn", tag: this.tag, message: msg });
  }

  error(msg: string, err?: Error): void {
    console.log(this.prefix("error") + c.pink(msg));
    if (err?.stack) console.log(c.gray("  " + err.stack.split("\n").join("\n  ")));
    this.write({ ts: new Date().toISOString(), level: "error", tag: this.tag, message: msg });
  }

  debug(msg: string): void {
    if (process.env.IPA_DEBUG !== "1") return;
    console.log(this.prefix("debug") + c.dim(msg));
    this.write({ ts: new Date().toISOString(), level: "debug", tag: this.tag, message: msg });
  }

  step(msg: string): void {
    this.stepCounter++;
    console.log(
      `\n  ${c.purple(`[${this.stepCounter.toString().padStart(2, "0")}]`)} ${c.cyan("→")} ${c.white(msg)}`
    );
    this.write({ ts: new Date().toISOString(), level: "step", tag: this.tag, message: msg });
  }

  data(key: string, value: string | number | boolean): void {
    console.log(
      `       ${c.gray("├─")} ${c.purple(key.padEnd(20))} ${c.cyan(String(value))}`
    );
  }

  banner(title: string, subtitle?: string): void {
    const width = 65;
    const line = c.cyan("─".repeat(width));
    console.log(`\n  ${line}`);
    console.log(`  ${c.cyan("│")}  ${c.white(title)}${subtitle ? c.gray("  ·  " + subtitle) : ""}`);
    console.log(`  ${line}\n`);
  }

  separator(label?: string): void {
    if (label) {
      console.log(`\n  ${c.gray("┄┄┄┄┄┄┄┄┄┄")} ${c.purple(label)} ${c.gray("┄┄┄┄┄┄┄┄┄┄")}\n`);
    } else {
      console.log(`\n  ${c.gray("┄".repeat(50))}\n`);
    }
  }

  table(rows: Array<[string, string]>, title?: string): void {
    if (title) this.separator(title);
    const maxKey = Math.max(...rows.map(([k]) => k.length));
    for (const [key, val] of rows) {
      console.log(
        `  ${c.gray("│")}  ${c.purple(key.padEnd(maxKey))}  ${c.white(val)}`
      );
    }
    if (title) console.log();
  }

  resetStep(): void {
    this.stepCounter = 0;
  }
}
