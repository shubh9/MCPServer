import { spawn } from "node:child_process";

export interface CallMCPOptions {
  accessToken?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
}

export async function callMCPTool(
  moduleName: string,
  toolName: string,
  args: Record<string, unknown> = {},
  options: CallMCPOptions = {}
): Promise<unknown> {
  const { accessToken, env, timeoutMs = 60_000 } = options;

  return new Promise((resolve, reject) => {
    const debug =
      process.env.DEBUG_MCP === "1" || process.env.DEBUG_MCP === "true";
    console.log(
      `[MCP] Spawning module=${moduleName} tool=${toolName} timeoutMs=${timeoutMs}`
    );

    const child = spawn("npx", ["-y", moduleName], {
      env: {
        ...process.env,
        ...(accessToken ? { ACCESS_TOKEN: accessToken } : {}),
        ...env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let timer: NodeJS.Timeout | null = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        try {
          child.kill();
        } finally {
          reject(
            new Error(
              `MCP module '${moduleName}' timed out after ${timeoutMs}ms`
            )
          );
        }
      }, timeoutMs);
    }

    // Simple JSON-RPC line protocol parser
    let stdoutBuffer = "";
    type Pending = {
      resolve: (value: any) => void;
      reject: (err: any) => void;
    };
    const pendingById = new Map<string | number, Pending>();

    const send = (msg: any) => {
      const line = JSON.stringify(msg) + "\n";
      if (debug) console.log(`[MCP] -> ${moduleName}: ${line.trim()}`);
      child.stdin.write(line);
    };

    const sendRequest = (id: string | number, method: string, params?: any) => {
      return new Promise((res, rej) => {
        pendingById.set(id, { resolve: res, reject: rej });
        send({ jsonrpc: "2.0", id, method, params });
      });
    };

    const handleMessage = (raw: string) => {
      if (!raw.trim()) return;
      try {
        const msg = JSON.parse(raw);
        if (debug) console.log(`[MCP] <- ${moduleName}: ${raw.trim()}`);
        // Handle responses
        if (msg.id !== undefined) {
          const pending = pendingById.get(msg.id);
          if (pending) {
            pendingById.delete(msg.id);
            if (msg.error) pending.reject(msg.error);
            else pending.resolve(msg.result ?? msg);
          }
        }
      } catch (e) {
        console.warn(`[MCP] Non-JSON line from ${moduleName}: ${raw.trim()}`);
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = stdoutBuffer.indexOf("\n")) >= 0) {
        const line = stdoutBuffer.slice(0, idx);
        stdoutBuffer = stdoutBuffer.slice(idx + 1);
        handleMessage(line);
      }
    });

    child.stderr.on("data", (d: Buffer) => {
      const msg = d.toString("utf8");
      console.error(`[MCP:${moduleName}] STDERR: ${msg}`);
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    // Handshake then call tool
    (async () => {
      try {
        const initId = 1;
        const callId = 2;

        // initialize
        await sendRequest(initId, "initialize", {
          protocolVersion: "2024-06-01",
          capabilities: {},
          clientInfo: { name: "mcpserver", version: "0.1.0" },
        });

        // tools/call
        const result = await sendRequest(callId, "tools/call", {
          name: toolName,
          arguments: args,
        });

        if (timer) clearTimeout(timer);
        try {
          child.stdin.end();
          child.kill();
        } catch {}
        resolve(result);
      } catch (err) {
        if (timer) clearTimeout(timer);
        try {
          child.stdin.end();
          child.kill();
        } catch {}
        reject(err);
      }
    })();
  });
}
