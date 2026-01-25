// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

/// <reference lib="webworker" />

import type { WorkerRequest, WorkerResponse, PsdData, RenderedImage, LayerInfo } from '../lib/types';

declare const self: DedicatedWorkerGlobalScope;

interface PsdDiffModule {
  allocateBuffer(size: number): void;
  getBufferView(): Uint8Array;
  parsePsd(dataSize: number): {
    handle?: number;
    width?: number;
    height?: number;
    channels?: number;
    depth?: number;
    colorMode?: string;
    layers?: LayerInfo[];
    error?: string;
  };
  renderCompositeWithVisibility(handle: number, hiddenLayerIds: number[], shownLayerIds: number[]): {
    width?: number;
    height?: number;
    data?: Uint8ClampedArray;
    error?: string;
    // Debug info
    debug_parserState?: string;
    renderedLayers?: number;
    totalRecords?: number;
    hiddenCount?: number;
    shownCount?: number;
    skippedGroup?: number;
    skippedHidden?: number;
    skippedInvisible?: number;
    skippedEmptyRect?: number;
    skippedEmptyData?: number;
  };
  renderLayer(handle: number, layerIndex: number): {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    data?: Uint8ClampedArray | null;
    error?: string;
  };
  releaseParser(handle: number): void;
}

let wasmModule: PsdDiffModule | null = null;

// Store parser handles on JavaScript side
const parserHandles: { A: number | null; B: number | null } = { A: null, B: null };

// Generation counter to detect stale render requests
const parserGeneration: { A: number; B: number } = { A: 0, B: 0 };

async function loadWasmModule(): Promise<PsdDiffModule> {
  const response = await fetch('/wasm/psddiff_wasm.js');
  const scriptText = await response.text();

  const scriptFunc = new Function(scriptText + '\nreturn psddiff_wasm_entry;');
  const factory = scriptFunc() as (options?: Record<string, unknown>) => Promise<PsdDiffModule>;

  return await factory({
    locateFile: (path: string) => `/wasm/${path}`
  });
}

