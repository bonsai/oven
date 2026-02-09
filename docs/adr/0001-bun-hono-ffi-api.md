# ADR 0001: Deno + Hono + FFI API skeleton for stable-diffusion.cpp

- Date: 2026-01-01
- Status: Accepted

## Context

We need a lightweight API server that exposes Stable Diffusion generation over HTTP without Python dependencies. The target runtime is Deno with TypeScript, and the inference backend is the `stable-diffusion.cpp` shared library (DLL/.so/.dylib). The project should also be operable when the native library is absent so that API contracts can be exercised during early development.

## Decision

- Use **Deno** as the runtime for its fast startup, built-in TypeScript, and FFI support.
- Use **Hono** for a minimal HTTP routing layer.
- Define `/generate` and `/batch` endpoints that accept JSON and JSONL respectively.
- Provide a **mock backend** that writes a placeholder image when the native library is missing or FFI is not fully implemented, so clients can still validate integrations.
- Keep the FFI bindings in a dedicated module so the native integration can be completed independently of the HTTP layer.

## Consequences

- The API is available immediately with consistent request/response structures.
- Real image generation depends on completing the FFI bindings and linking against `stable-diffusion.cpp`.
- The mock backend writes PPM outputs to `output/`, which is sufficient for smoke testing but not production use.

## Alternatives Considered

- **Node + Express**: rejected due to heavier runtime and slower cold start compared to Deno.
- **Python + FastAPI**: rejected to avoid Python dependencies and heavyweight deployment.
- **Direct CLI invocation**: rejected because it introduces process overhead and reduces throughput.
