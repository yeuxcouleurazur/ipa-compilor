import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { z } from "zod";
import chalk from "chalk";

export const IPAConfig = z.object({
  version: z.string().default("2.0.0"),
  project: z.object({
    name: z.string().default("MyApp"),
    bundleId: z.string().default("com.example.myapp"),
    version: z.string().default("1.0.0"),
    buildNumber: z.number().default(1),
    deploymentTarget: z.string().default("16.0"),
    swiftVersion: z.string().default("5.9"),
    teamId: z.string().default(""),
  }).default({}),
  buildAgent: z.object({
    mode: z.enum(["auto", "local", "remote", "docker"]).default("auto"),
    ssh: z.object({
      host: z.string().default(""),
      port: z.number().default(22),
      user: z.string().default(""),
      keyPath: z.string().default("~/.ssh/id_rsa"),
      timeout: z.number().default(30),
    }).default({}),
    docker: z.object({
      image: z.string().default("sickcodes/docker-osx:latest"),
      port: z.number().default(5900),
      cpus: z.number().default(4),
      memory: z.string().default("8g"),
    }).default({}),
    remotePath: z.string().default("~/ipa-compilor"),
  }).default({}),
  signing: z.object({
    certName: z.string().default(""),
    certPath: z.string().default(""),
    profilePath: z.string().default(""),
    profileId: z.string().default(""),
    exportMethod: z.enum(["app-store", "ad-hoc", "development", "enterprise"]).default("ad-hoc"),
    keychain: z.string().default("login"),
  }).default({}),
  build: z.object({
    configuration: z.enum(["Debug", "Release"]).default("Release"),
    arch: z.array(z.string()).default(["arm64"]),
    sdk: z.string().default("iphoneos"),
    cacheEnabled: z.boolean().default(true),
    cacheDir: z.string().default("artifacts/cache"),
    parallelJobs: z.number().default(4),
    incrementalBuild: z.boolean().default(true),
  }).default({}),
  output: z.object({
    dir: z.string().default("artifacts/builds"),
    archiveDir: z.string().default("artifacts/archives"),
    ipaDir: z.string().default("artifacts/ipa"),
    logsDir: z.string().default("artifacts/logs"),
  }).default({}),
  notifications: z.object({
    enabled: z.boolean().default(false),
    webhookUrl: z.string().default(""),
  }).default({}),
  github: z.object({
    token: z.string().default(""),
    owner: z.string().default(""),
    repo: z.string().default(""),
  }).default({}),
  appetize: z.object({
    token: z.string().default(""),
  }).default({}),
});

export type IPAConfigType = z.infer<typeof IPAConfig>;

export class ConfigManager {
  private configPath: string;
  private config: IPAConfigType;

  constructor() {
    this.configPath = join(process.cwd(), "config", "ipa-compilor.yaml");
    this.config = this.load();
  }

  private load(): IPAConfigType {
    if (existsSync(this.configPath)) {
      try {
        const raw = readFileSync(this.configPath, "utf-8");
        const parsed = yamlParse(raw);
        return IPAConfig.parse(parsed);
      } catch (e) {
        console.warn(chalk.yellow(`  ⚠ Config parse error, using defaults: ${(e as Error).message}`));
      }
    }
    return IPAConfig.parse({});
  }

  save(): void {
    mkdirSync(join(process.cwd(), "config"), { recursive: true });
    writeFileSync(this.configPath, yamlStringify(this.config), "utf-8");
  }

  get<K extends keyof IPAConfigType>(key: K): IPAConfigType[K] {
    return this.config[key];
  }

  set<K extends keyof IPAConfigType>(key: K, value: IPAConfigType[K]): void {
    this.config[key] = value;
    this.save();
  }

  getAll(): IPAConfigType {
    return this.config;
  }

  async interactive(opts: Record<string, string>): Promise<void> {
    const c = chalk;
    console.log(`\n  ${c.hex("#00D4FF")("◈")} ${c.white("Configuration Wizard")}\n`);
    if (opts.sshHost !== undefined) this.config.buildAgent.ssh.host = opts.sshHost;
    if (opts.sshUser !== undefined) this.config.buildAgent.ssh.user = opts.sshUser;
    if (opts.sshKey !== undefined) this.config.buildAgent.ssh.keyPath = opts.sshKey;
    if (opts.teamId !== undefined) this.config.project.teamId = opts.teamId;
    if (opts.bundleId !== undefined) this.config.project.bundleId = opts.bundleId;
    if (opts.githubToken !== undefined) this.config.github.token = opts.githubToken;
    if (opts.appetizeToken !== undefined) this.config.appetize.token = opts.appetizeToken;
    if (opts.githubRepo) {
      const parts = opts.githubRepo.split("/");
      if (parts.length === 2 && parts[0] && parts[1]) {
        this.config.github.owner = parts[0];
        this.config.github.repo = parts[1];
      }
    }
    this.save();
    console.log(`\n  ${c.hex("#00FF88")("✓")} ${c.white("Config saved →")} ${c.hex("#7B2FFF")(this.configPath)}\n`);
  }

  get sshConfig() { return this.config.buildAgent.ssh; }
  get signingConfig() { return this.config.signing; }
  get buildConfig() { return this.config.build; }
  get projectConfig() { return this.config.project; }
  get outputConfig() { return this.config.output; }
  get agentMode() { return this.config.buildAgent.mode; }
}
