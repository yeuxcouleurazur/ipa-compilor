import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { join, relative, resolve } from "path";
import crypto from "crypto";

export class BuildCache {
  private cacheDir = "artifacts/cache";
  private indexPath: string;
  private index: Record<string, { hash: string; path: string; ts: number }>;

  constructor() {
    this.indexPath = join(this.cacheDir, "index.json");
    this.index = this.loadIndex();
    mkdirSync(this.cacheDir, { recursive: true });
  }

  private loadIndex(): Record<string, { hash: string; path: string; ts: number }> {
    try {
      if (existsSync(this.indexPath)) {
        return JSON.parse(readFileSync(this.indexPath, "utf-8"));
      }
    } catch {}
    return {};
  }

  private saveIndex(): void {
    writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  private hashSource(projectDir: string): string {
    const root = resolve(projectDir);
    if (!existsSync(root)) return crypto.randomBytes(8).toString("hex");
    const hash = crypto.createHash("sha256");
    hash.update(root);
    const walk = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, f.name);
        if (f.isDirectory()) {
          if ([".git", "node_modules", ".build", "DerivedData", "build"].includes(f.name)) continue;
          walk(p);
        } else if (
          f.name.endsWith(".swift") ||
          f.name.endsWith(".plist") ||
          f.name === "project.pbxproj" ||
          f.name === "Package.swift"
        ) {
          hash.update(relative(root, p));
          hash.update(readFileSync(p));
        }
      }
    };
    walk(root);
    return hash.digest("hex").slice(0, 16);
  }

  async check(configuration: string, projectDir = "swift-project"): Promise<string | null> {
    const hash = this.hashSource(projectDir);
    const key = `${configuration}-${hash}`;
    const entry = this.index[key];
    if (entry && existsSync(entry.path)) {
      return entry.path;
    }
    return null;
  }

  async store(configuration: string, ipaPath: string, projectDir = "swift-project"): Promise<void> {
    const hash = this.hashSource(projectDir);
    const key = `${configuration}-${hash}`;
    this.index[key] = { hash, path: ipaPath, ts: Date.now() };
    // Evict entries older than 7 days (keep max 20)
    const entries = Object.entries(this.index).sort((a, b) => b[1].ts - a[1].ts);
    const fresh = entries.filter(([, v]) => Date.now() - v.ts < 7 * 24 * 3600 * 1000).slice(0, 20);
    this.index = Object.fromEntries(fresh);
    this.saveIndex();
  }

  clear(): void {
    this.index = {};
    this.saveIndex();
  }

  get size(): number {
    return Object.keys(this.index).length;
  }
}
