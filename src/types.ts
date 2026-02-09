export type GenerateRequest = {
  prompt: string;
  negative?: string;
  steps?: number;
  width?: number;
  height?: number;
  seed?: number;
  outputDir?: string;
  modelPath?: string;
};

export type GenerateResult = {
  outputPath: string;
  seed: number;
  backend: "mock" | "ffi";
  warning?: string;
};

export type BatchItem = GenerateRequest & { id?: string };
