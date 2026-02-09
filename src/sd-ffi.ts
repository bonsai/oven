import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
type DenoFFI = {
  symbols: Record<string, unknown>;
  close: () => void;
};
import type { GenerateRequest, GenerateResult } from "./types";

const DEFAULT_OUTPUT_DIR = "output";
const DEFAULT_MODEL_PATH = "models/sd.gguf";

type BackendStatus =
  | { mode: "ffi"; warning?: string }
  | { mode: "mock"; warning: string };

let cachedBackend: BackendStatus | null = null;

function resolveLibraryPath(): string {
  const envPath = Deno.env.get("SD_DLL_PATH")?.trim();
  if (envPath) {
    return envPath;
  }
  const ext =
    Deno.build.os === "windows"
      ? ".dll"
      : Deno.build.os === "darwin"
        ? ".dylib"
        : ".so";
  return join("native", `stable-diffusion${ext}`);
}

function resolveBackend(): BackendStatus {
  if (cachedBackend) {
    return cachedBackend;
  }

  const libPath = resolveLibraryPath();
  if (!existsSync(libPath)) {
    cachedBackend = {
      mode: "mock",
      warning: `Backend library not found at ${libPath}. Using mock output instead.`,
    };
    return cachedBackend;
  }

  try {
    const lib = Deno.dlopen(libPath, {
      new_sd_ctx: {
        parameters: ["pointer", "i32", "i32"],
        result: "pointer",
      },
      txt2img: {
        parameters: ["pointer", "pointer"],
        result: "pointer",
      },
      free_sd_ctx: {
        parameters: ["pointer"],
        result: "void",
      },
      free_sd_image: {
        parameters: ["pointer"],
        result: "void",
      },
    }) as DenoFFI;
    lib.close();
    cachedBackend = {
      mode: "ffi",
      warning:
        "FFI bindings are stubbed; generation will still use mock output until implementation is completed.",
    };
  } catch (error) {
    cachedBackend = {
      mode: "mock",
      warning: `Failed to load backend library: ${error instanceof Error ? error.message : String(error)}. Using mock output instead.`,
    };
  }

  return cachedBackend;
}

function seededColor(seed: number, channel: number): number {
  const value = Math.sin(seed * 12.9898 + channel * 78.233) * 43758.5453;
  return Math.floor((value - Math.floor(value)) * 255);
}

async function writeMockPpm(
  outputDir: string,
  request: GenerateRequest,
  warning: string
): Promise<GenerateResult> {
  const width = request.width ?? 512;
  const height = request.height ?? 512;
  const seed = request.seed ?? Math.floor(Math.random() * 10_000_000);
  const safeSeed = seed === -1 ? Math.floor(Math.random() * 10_000_000) : seed;

  const header = `P3\n${width} ${height}\n255\n`;
  const pixels: string[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const r = (seededColor(safeSeed + x, 1) + x) % 255;
      const g = (seededColor(safeSeed + y, 2) + y) % 255;
      const b = seededColor(safeSeed + x + y, 3);
      pixels.push(`${r} ${g} ${b}`);
    }
  }

  await mkdir(outputDir, { recursive: true });
  const filename = `mock-${Date.now()}-${safeSeed}.ppm`;
  const filePath = join(outputDir, filename);
  const content = `${header}${pixels.join(" ")}`;
  await writeFile(filePath, content, "utf8");

  return {
    outputPath: filePath,
    seed: safeSeed,
    backend: "mock",
    warning,
  };
}

export async function generateImage(
  request: GenerateRequest
): Promise<GenerateResult> {
  const outputDir = request.outputDir ?? DEFAULT_OUTPUT_DIR;
  const modelPath = request.modelPath ?? DEFAULT_MODEL_PATH;
  const backend = resolveBackend();

  if (backend.mode !== "ffi") {
    return writeMockPpm(outputDir, request, backend.warning);
  }

  return writeMockPpm(
    outputDir,
    { ...request, modelPath },
    backend.warning ?? "FFI backend selected, mock output used."
  );
}
