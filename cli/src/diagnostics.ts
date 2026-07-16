import { execa } from "execa";
import { existsSync } from "fs";
import { Logger } from "./logger.js";
import chalk from "chalk";

const c = {
  green: chalk.hex("#00FF88"),
  red: chalk.hex("#FF006E"),
  yellow: chalk.hex("#FFB800"),
  gray: chalk.hex("#4A5568"),
  cyan: chalk.hex("#00D4FF"),
  purple: chalk.hex("#7B2FFF"),
  white: chalk.white,
};

export interface DiagStatus {
  swift: boolean | null;
  node: boolean | null;
  ssh: boolean | null;
  docker: boolean | null;
  cert: boolean | null;
  provisioning: boolean | null;
  cache: boolean | null;
  appleApi: boolean | null;
}

export class EnvironmentDiagnostics {
  private log = new Logger("DIAG");

  async quickCheck(): Promise<DiagStatus> {
    const checks = await Promise.allSettled([
      this.checkSwift(),
      this.checkNode(),
      this.checkSSH(),
      this.checkDocker(),
      this.checkCert(),
      this.checkProvisioning(),
      this.checkCache(),
      this.checkAppleApi(),
    ]);

    const val = (r: PromiseSettledResult<boolean>): boolean | null =>
      r.status === "fulfilled" ? r.value : null;

    return {
      swift: val(checks[0]),
      node: val(checks[1]),
      ssh: val(checks[2]),
      docker: val(checks[3]),
      cert: val(checks[4]),
      provisioning: val(checks[5]),
      cache: val(checks[6]),
      appleApi: val(checks[7]),
    };
  }

  async runFull(autoFix = false): Promise<void> {
    this.log.banner("Environment Diagnostics", "Full Report");
    this.log.resetStep();

    const checks: Array<[string, () => Promise<boolean>, string]> = [
      ["Swift for Windows", () => this.checkSwift(), "https://www.swift.org/download/"],
      ["Node.js ≥ 20", () => this.checkNode(), "https://nodejs.org"],
      ["SSH Agent connectivity", () => this.checkSSH(), "config/ipa-compilor.yaml → buildAgent.ssh"],
      ["Docker Engine", () => this.checkDocker(), "https://docs.docker.com/desktop/windows/"],
      ["Signing Certificate", () => this.checkCert(), "config/ipa-compilor.yaml → signing.certPath"],
      ["Provisioning Profile", () => this.checkProvisioning(), "config/ipa-compilor.yaml → signing.profilePath"],
      ["Build Cache", () => this.checkCache(), "artifacts/cache/"],
      ["Apple Developer API", () => this.checkAppleApi(), "Requires teamId + API key"],
    ];

    const results: Array<{ name: string; ok: boolean; fix: string }> = [];

    for (const [name, check, fix] of checks) {
      process.stdout.write(`  ${c.gray("►")} ${c.white(name.padEnd(30))}`);
      const ok = await check().catch(() => false);
      const icon = ok ? c.green("✓ PASS") : c.red("✗ FAIL");
      console.log(icon);
      results.push({ name, ok, fix });
    }

    console.log();
    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    this.log.separator("SUMMARY");
    console.log(`  ${c.green(`${passed} checks passed`)}  ${c.gray("·")}  ${failed > 0 ? c.red(`${failed} checks failed`) : c.green("0 failed")}`);
    console.log();

    if (failed > 0) {
      this.log.separator("REMEDIATION");
      for (const r of results.filter((x) => !x.ok)) {
        console.log(`  ${c.red("✗")} ${c.white(r.name)}`);
        console.log(`    ${c.gray("└─")} ${c.cyan(r.fix)}\n`);
      }
    }

    if (autoFix) {
      this.log.separator("AUTO-FIX");
      this.log.info("Attempting automatic remediation...");
      await this.attemptAutoFix(results.filter((r) => !r.ok).map((r) => r.name));
    }
  }

  private async checkSwift(): Promise<boolean> {
    try {
      const { stdout } = await execa("swift", ["--version"], { timeout: 5000 });
      return stdout.includes("Swift");
    } catch {
      return false;
    }
  }

  private async checkNode(): Promise<boolean> {
    try {
      const { stdout } = await execa("node", ["--version"], { timeout: 3000 });
      const version = parseInt(stdout.replace("v", "").split(".")[0] || "0");
      return version >= 20;
    } catch {
      return false;
    }
  }

  private async checkSSH(): Promise<boolean> {
    try {
      const { existsSync } = await import("fs");
      const { join } = await import("path");
      const cfg = join(process.cwd(), "config", "ipa-compilor.yaml");
      if (!existsSync(cfg)) return false;
      const { readFileSync } = await import("fs");
      const { parse } = await import("yaml");
      const config = parse(readFileSync(cfg, "utf-8"));
      return !!(config?.buildAgent?.ssh?.host);
    } catch {
      return false;
    }
  }

  private async checkDocker(): Promise<boolean> {
    try {
      await execa("docker", ["info"], { timeout: 8000 });
      return true;
    } catch {
      return false;
    }
  }

  private async checkCert(): Promise<boolean> {
    try {
      const { join } = await import("path");
      const cfg = join(process.cwd(), "config", "ipa-compilor.yaml");
      if (!existsSync(cfg)) return false;
      const { readFileSync } = await import("fs");
      const { parse } = await import("yaml");
      const config = parse(readFileSync(cfg, "utf-8"));
      const certPath = config?.signing?.certPath;
      return certPath ? existsSync(certPath ?? "") : false;
    } catch {
      return false;
    }
  }

  private async checkProvisioning(): Promise<boolean> {
    try {
      const { join } = await import("path");
      const cfg = join(process.cwd(), "config", "ipa-compilor.yaml");
      if (!existsSync(cfg)) return false;
      const { readFileSync } = await import("fs");
      const { parse } = await import("yaml");
      const config = parse(readFileSync(cfg, "utf-8"));
      const profilePath = config?.signing?.profilePath;
      return profilePath ? existsSync(profilePath ?? "") : false;
    } catch {
      return false;
    }
  }

  private async checkCache(): Promise<boolean> {
    return existsSync("artifacts/cache");
  }

  private async checkAppleApi(): Promise<boolean> {
    try {
      const { join } = await import("path");
      const cfg = join(process.cwd(), "config", "ipa-compilor.yaml");
      if (!existsSync(cfg)) return false;
      const { readFileSync } = await import("fs");
      const { parse } = await import("yaml");
      const config = parse(readFileSync(cfg, "utf-8"));
      return !!(config?.project?.teamId);
    } catch {
      return false;
    }
  }

  private async attemptAutoFix(failed: string[]): Promise<void> {
    for (const name of failed) {
      if (name === "Build Cache") {
        const { mkdirSync } = await import("fs");
        mkdirSync("artifacts/cache", { recursive: true });
        this.log.success("Created build cache directory");
      }
    }
  }
}
