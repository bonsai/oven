import { Hono } from "npm:hono";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { generateImage } from "./sd-ffi";
import type { BatchItem, GenerateRequest } from "./types";

const app = new Hono();

function normalizeGenerateRequest(payload: Record<string, unknown>): GenerateRequest {
  const prompt = String(payload.prompt ?? "").trim();
  if (!prompt) {
    throw new Error("prompt is required");
  }

  const width = Number(payload.width ?? 512);
  const height = Number(payload.height ?? 512);
  const steps = payload.steps === undefined ? 8 : Number(payload.steps);
  const seed = payload.seed === undefined ? -1 : Number(payload.seed);

  return {
    prompt,
    negative: payload.negative ? String(payload.negative) : undefined,
    width: Number.isFinite(width) ? width : 512,
    height: Number.isFinite(height) ? height : 512,
    steps: Number.isFinite(steps) ? steps : 8,
    seed: Number.isFinite(seed) ? seed : -1,
    outputDir: payload.outputDir ? String(payload.outputDir) : undefined,
    modelPath: payload.modelPath ? String(payload.modelPath) : undefined,
  };
}

function parseJsonl(text: string): BatchItem[] {
  const items: BatchItem[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    items.push(normalizeGenerateRequest(parsed));
  }
  return items;
}

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/generate", async (c) => {
  try {
    const payload = (await c.req.json()) as Record<string, unknown>;
    const request = normalizeGenerateRequest(payload);
    const result = await generateImage(request);
    return c.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return c.json(
      { ok: false, error: (error as Error).message },
      400
    );
  }
});

app.post("/batch", async (c) => {
  try {
    let items: BatchItem[] = [];
    const contentType = c.req.header("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const body = await c.req.parseBody();
      const file = body.file;
      if (!(file instanceof File)) {
        throw new Error("file field is required for multipart upload");
      }
      const text = await file.text();
      items = parseJsonl(text);
    } else {
      const text = await c.req.text();
      items = parseJsonl(text);
    }

    if (items.length === 0) {
      throw new Error("no batch items provided");
    }

    const results = [];
    for (const item of items) {
      results.push(await generateImage(item));
    }

    return c.json({ ok: true, count: results.length, results });
  } catch (error) {
    return c.json(
      { ok: false, error: (error as Error).message },
      400
    );
  }
});

await mkdir(join(process.cwd(), "output"), { recursive: true });

Deno.serve({
  port: Number(Deno.env.get("PORT") ?? 3000),
}, app.fetch);

console.log("SD DLL API listening", {
  port: Number(Deno.env.get("PORT") ?? 3000),
});
