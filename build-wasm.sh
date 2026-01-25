#!/bin/bash
set -e

# Build PsdDiff WASM module using Qt for WebAssembly

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/.target/wasm"
OUTPUT_DIR="${SCRIPT_DIR}/public/wasm"

# Check for Qt WASM installation
if [ -z "$QT_WASM_PATH" ]; then
    # Try common locations
    if [ -d "$HOME/Qt/6.8.0/wasm_singlethread" ]; then
        QT_WASM_PATH="$HOME/Qt/6.8.0/wasm_singlethread"
    elif [ -d "$HOME/Qt/6.8.0/wasm_multithread" ]; then
        QT_WASM_PATH="$HOME/Qt/6.8.0/wasm_multithread"
    else
        echo "Error: Qt for WebAssembly not found."
        echo "Set QT_WASM_PATH environment variable or install Qt for WebAssembly."
        exit 1
    fi
fi

echo "Using Qt WASM at: $QT_WASM_PATH"

# Check for Emscripten
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten not found. Please activate emsdk."
    echo "  source /path/to/emsdk/emsdk_env.sh"
    exit 1
fi

echo "Using Emscripten: $(emcc --version | head -n1)"

# Create build directory
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Configure with CMake
echo "Configuring..."
"$QT_WASM_PATH/bin/qt-cmake" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_PREFIX_PATH="$QT_WASM_PATH" \
    "$SCRIPT_DIR"

# Build
echo "Building..."
cmake --build . --parallel

# Copy output to public directory
mkdir -p "$OUTPUT_DIR"
cp psddiff_wasm.js "$OUTPUT_DIR/" 2>/dev/null || true
cp psddiff_wasm.wasm "$OUTPUT_DIR/" 2>/dev/null || true
cp psddiff_wasm.worker.js "$OUTPUT_DIR/" 2>/dev/null || true

echo "Build complete. Output in: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"
