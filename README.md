# PSD Diff

A browser-based PSD file comparison tool that visualizes differences between two PSD files. All processing happens client-side - **no files are uploaded to any server**.

## Features

- **Swipe Comparison**: Drag divider to compare before/after with proper zoom/pan support
- **Crossfade Comparison**: True pixel-level blending (no darkening at 50%)
- **Layer Tree**: View layer structure with diff highlighting (added/removed/modified)
- **Layer Visibility Toggle**: Show/hide individual layers to isolate changes
- **Client-Side Only**: PSD files never leave your browser
- **WASM-Powered**: Uses QtPsd compiled to WebAssembly for accurate PSD parsing

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **PSD Parsing**: [QtPsd](https://github.com/signal-slot/qtpsd) (Qt-based PSD parser)
- **WASM**: Emscripten + Embind (59 statically-linked plugins)
- **State Management**: Zustand

## Prerequisites

- Node.js 18+
- Qt 6.8+ for WebAssembly (single-threaded)
- Emscripten 4.0+

## Building

### 1. Install dependencies

```bash
npm install
```

### 2. Build WASM module

```bash
# Set up Emscripten environment
source /path/to/emsdk/emsdk_env.sh

# Set Qt WASM path
export QT_WASM_PATH=/path/to/qt/wasm_singlethread

# Build (uses qt-cmake internally)
./build-wasm.sh
```

### 3. Run development server

```bash
npm run dev
```

## Usage

1. Open the application in your browser
2. Drop or select the "Before" PSD file (A)
3. Drop or select the "After" PSD file (B)
4. Use the comparison controls:
   - **Swipe**: Drag the divider left/right
   - **Crossfade**: Adjust the slider to blend between images
   - **Zoom**: Mouse wheel
   - **Pan**: Click and drag

## Architecture

```
Browser
├── UI (React + Zustand)
│   ├── FileDropZone
│   ├── LayerTree (diff highlighting)
│   ├── SwipeCompare
│   └── CrossfadeCompare
│
├── psd-engine (Worker communication)
├── diff-engine (Layer diff computation)
│
└── Web Worker
    └── QtPsd WASM Module
        ├── PSD Parser
        ├── Layer Compositor
        └── Static Plugins (59 parsers)
            ├── luni (Unicode layer names)
            ├── lsct (Section dividers/groups)
            ├── lyid (Layer IDs)
            └── ...
```

## License

LGPL-3.0-only OR GPL-2.0-only OR GPL-3.0-only

Copyright (C) 2025 Signal Slot Inc.
