import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";
import { execa } from "execa";
import ora from "ora";
import chalk from "chalk";
import { Logger } from "../logger.js";
import { ConfigManager } from "../config.js";

const c = {
  cyan: chalk.hex("#00D4FF"),
  purple: chalk.hex("#7B2FFF"),
  green: chalk.hex("#00FF88"),
  yellow: chalk.hex("#FFB800"),
  pink: chalk.hex("#FF006E"),
  gray: chalk.hex("#4A5568"),
  white: chalk.white,
};

export interface EmulateOptions {
  input?: string;
  device?: string;
  os?: string;
}

export class EmulatePipeline {
  private log = new Logger("EMULATE");
  private cfg = new ConfigManager();

  async run(opts: EmulateOptions): Promise<void> {
    this.log.banner("Cloud Emulator", "Powered by Appetize.io");
    this.log.resetStep();

    const token = this.cfg.get("appetize").token;
    if (!token) {
      this.log.error("Appetize.io API Token is missing.");
      this.log.info(`Run ${c.cyan("ipa-compilor config --appetize-token <your_token>")} to set it up.`);
      this.log.info("You can get a free token at https://appetize.io/docs/api");
      
      // MOCK BEHAVIOR FOR TESTING WITHOUT TOKEN
      this.log.warn("Running in DEMO mode (simulated upload) because no token is present.");
    }

    let appPath = opts.input;

    if (!appPath) {
      this.log.step("Auto-detecting latest build artifact...");
      appPath = this.findLatestApp();
      if (!appPath) {
        throw new Error("No .ipa or .zip file found in artifacts/ipa. Build the project first.");
      }
      this.log.data("Detected file", appPath);
    } else if (!existsSync(appPath)) {
      throw new Error(`File not found at path: ${appPath}`);
    }

    this.log.step("Preparing for cloud upload...");
    const spinner = ora({ text: c.gray("Uploading to Appetize.io cloud..."), color: "magenta" }).start();

    try {
      let publicUrl = "";

      if (token) {
        // ACTUAL API CALL
        const formData = new FormData();
        const fileBuffer = readFileSync(appPath);
        const fileName = appPath.split(/[\/\\]/).pop() || "app.zip";
        formData.append("file", new Blob([fileBuffer]), fileName);
        formData.append("platform", "ios");
        
        const response = await fetch("https://api.appetize.io/v1/apps", {
          method: "POST",
          headers: {
            "Authorization": "Basic " + Buffer.from(token + ":").toString("base64"),
            "X-API-KEY": token
          },
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Appetize API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json() as any;
        publicUrl = data.publicURL;
        
        // Append params
        const device = opts.device || "iphone15pro";
        const os = opts.os || "17";
        publicUrl += `?device=${device}&osVersion=${os}&scale=75`;

      } else {
        // DEMO MODE
        await this.sleep(3000);
        spinner.text = c.gray("Processing app bundle...");
        await this.sleep(2000);
        publicUrl = `https://appetize.io/embed/demo_simulator_preview?device=${opts.device || "iphone15pro"}&osVersion=${opts.os || "17"}&scale=75`;
      }

      spinner.succeed(c.white("Upload complete!"));
      
      console.log();
      this.log.success("Emulator is ready!");
      this.log.data("URL", c.cyan.underline(publicUrl));
      console.log();
      
      this.log.step("Opening emulator in your default web browser...");
      await this.openBrowser(publicUrl);

    } catch (error) {
      spinner.fail(c.pink("Upload failed"));
      this.log.error((error as Error).message);
    }
  }

  private findLatestApp(): string | undefined {
    const dir = this.cfg.outputConfig.ipaDir;
    if (!existsSync(dir)) return undefined;

    const files = readdirSync(dir)
      .filter(f => f.endsWith(".ipa") || f.endsWith(".zip"))
      .map(f => join(dir, f));

    if (files.length === 0) return undefined;

    // Sort by modification time, descending
    files.sort((a, b) => {
      return statSync(b).mtimeMs - statSync(a).mtimeMs;
    });

    return files[0];
  }

  private async openBrowser(url: string): Promise<void> {
    const platform = process.platform;
    try {
      if (platform === "win32") {
        await execa("cmd", ["/c", "start", url]);
      } else if (platform === "darwin") {
        await execa("open", [url]);
      } else {
        await execa("xdg-open", [url]);
      }
    } catch (e) {
      this.log.warn(`Could not automatically open browser. Please click the link manually.`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
