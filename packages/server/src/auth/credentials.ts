/**
 * 凭据安全存储。
 *
 * 优先级（见 ZJU_CAMPUS_AGENT_PROJECT.md 第 7.2 节）：
 * 1. OS Keychain（Windows: Credential Manager, macOS: Keychain, Linux: Secret Service）
 * 2. 本地加密文件（AES-256-GCM，key 由机器信息派生）
 * 3. 明文文件禁止作为默认方案
 *
 * 第一阶段实现「本地加密文件」方案，并预留 keychain 适配接口。
 * 加密 key 由 username + hostname + appDir 派生，配合 OS 文件权限 0o600。
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
  createHash,
} from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { hostname, userInfo } from "node:os";

const ALGO = "aes-256-gcm";
const PBKDF2_ITERATIONS = 200_000;
const KEY_LEN = 32;

type StoredBlob = {
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

/** 平台无关的凭据存储接口，未来 Electron/Capacitor 可注入原生实现 */
export interface CredentialStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/** 派生加密 key 的密料。机器相关，但不写入配置文件。 */
function deriveMaterial(appDir: string): string {
  const user = (() => {
    try {
      return userInfo().username;
    } catch {
      return "unknown-user";
    }
  })();
  return `${user}@${hostname()}:${appDir}:zju-campus-agent:v1`;
}

function deriveKey(material: string, salt: Buffer): Buffer {
  return pbkdf2Sync(material, salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256");
}

/** 本地加密文件凭据存储 */
export class EncryptedFileCredentialStore implements CredentialStore {
  private readonly credFile: string;

  constructor(appDir: string) {
    this.credFile = join(appDir, "credentials.enc");
    if (!existsSync(appDir)) {
      mkdirSync(appDir, { recursive: true });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const map = this.readAll();
    const raw = map[key];
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const map = this.readAll();
    map[key] = JSON.stringify(value);
    this.writeAll(map);
  }

  async delete(key: string): Promise<void> {
    const map = this.readAll();
    delete map[key];
    this.writeAll(map);
  }

  async clear(): Promise<void> {
    this.writeAll({});
  }

  private readAll(): Record<string, string> {
    if (!existsSync(this.credFile)) return {};
    try {
      const raw = readFileSync(this.credFile);
      // 文件格式: materialHash(32 hex) + json(StoredBlob map)
      const material = deriveMaterial(this.credFile);
      const expectedHash = createHash("sha256")
        .update(material)
        .digest()
        .toString("hex");
      const fileHash = raw.subarray(0, 64).toString("utf8");
      if (fileHash !== expectedHash) {
        // 机器环境变化，无法解密，返回空（提示用户重新输入凭据）
        return {};
      }
      const json = JSON.parse(raw.subarray(64).toString("utf8")) as Record<
        string,
        StoredBlob
      >;
      const out: Record<string, string> = {};
      for (const [k, blob] of Object.entries(json)) {
        const decrypted = this.decrypt(blob, material);
        if (decrypted !== null) out[k] = decrypted;
      }
      return out;
    } catch {
      return {};
    }
  }

  private writeAll(map: Record<string, string>): void {
    const material = deriveMaterial(this.credFile);
    const materialHash = createHash("sha256")
      .update(material)
      .digest()
      .toString("hex");
    const json: Record<string, StoredBlob> = {};
    for (const [k, v] of Object.entries(map)) {
      json[k] = this.encrypt(v, material);
    }
    const body = Buffer.from(JSON.stringify(json), "utf8");
    const out = Buffer.concat([Buffer.from(materialHash, "utf8"), body]);
    writeFileSync(this.credFile, out, { mode: 0o600 });
  }

  private encrypt(plain: string, material: string): StoredBlob {
    const salt = randomBytes(16);
    const key = deriveKey(material, salt);
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plain, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return {
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  private decrypt(blob: StoredBlob, material: string): string | null {
    try {
      const salt = Buffer.from(blob.salt, "base64");
      const key = deriveKey(material, salt);
      const iv = Buffer.from(blob.iv, "base64");
      const tag = Buffer.from(blob.tag, "base64");
      const ciphertext = Buffer.from(blob.ciphertext, "base64");
      const decipher = createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return plain.toString("utf8");
    } catch {
      return null;
    }
  }
}

/** 待存储的敏感凭据类型 */
export type StoredCredentials = {
  zju?: { username: string; password: string };
  modelProviders?: Array<{
    id: string;
    name: string;
    protocol: "openai" | "anthropic";
    baseUrl: string;
    apiKey: string;
    model: string;
    enabled: boolean;
  }>;
};
