# SD-DLL-API - Bun + Hono + stable-diffusion.cpp DLL

Bun + Hono で超軽量APIサーバーを立て、**stable-diffusion.cpp** のDLL（C++バックエンド）をBunのFFIで直接呼び出してStable Diffusion（SD/Fluxなど）をローカルで爆速生成するプロジェクト。

- **TypeScript** 統一（Bunネイティブ）
- **モバイルファースト**（PWA対応可能）
- **量産特化**：JSONLでバッチプロンプト投入 → 並列/逐次生成
- **Python不要**（torch/diffusers 依存ゼロ）
- **GPU対応**：Vulkan / CUDA / Metal（環境による）

## 特徴

- 起動が爆速（Bunの軽さ）
- stable-diffusion.cpp DLL を Bun:ffi で直接呼ぶ → オーバーヘッドほぼゼロ
- Flux.1 schnell / SDXL-Turbo / LCM 系で1枚数秒レベルの量産が可能
- スマホブラウザ/PWAからアクセス → ホーム画面追加でネイティブアプリ風
- JSONLアップロードで数百〜数千枚の自動生成

## 動作環境（2026年現在推奨）

- OS: Windows 10/11（DLLビルドが一番安定）、Linux、macOS（Metal）
- GPU: NVIDIA（CUDA）、AMD（Vulkan/hipBLAS）、Apple Silicon（Metal）
- RAM: 16GB以上（モデルによる）
- Bun: 1.1.x 以上
- stable-diffusion.cpp: 最新master（leejet/stable-diffusion.cpp）

## クイックスタート

### 1. stable-diffusion.cpp のDLLをビルド


# リポジトリクローン（--recursive必須）
git clone --recursive https://github.com/leejet/stable-diffusion.cpp
cd stable-diffusion.cpp

# Windows (Visual Studio + CMake + Ninja推奨)
mkdir build
cd build
cmake .. -G "Ninja" -DCMAKE_BUILD_TYPE=Release -DSD_VULKAN=ON   # または -DSD_CUDA=ON / -DSD_METAL=ON
ninja

# → build/bin/Release/stable-diffusion.dll（または .so / .dylib）が出力される
# モデルをgguf形式に変換（必要なら）
# python convert.py --outfile models/sd-v1-5.gguf models/sd-v1-5.safetensors
注意: Windowsの場合、pre-builtバイナリ（cudart-sd-bin-win-*.zip など）をGitHub Releasesから落として展開してもOK。
2. このプロジェクトをセットアップ
Bashbun create hono sd-dll-api
cd sd-dll-api

# 依存インストール
bun add hono @hono/zod-validator zod
bun add -D @types/bun

# stable-diffusion.dll をプロジェクト直下に配置（またはパス指定）
# 例: ./native/stable-diffusion.dll
3. 起動
Bashbun run dev
# → http://localhost:3000
4. モバイルで試す

ブラウザでアクセス → PWAインストール（manifest対応）
JSONLファイルをスマホからアップロード → 量産スタート

プロジェクト構造
textsd-dll-api/
├── src/
│   └── index.ts          # Hono APIサーバー
├── native/
│   └── stable-diffusion.dll   # ビルドしたDLLをここに置く
├── public/
│   └── index.html        # 簡易フロント（またはVite + React TSと連携）
├── prompts.jsonl         # 量産用サンプルJSONL
├── bunfig.toml
└── README.md
APIエンドポイント例

POST /generate
単発生成（promptをJSONで送る）JSON{
  "prompt": "a sexy girl riding a horse on mars, cinematic",
  "negative": "blur, low quality",
  "steps": 8,
  "width": 512,
  "height": 512,
  "seed": -1
}
POST /batch
JSONLファイルアップロードでバッチ生成jsonl{"prompt": "cyberpunk city night", "steps": 6}
{"prompt": "beautiful anime girl", "seed": 123}
レスポンス: 生成画像を ./output/ に保存し、パス or base64 を返す

Bun:ffi でDLL呼び出し例（src/sd-ffi.ts）
TypeScriptimport { dlopen, FFIType, suffix, CString } from 'bun:ffi'

const libPath = `./native/stable-diffusion${suffix === 'dll' ? '.dll' : suffix}`

const sd = dlopen(libPath, {
  // 実際の関数シグネチャは stable-diffusion.h を参照して定義
  new_sd_ctx: {
    args: [CString /* model_path */, /* 他のパラメータ */],
    returns: FFIType.ptr,
  },
  txt2img: {
    args: [FFIType.ptr /* ctx */, CString /* prompt */, /* ... */],
    returns: FFIType.ptr, // sd_image_t*
  },
  // free_sd_image, free_sd_ctx なども定義
})

export function generateImage(prompt: string): string {
  // 実際の呼び出し例（擬似コード）
  const ctx = sd.symbols.new_sd_ctx('models/sd.gguf', /* ... */)
  const image = sd.symbols.txt2img(ctx, prompt, /* ... */)
  // imageデータを処理してファイル保存 or base64化
  // ...
  return '/output/generated.png'
}
注意: 実際の関数定義は stable-diffusion.h を確認し、ポインタ/構造体の扱いに注意（Bun:ffiは実験的）。
量産Tips

Turbo/Lightning/Schnellモデル推奨（steps=4〜8）
並列生成: BunのWorker Threads + Promise.allSettled
進捗: WebSocketエンドポイント追加（hono ws）
保存: output/ にタイムスタンプ付きPNG保存（メタデータにプロンプト埋め込み）

トラブルシューティング

DLLが見つからない → パス絶対指定 or 作業ディレクトリ確認
FFIエラー → stable-diffusion.h のシグネチャを正確に
GPU使えない → ビルド時に -DSD_CUDA=ON など指定
モバイルで遅い → 生成はサーバー側、スマホはプレビュー/ダウンロードだけ

今後の予定

React + Vite + TS のフルフロント統合
PWA manifest & service worker
Flux.1 / Qwen-Image 対応強化
キューシステム（簡易Redis or in-memory）

ライセンス
MIT（stable-diffusion.cpp のライセンスに従う）
Happy generating! 🚀
