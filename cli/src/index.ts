#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import gradient from "gradient-string";
import figlet from "figlet";
import { IPACompilorShell } from "./shell.js";
import { Logger } from "./logger.js";
import { ConfigManager } from "./config.js";
import { EnvironmentDiagnostics } from "./diagnostics.js";

const VERSION = "2.0.0";

// ─── Brand Colors ────────────────────────────────────────────────────────────
const brand = gradient(["#00D4FF", "#7B2FFF", "#FF006E"]);
const accent = chalk.hex("#00D4FF");
const dim = chalk.hex("#4A5568");
const success = chalk.hex("#00FF88");
const warn = chalk.hex("#FFB800");
const error = chalk.hex("#FF006E");

// ─── Banner ───────────────────────────────────────────────────────────────────
function printBanner(): void {
  console.clear();
  const banner = figlet.textSync("IPA COMPILOR", {
    font: "ANSI Shadow",
    horizontalLayout: "fitted",
  });

  console.log(brand(banner));
  console.log(
    accent("  ┌─────────────────────────────────────────────────────────────────┐")
  );
  console.log(
    accent("  │") +
      chalk.white("  Windows-First iOS Build Ecosystem") +
      dim("  ·  ") +
      chalk.hex("#7B2FFF")(`v${VERSION}`) +
      accent("                    │")
  );
  console.log(
    accent("  │") +
      dim("  Built for speed. Engineered for scale. Running on Windows.       ") +
      accent("│")
  );
  console.log(
    accent("  └─────────────────────────────────────────────────────────────────┘")
  );
  console.log();
}

// ─── Status Grid ─────────────────────────────────────────────────────────────
async function printStatusGrid(): Promise<void> {
  const diag = new EnvironmentDiagnostics();
  const status = await diag.quickCheck();

  const col = (label: string, ok: boolean | null) => {
    const icon = ok === null ? dim("◌") : ok ? success("◉") : error("◎");
    const text = ok === null ? dim(label) : ok ? chalk.white(label) : chalk.gray(label);
    return `  ${icon} ${text}`;
  };

  console.log(dim("  ┄┄┄┄┄┄┄┄┄┄ ENVIRONMENT STATUS ┄┄┄┄┄┄┄┄┄┄"));
  console.log();
  console.log(
    col("Swift Windows  ", status.swift) +
      "    " +
      col("Node.js        ", status.node)
  );
  console.log(
    col("SSH Agent      ", status.ssh) +
      "    " +
      col("Docker         ", status.docker)
  );
  console.log(
    col("Signing Cert   ", status.cert) +
      "    " +
      col("Provisioning   ", status.provisioning)
  );
  console.log(
    col("Build Cache    ", status.cache) +
      "    " +
      col("Apple Dev API  ", status.appleApi)
  );
  console.log();
  console.log(dim("  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"));
  console.log();
}

// ─── Quick Action Menu ────────────────────────────────────────────────────────
function printQuickMenu(): void {
  const cmd = (key: string, label: string, desc: string) =>
    `  ${chalk.hex("#7B2FFF")(key.padEnd(14))} ${chalk.white(label.padEnd(22))} ${dim(desc)}`;

  console.log(dim("  ┄┄┄┄┄┄┄┄┄┄┄┄ QUICK ACTIONS ┄┄┄┄┄┄┄┄┄┄┄┄"));
  console.log();
  console.log(cmd("build", "Build Project", "Compile Swift → .ipa"));
  console.log(cmd("sign", "Sign & Package", "Code sign & export .ipa"));
  console.log(cmd("deploy", "Deploy", "Push to device / TestFlight"));
  console.log(cmd("sync", "Sync to Mac", "Sync source to build agent"));
  console.log(cmd("diag", "Diagnostics", "Full environment report"));
  console.log(cmd("new", "New Project", "Scaffold Swift project"));
  console.log(cmd("config", "Configure", "Platform settings"));
  console.log(cmd("emulate", "Cloud Emulator", "Run .ipa in Appetize.io"));
  console.log(cmd("ota", "OTA Installer", "Generate wireless install assets"));
  console.log(cmd("shell", "Interactive Shell", "Open IPA shell (recommended)"));
  console.log();
  console.log(dim("  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"));
  console.log();
  console.log(
    "  " +
      accent("→") +
      chalk.white(" Run ") +
      chalk.hex("#00FF88")("ipa-compilor shell") +
      chalk.white(" for the full interactive experience")
  );
  console.log(
    "  " +
      accent("→") +
      chalk.white(" Run ") +
      chalk.hex("#00FF88")("ipa-compilor --help") +
      chalk.white(" for all commands")
  );
  console.log();
}

