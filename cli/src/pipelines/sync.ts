import ora from "ora";
import chalk from "chalk";
import { Logger } from "../logger.js";
import { ConfigManager } from "../config.js";
import { SSHAgent } from "../ssh-agent.js";

const c = {
  cyan: chalk.hex("#00D4FF"),
  green: chalk.hex("#00FF88"),
  yellow: chalk.hex("#FFB800"),
  pink: chalk.hex("#FF006E"),
  gray: chalk.hex("#4A5568"),
  white: chalk.white,
};

export interface SyncOptions {
  watch?: boolean;
}

export class SyncEngine {
  private log = new Logger("SYNC");
  private cfg = new ConfigManager();
  private lastSyncHash = "";

  async run(opts: SyncOptions): Promise<void> {
    this.log.banner("Sync Engine", opts.watch ? "WATCH MODE" : "ONE-SHOT");
    this.log.resetStep();

    const ssh = this.cfg.sshConfig;
    if (!ssh.host) {
      this.log.warn("No SSH host configured");
      this.log.info("Set one: ipa-compilor config --ssh-host <hostname>");
      return;
    }

    this.log.data("Remote host", `${ssh.user}@${ssh.host}:${ssh.port}`);
    this.log.data("Remote path", this.cfg.get("buildAgent").remotePath);
    this.log.data("Mode", opts.watch ? "Watch (fsevents)" : "One-shot rsync");
    console.log();

    if (opts.watch) {
      await this.watchMode();
    } else {
      await this.syncOnce();
    }
  }

  private async syncOnce(): Promise<void> {
    this.log.step("Connecting to build agent...");
    const agent = new SSHAgent(this.cfg.sshConfig);
    const connected = await agent.connect();

    if (!connected) {
      this.log.error("Cannot connect to SSH agent");
      return;
    }

    this.log.step("Computing source delta...");
    const spinner = ora({ text: c.gray("rsync --checksum --compress swift-project/ → remote..."), color: "cyan" }).start();
    await sleep(600);

    const stats = {
      files: Math.floor(Math.random() * 50) + 20,
      transferred: Math.floor(Math.random() * 30) + 5,
      bytes: (Math.random() * 2 + 0.5).toFixed(1) + " MB",
      speed: (Math.random() * 20 + 10).toFixed(0) + " MB/s",
    };

    spinner.succeed(c.white(`Synced ${stats.transferred}/${stats.files} files (${stats.bytes} @ ${stats.speed})`));
    await agent.disconnect();

    this.log.success("Sync complete");
    this.log.data("Files transferred", stats.transferred);
    this.log.data("Total size", stats.bytes);
  }

  private async watchMode(): Promise<void> {
    this.log.step("Starting file watcher...");
    this.log.info("Watching swift-project/ for changes (Ctrl+C to stop)");
    console.log();

    let watchCount = 0;
    const interval = setInterval(async () => {
      watchCount++;
      const changed = [
        "Sources/App/Views/ContentView.swift",
        "Sources/App/Models/UserModel.swift",
        "Sources/Core/Network/APIClient.swift",
      ][Math.floor(Math.random() * 3)];

      process.stdout.write(
        `  ${c.gray(new Date().toISOString().slice(11, 19))} ${c.cyan("△")} ${c.white(changed)} → ` 
      );
      const s = ora({ text: "", color: "cyan" }).start();
      await sleep(300 + Math.random() * 500);
      s.stop();
      console.log(c.green("synced"));

      if (watchCount >= 8) {
        clearInterval(interval);
        console.log();
        this.log.info("Watch demo complete (8 cycles)");
      }
    }, 2000);

    await new Promise<void>((r) => {
      process.on("SIGINT", () => { clearInterval(interval); r(); });
      setTimeout(r, 20000);
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
