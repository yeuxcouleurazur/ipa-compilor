import * as readline from "readline";
import chalk from "chalk";
import { Logger } from "./logger.js";
import { ConfigManager } from "./config.js";

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

const PROMPT = `  ${c.purple("ipa")}${c.gray("/")}${c.cyan("⚡")} ${c.gray("›")} `;

export class IPACompilorShell {
  private rl: readline.Interface;
  private log = new Logger("SHELL");
  private config = new ConfigManager();
  private history: string[] = [];
  private running = true;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: PROMPT,
      historySize: 100,
    });
  }

  async start(): Promise<void> {
    this.printWelcome();
    this.rl.prompt();

    this.rl.on("line", async (line) => {
      const input = line.trim();
      if (!input) { this.rl.prompt(); return; }
      this.history.push(input);

      try {
        await this.handle(input);
      } catch (err) {
        this.log.error("Command failed", err as Error);
      }

      if (this.running) this.rl.prompt();
    });

    this.rl.on("close", () => {
      console.log(`\n  ${c.cyan("◈")} ${c.white("Session ended. Goodbye.\n")}`);
    });

    await new Promise<void>((resolve) => {
      this.rl.on("close", resolve);
    });
  }

  private printWelcome(): void {
    console.log(`  ${c.gray("┄".repeat(50))}`);
    console.log(`  ${c.cyan("◈")} ${c.white("IPA Compilor Shell")}  ${c.gray("·")}  ${c.purple("Type")} ${c.cyan("help")} ${c.purple("to see all commands")}`);
    console.log(`  ${c.gray("┄".repeat(50))}\n`);
  }

  private async handle(input: string): Promise<void> {
    const [cmd, ...args] = input.split(/\s+/);

    switch (cmd?.toLowerCase()) {
      case "build":
        return this.cmdBuild(args);
      case "sign":
        return this.cmdSign(args);
      case "sync":
        return this.cmdSync(args);
      case "deploy":
        return this.cmdDeploy(args);
      case "diag":
      case "diagnostics":
        return this.cmdDiag(args);
      case "status":
        return this.cmdStatus();
      case "config":
        return this.cmdConfig(args);
      case "new":
        return this.cmdNew(args);
      case "cache":
        return this.cmdCache(args);
      case "logs":
        return this.cmdLogs();
      case "history":
        return this.cmdHistory();
      case "clear":
      case "cls":
        console.clear();
        return;
      case "help":
      case "?":
        return this.cmdHelp();
      case "exit":
      case "quit":
      case "q":
        this.running = false;
        this.rl.close();
        return;
      default:
        console.log(`\n  ${c.pink("✗")} ${c.white(`Unknown command:`)} ${c.yellow(cmd)}`);
        console.log(`  ${c.gray("  Type")} ${c.cyan("help")} ${c.gray("for available commands.\n")}`);
    }
  }

  private async cmdBuild(args: string[]): Promise<void> {
    const config = args.includes("--release") ? "Release" : args.includes("--debug") ? "Debug" : "Release";
    const remote = args.includes("--remote");
    const cloud = args.includes("--cloud");
    const noCache = args.includes("--no-cache");

    const { BuildPipeline } = await import("./pipelines/build.js");
    const pipeline = new BuildPipeline();
    await pipeline.run({ config, remote, cloud, cache: !noCache });
  }

  private async cmdSign(args: string[]): Promise<void> {
    const { SigningPipeline } = await import("./pipelines/signing.js");
    const pipeline = new SigningPipeline();
    await pipeline.run({});
  }

  private async cmdSync(args: string[]): Promise<void> {
    const watch = args.includes("--watch") || args.includes("-w");
    const { SyncEngine } = await import("./pipelines/sync.js");
    const engine = new SyncEngine();
    await engine.run({ watch });
  }

  private async cmdDeploy(args: string[]): Promise<void> {
    const target = args.includes("testflight") ? "testflight" : "device";
    this.log.banner("Deploy Pipeline", target.toUpperCase());
    this.log.step("Locating signed .ipa artifact...");
    this.log.info("Run `build` then `sign` first to generate a deployable .ipa");
  }

  private async cmdDiag(args: string[]): Promise<void> {
    const autoFix = args.includes("--fix");
    const { EnvironmentDiagnostics } = await import("./diagnostics.js");
    const diag = new EnvironmentDiagnostics();
    await diag.runFull(autoFix);
  }

  private async cmdStatus(): Promise<void> {
    const { EnvironmentDiagnostics } = await import("./diagnostics.js");
    const diag = new EnvironmentDiagnostics();
    const status = await diag.quickCheck();
    const col = (label: string, ok: boolean | null) => {
      const icon = ok === null ? c.gray("◌") : ok ? c.green("◉") : c.pink("◎");
      return `  ${icon} ${c.white(label)}`;
    };
    console.log();
    console.log(col("Swift Windows  ", status.swift) + "    " + col("Node.js        ", status.node));
    console.log(col("SSH Agent      ", status.ssh) + "    " + col("Docker         ", status.docker));
    console.log(col("Signing Cert   ", status.cert) + "    " + col("Provisioning   ", status.provisioning));
    console.log(col("Build Cache    ", status.cache) + "    " + col("Apple Dev API  ", status.appleApi));
    console.log();
  }

  private async cmdConfig(args: string[]): Promise<void> {
    if (args.length === 0) {
      const all = this.config.getAll();
      this.log.banner("Current Configuration");
      this.log.table([
        ["Project Name", all.project.name],
        ["Bundle ID", all.project.bundleId],
        ["Version", all.project.version],
        ["Team ID", all.project.teamId || "(not set)"],
        ["Build Mode", all.buildAgent.mode],
        ["SSH Host", all.buildAgent.ssh.host || "(not set)"],
        ["Export Method", all.signing.exportMethod],
        ["Configuration", all.build.configuration],
      ]);
      return;
    }
    const [key, ...rest] = args;
    const val = rest.join(" ");
    this.log.info(`Setting ${key} = ${val}`);
  }

  private async cmdNew(args: string[]): Promise<void> {
    const name = args[0] || "MyApp";
    const { ProjectScaffolder } = await import("./scaffolder.js");
    const scaffolder = new ProjectScaffolder();
    await scaffolder.create(name, "app");
  }

  private async cmdCache(args: string[]): Promise<void> {
    const sub = args[0];
    if (sub === "clear") {
      this.log.step("Clearing build cache...");
      const { rmSync, mkdirSync } = await import("fs");
      rmSync("artifacts/cache", { recursive: true, force: true });
      mkdirSync("artifacts/cache", { recursive: true });
      this.log.success("Build cache cleared");
    } else {
      this.log.info("Usage: cache [clear]");
    }
  }

  private cmdLogs(): void {
    this.log.info(`Logs are stored in: ${c.cyan("artifacts/logs/")}`);
    const { readdirSync, existsSync } = require("fs");
    if (existsSync("artifacts/logs")) {
      const files = readdirSync("artifacts/logs") as string[];
      if (files.length === 0) {
        this.log.info("No log files yet.");
      } else {
        files.slice(-5).forEach((f: string) => console.log(`  ${c.gray("│")}  ${c.purple(f)}`));
      }
    }
  }

  private cmdHistory(): void {
    console.log();
    this.history.slice(-20).forEach((h, i) => {
      console.log(`  ${c.gray(String(i + 1).padStart(3))}  ${c.white(h)}`);
    });
    console.log();
  }

  private cmdHelp(): void {
    const row = (cmd: string, args: string, desc: string) =>
      `  ${c.cyan(cmd.padEnd(12))} ${c.purple(args.padEnd(20))} ${c.gray(desc)}`;

    console.log(`\n  ${c.white("IPA Compilor Shell Commands")}\n`);
    console.log(row("build", "[--cloud|--remote]", "Compile Swift project → .ipa (defaults to Cloud)"));
    console.log(row("sign", "", "Code sign the built .ipa"));
    console.log(row("sync", "[--watch]", "Sync source to Mac build agent"));
    console.log(row("deploy", "[testflight|device]", "Deploy signed .ipa"));
    console.log(row("diag", "[--fix]", "Run environment diagnostics"));
    console.log(row("status", "", "Quick environment status"));
    console.log(row("config", "[key value]", "View or set configuration"));
    console.log(row("new", "<AppName>", "Scaffold a new Swift project"));
    console.log(row("cache", "[clear]", "Manage build cache"));
    console.log(row("logs", "", "View session logs"));
    console.log(row("history", "", "Command history"));
    console.log(row("clear", "", "Clear screen"));
    console.log(row("help", "", "Show this menu"));
    console.log(row("exit", "", "Quit the shell"));
    console.log();
  }
}
