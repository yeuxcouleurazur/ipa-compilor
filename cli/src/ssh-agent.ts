import { NodeSSH } from "node-ssh";
import chalk from "chalk";

interface SSHConfig {
  host: string;
  port: number;
  user: string;
  keyPath: string;
  timeout: number;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export class SSHAgent {
  private ssh: NodeSSH;
  private config: SSHConfig;
  private connected = false;

  constructor(config: SSHConfig) {
    this.ssh = new NodeSSH();
    this.config = config;
  }

  async connect(): Promise<boolean> {
    if (!this.config.host || !this.config.user) return false;
    try {
      await this.ssh.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.user,
        privateKeyPath: this.config.keyPath.replace("~", process.env.USERPROFILE || ""),
        readyTimeout: this.config.timeout * 1000,
      });
      this.connected = true;
      return true;
    } catch {
      return false;
    }
  }

  async exec(command: string): Promise<ExecResult> {
    if (!this.connected) return { code: 1, stdout: "", stderr: "Not connected" };
    try {
      const result = await this.ssh.execCommand(command);
      return {
        code: result.code ?? 0,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (err) {
      return { code: 1, stdout: "", stderr: String(err) };
    }
  }

  async syncFiles(localPath: string, remotePath: string): Promise<void> {
    if (!this.connected) return;
    await this.ssh.putDirectory(localPath, remotePath, {
      recursive: true,
      concurrency: 4,
      tick: (local, remote, error) => {
        if (error) {
          process.stdout.write(chalk.hex("#FF006E")(`  ✗ ${local}\n`));
        }
      },
    });
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      this.ssh.dispose();
      this.connected = false;
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }
}
