import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, basename } from "path";
import { ConfigManager } from "../config.js";
import { Logger } from "../logger.js";
import chalk from "chalk";

const c = {
  purple: chalk.hex("#7B2FFF"),
  cyan: chalk.hex("#00D4FF"),
  yellow: chalk.hex("#FFB800"),
};

export interface OTAOptions {
  ipaPath?: string;
  baseUrl?: string;
}

export class OTAPipeline {
  private cfg: ConfigManager;
  private log: Logger;

  constructor() {
    this.cfg = new ConfigManager();
    this.log = new Logger("OTA");
  }

  async run(opts: OTAOptions): Promise<void> {
    const startTime = Date.now();
    this.log.banner("OTA Deployment Generator", "Preparing Wireless Installation");

    const ipaDir = this.cfg.outputConfig.ipaDir;
    const ipaFile = opts.ipaPath || this.findLatestIPA(ipaDir);

    if (!ipaFile || !existsSync(ipaFile)) {
      this.log.error("No IPA file found. Please build the project first or provide a path.");
      return;
    }

    this.log.step("App Metadata");
    const proj = this.cfg.projectConfig;
    this.log.data("App Name", proj.name);
    const bundleId = proj.bundleId;
    this.log.data("Bundle ID", bundleId);
    this.log.data("Version", proj.version);
    this.log.data("IPA File", basename(ipaFile));

    const baseUrl = opts.baseUrl || "https://YOUR_DOMAIN.com/path";
    this.log.step("Configuration");
    this.log.data("Base URL", baseUrl);

    const filename = basename(ipaFile);
    const manifestPath = join(ipaDir, "manifest.plist");
    const htmlPath = join(ipaDir, "index.html");

    this.log.step("Generating Manifest...");
    const manifestContent = this.generateManifest(baseUrl, filename, bundleId, proj.name, proj.version);
    writeFileSync(manifestPath, manifestContent);
    this.log.success(`Manifest created: ${manifestPath}`);

    this.log.step("Generating Install Page...");
    const htmlContent = this.generateHTML(baseUrl, proj.name);
    writeFileSync(htmlPath, htmlContent);
    this.log.success(`HTML page created: ${htmlPath}`);

    this.log.separator("INSTRUCTIONS");
    console.log(`  1. Upload ${c.purple(filename)}, ${c.purple("manifest.plist")}, and ${c.purple("index.html")} to your HTTPS server.`);
    console.log(`  2. Ensure the URL in manifest.plist matches the location of the IPA.`);
    console.log(`  3. Open ${c.cyan(`${baseUrl}/index.html`)} on your iPhone.`);
    console.log(`  4. Click "Install" to begin.`);
    console.log(`\n  ${c.yellow("⚠ Note:")} The server MUST use HTTPS (SSL) for OTA to work.`);

    this.log.separator();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    this.log.success(`OTA assets generated in ${duration}s`);
  }

  private findLatestIPA(dir: string): string | null {
    if (!existsSync(dir)) return null;
    const fs = require("fs");
    const files = fs.readdirSync(dir)
      .filter((f: string) => f.endsWith(".ipa") || f.endsWith(".zip"))
      .map((f: string) => ({ name: f, time: fs.statSync(join(dir, f)).mtime.getTime() }))
      .sort((a: any, b: any) => b.time - a.time);

    return files.length > 0 ? join(dir, files[0].name) : null;
  }

  private generateManifest(baseUrl: string, filename: string, bundleId: string, title: string, version: string): string {
    const ipaUrl = `${baseUrl}/${filename}`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.EN">
<plist version="1.0">
<dict>
    <key>items</key>
    <array>
        <dict>
            <key>assets</key>
            <array>
                <dict>
                    <key>kind</key>
                    <string>software-package</string>
                    <key>url</key>
                    <string>${ipaUrl}</string>
                </dict>
            </array>
            <key>metadata</key>
            <dict>
                <key>bundle-identifier</key>
                <string>${bundleId}</string>
                <key>bundle-version</key>
                <string>${version}</string>
                <key>kind</key>
                <string>software</string>
                <key>title</key>
                <string>${title}</string>
            </dict>
        </dict>
    </array>
</dict>
</plist>`;
  }

  private generateHTML(baseUrl: string, title: string): string {
    const manifestUrl = `${baseUrl}/manifest.plist`;
    const installUrl = `itms-services://?action=download-manifest&url=${manifestUrl}`;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Install ${title}</title>
    <style>
        body { font-family: -apple-system, system-ui; background: #0D0E1F; color: white; text-align: center; padding: 50px 20px; }
        .card { background: #1A1B2E; padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 400px; margin: auto; border: 1px solid #2B2D4A; }
        .btn { display: inline-block; background: linear-gradient(135deg, #00D4FF, #7B2FFF); color: white; padding: 15px 40px; border-radius: 30px; text-decoration: none; font-weight: bold; margin-top: 20px; box-shadow: 0 5px 15px rgba(123, 47, 255, 0.4); }
        .logo { font-size: 50px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">📱</div>
        <h1>${title}</h1>
        <p>Wireless Installation</p>
        <a href="${installUrl}" class="btn">INSTALL APP</a>
    </div>
</body>
</html>`;
  }
}
