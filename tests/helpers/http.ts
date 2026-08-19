import { spawn, execSync, type ChildProcess } from "node:child_process";
import { existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";

/** Minimaler Cookie-Jar für die End-to-End-Tests. */
export class CookieJar {
  private cookies = new Map<string, string>();

  absorb(response: Response): void {
    const raw = response.headers.getSetCookie?.() ?? [];
    for (const entry of raw) {
      const [pair] = entry.split(";");
      const index = pair!.indexOf("=");
      if (index < 0) continue;
      const name = pair!.slice(0, index).trim();
      const value = pair!.slice(index + 1).trim();
      if (value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  clear(): void {
    this.cookies.clear();
  }
}

export type TestClient = {
  jar: CookieJar;
  get(path: string, init?: RequestInit): Promise<Response>;
  post(path: string, body?: unknown, init?: RequestInit): Promise<Response>;
  patch(path: string, body?: unknown): Promise<Response>;
  json<T>(response: Response): Promise<T>;
};

export function createClient(baseUrl: string): TestClient {
  const jar = new CookieJar();

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    const cookieHeader = jar.header();
    if (cookieHeader) headers.set("cookie", cookieHeader);

    const response = await fetch(`${baseUrl}${path}`, { ...init, headers, redirect: "manual" });
    jar.absorb(response);
    return response;
  }

  function send(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    // Double-Submit-Token aus dem Cookie mitsenden.
    const csrf = jar.get("gb_csrf");
    if (csrf && !headers.has("x-csrf-token")) headers.set("x-csrf-token", decodeURIComponent(csrf));
    return request(path, { ...init, method, headers, body: JSON.stringify(body ?? {}) });
  }

  return {
    jar,
    get: (path, init) => request(path, { ...init, method: "GET" }),
    post: (path, body, init) => send("POST", path, body, init),
    patch: (path, body) => send("PATCH", path, body),
    json: async <T>(response: Response) => (await response.json()) as T,
  };
}

/** Neu bauen, wenn der Build fehlt oder Quelldateien neuer sind. */
function needsBuild(): boolean {
  if (!existsSync(".next/BUILD_ID")) return true;

  const buildTime = statSync(".next/BUILD_ID").mtimeMs;
  const newest = (dir: string): number => {
    let latest = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      latest = Math.max(latest, entry.isDirectory() ? newest(full) : statSync(full).mtimeMs);
    }
    return latest;
  };

  const sources = ["src", "prisma/schema.prisma", "next.config.ts", "package.json"].filter((p) =>
    existsSync(p),
  );
  const newestSource = Math.max(
    ...sources.map((p) => (statSync(p).isDirectory() ? newest(p) : statSync(p).mtimeMs)),
  );

  return newestSource > buildTime;
}

/** Startet `next start` mit Testkonfiguration und wartet auf Erreichbarkeit. */
export async function startServer(port: number): Promise<{ url: string; stop: () => void }> {
  if (needsBuild()) {
    execSync("npx next build", { stdio: "pipe" });
  }

  const url = `http://127.0.0.1:${port}`;
  const child: ChildProcess = spawn("npx", ["next", "start", "-p", String(port), "-H", "127.0.0.1"], {
    // Eigene Prozessgruppe, damit am Ende auch Kindprozesse beendet werden.
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      APP_URL: url,
      PORT: String(port),
    },
    stdio: "pipe",
  });

  const logs: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => logs.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => logs.push(chunk.toString()));

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health-check-probe`, { redirect: "manual" });
      if (response.status > 0) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  if (child.exitCode !== null) {
    throw new Error(`Server konnte nicht starten:\n${logs.join("")}`);
  }

  return {
    url,
    stop: () => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    },
  };
}