async function initWasm(): Promise<void> {
  if (wasmModule) return;

  try {
    wasmModule = await loadWasmModule();
    postResponse({ type: 'ready' });
  } catch (error) {
    postResponse({
      type: 'error',
      message: `Failed to initialize WASM module: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

function postResponse(response: WorkerResponse): void {
  self.postMessage(response);
}

function parsePsd(file: 'A' | 'B', data: ArrayBuffer): void {
  if (!wasmModule) {
    postResponse({ type: 'error', message: 'WASM module not initialized' });
    return;
  }

  try {
    // Increment generation to invalidate any pending renders
    parserGeneration[file]++;

    // Release previous parser if exists
    if (parserHandles[file] !== null) {
      console.log('[Worker] Releasing handle', { file, handle: parserHandles[file] });
      wasmModule.releaseParser(parserHandles[file]!);
      parserHandles[file] = null;
    }

    // Allocate buffer and copy data
    const bytes = new Uint8Array(data);
    wasmModule.allocateBuffer(bytes.length);
    const bufferView = wasmModule.getBufferView();
    bufferView.set(bytes);

    const result = wasmModule.parsePsd(bytes.length);


    if (result.error) {
      postResponse({ type: 'error', message: `Failed to parse PSD: ${result.error}` });
      return;
    }

    if (!result.handle) {
      postResponse({ type: 'error', message: 'Failed to parse PSD: no handle returned' });
      return;
    }

    // Store handle on JavaScript side
    parserHandles[file] = result.handle;
    console.log('[Worker] parsePsd complete', { file, handle: result.handle, parserHandles: { ...parserHandles } });

    const psdData: PsdData = {
      parserId: result.handle,
      width: result.width!,
      height: result.height!,
      channels: result.channels!,
      depth: result.depth!,
      colorMode: result.colorMode as PsdData['colorMode'],
      layers: result.layers || []
    };

    postResponse({ type: 'parsed', file, data: psdData });
  } catch (error) {
    postResponse({
      type: 'error',
      message: `Failed to parse PSD: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

function renderCompositeWithVisibility(file: 'A' | 'B', hiddenLayerIds: number[], shownLayerIds: number[]): void {
  if (!wasmModule) {
    postResponse({ type: 'error', message: 'WASM module not initialized' });
    return;
  }

  const handle = parserHandles[file];
  if (handle === null) {
    postResponse({ type: 'error', message: `No PSD loaded for file ${file}` });
    return;
  }

  console.log('[Worker] renderCompositeWithVisibility called', {
    file,
    handle,
    parserHandles: { ...parserHandles },
    generation: parserGeneration[file],
    hiddenLayerIds,
    shownLayerIds
  });

  try {
    // Verify handle is still valid (might have changed due to race condition)
    const currentHandle = parserHandles[file];
    if (currentHandle !== handle) {
      console.warn('[Worker] Handle changed during render, skipping', { original: handle, current: currentHandle });
      // Just return silently - a new render will be triggered with the correct handle
      return;
    }

    const result = wasmModule.renderCompositeWithVisibility(handle, hiddenLayerIds, shownLayerIds);

    console.log('[Worker] WASM result:', {
      error: result.error,
      debug_parserState: result.debug_parserState,
      width: result.width,
      height: result.height,
      renderedLayers: result.renderedLayers,
      hiddenCount: result.hiddenCount,
      shownCount: result.shownCount,
      hasData: !!result.data,
      dataLength: result.data?.length
    });

    if (result.error) {
      // Check if this is a stale render (handle was released)
      if (result.error.includes('Invalid parser handle') && parserHandles[file] !== handle) {
        console.warn('[Worker] Stale render detected, ignoring error');
        return;
      }
      postResponse({ type: 'error', message: `Failed to render composite: ${result.error}`, file, operation: 'renderComposite' });
      return;
    }

    if (!result.data) {
      postResponse({ type: 'error', message: 'Failed to render composite: no data' });
      return;
    }

    const image: RenderedImage = {
      width: result.width!,
      height: result.height!,
      data: result.data
    };

    postResponse({ type: 'rendered', file, image });
  } catch (error) {
    postResponse({
      type: 'error',
      message: `Failed to render composite: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

function renderLayer(file: 'A' | 'B', layerIndex: number): void {
  if (!wasmModule) {
    postResponse({ type: 'error', message: 'WASM module not initialized' });
    return;
  }

  const handle = parserHandles[file];
  if (handle === null) {
    postResponse({ type: 'error', message: `No PSD loaded for file ${file}` });
    return;
  }

  try {
    const result = wasmModule.renderLayer(handle, layerIndex);

    if (result.error) {
      postResponse({ type: 'error', message: `Failed to render layer: ${result.error}` });
      return;
    }

    const image: RenderedImage = {
      width: result.width || 0,
      height: result.height || 0,
      x: result.x,
      y: result.y,
      data: result.data || null
    };

    postResponse({ type: 'rendered', file, image, layerIndex });
  } catch (error) {
    postResponse({
      type: 'error',
      message: `Failed to render layer: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

function releaseParser(file: 'A' | 'B'): void {
  if (!wasmModule) return;

  const handle = parserHandles[file];
  if (handle !== null) {
    wasmModule.releaseParser(handle);
    parserHandles[file] = null;
  }

  postResponse({ type: 'released', file });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  switch (request.type) {
    case 'init':
      await initWasm();
      break;
    case 'parse':
      parsePsd(request.file, request.data);
      break;
    case 'renderCompositeWithVisibility':
      renderCompositeWithVisibility(request.file, request.hiddenLayerIds, request.shownLayerIds);
      break;
    case 'renderLayer':
      renderLayer(request.file, request.layerIndex);
      break;
    case 'release':
      releaseParser(request.file);
      break;
  }
};

initWasm();