// ─── CLI Definition ───────────────────────────────────────────────────────────
async function main(): Promise<void> {
  program
    .name("ipa-compilor")
    .description("Next-Generation Windows-First iOS Build Platform")
    .version(VERSION);

  program
    .command("shell")
    .description("Launch the interactive IPA Compilor shell")
    .action(async () => {
      printBanner();
      await printStatusGrid();
      const shell = new IPACompilorShell();
      await shell.start();
    });

  program
    .command("build [path]")
    .description("Build the Swift project and generate an .ipa")
    .option("-t, --target <name>", "Build target name")
    .option("-c, --config <config>", "Build configuration (Debug|Release)", "Release")
    .option("--no-cache", "Disable build cache")
    .option("--cloud", "Force cloud build via GitHub Actions (Free)")
    .option("--remote", "Force remote build via SSH agent")
    .option("--local", "Force local build (Swift for Windows)")
    .option("--emulator", "Build for Cloud Emulator and run it automatically")
    .action(async (path, opts) => {
      printBanner();
      const { BuildPipeline } = await import("./pipelines/build.js");
      const pipeline = new BuildPipeline();
      await pipeline.run({ ...opts, projectPath: path, simulator: opts.emulator });
      
      if (opts.emulator) {
        console.log();
        const { EmulatePipeline } = await import("./pipelines/emulate.js");
        const emulatePipeline = new EmulatePipeline();
        await emulatePipeline.run({});
      }
    });

  program
    .command("sign")
    .description("Sign and package an .ipa file")
    .option("-i, --input <path>", "Input .ipa or .app path")
    .option("-p, --profile <id>", "Provisioning profile UUID")
    .option("-c, --cert <name>", "Signing certificate name")
    .action(async (opts) => {
      printBanner();
      const { SigningPipeline } = await import("./pipelines/signing.js");
      const pipeline = new SigningPipeline();
      await pipeline.run(opts);
    });

  program
    .command("sync")
    .description("Sync source code to the Mac build agent")
    .option("-w, --watch", "Watch for changes and auto-sync")
    .action(async (opts) => {
      printBanner();
      const { SyncEngine } = await import("./pipelines/sync.js");
      const engine = new SyncEngine();
      await engine.run(opts);
    });

  program
    .command("emulate")
    .description("Upload and run the compiled .ipa in the Cloud Emulator (Appetize.io)")
    .option("-i, --input <path>", "Path to .ipa or .zip file (auto-detects if omitted)")
    .option("-t, --device <name>", "Device model (e.g., iphone15pro)", "iphone15pro")
    .option("-o, --os <version>", "OS version (e.g., 17)", "17")
    .action(async (opts) => {
      printBanner();
      const { EmulatePipeline } = await import("./pipelines/emulate.js");
      const pipeline = new EmulatePipeline();
      await pipeline.run(opts);
    });

  program
    .command("ota")
    .description("Generate OTA (Over-The-Air) installation files (manifest.plist & index.html)")
    .option("-i, --input <path>", "Path to .ipa file")
    .option("-u, --url <baseUrl>", "Base HTTPS URL where files will be hosted")
    .action(async (opts) => {
      printBanner();
      const { OTAPipeline } = await import("./pipelines/ota.js");
      const pipeline = new OTAPipeline();
      await pipeline.run({ ipaPath: opts.input, baseUrl: opts.url });
    });

  program
    .command("diag")
    .description("Run full environment diagnostics")
    .option("--fix", "Attempt to auto-fix detected issues")
    .action(async (opts) => {
      printBanner();
      const diag = new EnvironmentDiagnostics();
      await diag.runFull(opts.fix);
    });

  program
    .command("new <name>")
    .description("Scaffold a new Swift project")
    .option("-t, --template <template>", "Project template (app|framework|package)", "app")
    .action(async (name, opts) => {
      printBanner();
      const { ProjectScaffolder } = await import("./scaffolder.js");
      const scaffolder = new ProjectScaffolder();
      await scaffolder.create(name, opts.template);
    });

  program
    .command("config")
    .description("Configure platform settings")
    .option("--ssh-host <host>", "Mac build agent hostname")
    .option("--ssh-user <user>", "SSH username")
    .option("--ssh-key <path>", "SSH private key path")
    .option("--team-id <id>", "Apple Developer Team ID")
    .option("--bundle-id <id>", "Default bundle identifier")
    .option("--github-token <token>", "GitHub Personal Access Token for Cloud Build")
    .option("--github-repo <owner/repo>", "GitHub Repository for Cloud Build")
    .option("--appetize-token <token>", "Appetize.io API Token for Cloud Emulator")
    .action(async (opts) => {
      printBanner();
      const config = new ConfigManager();
      await config.interactive(opts);
    });

  // Default: show banner + status + menu
  if (process.argv.length === 2) {
    printBanner();
    await printStatusGrid();
    printQuickMenu();
    process.exit(0);
  }

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(error(`\n  ✗ Fatal error: ${err.message}\n`));
  process.exit(1);
});
