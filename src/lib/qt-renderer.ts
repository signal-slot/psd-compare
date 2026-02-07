// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT
//
// Qt Renderer - Main thread module for full Qt rendering with effects and fonts
// Uses QGuiApplication which requires DOM access (cannot run in Web Worker)

import type { RenderedImage, LayerInfo } from './types';

interface PsdQtModule {
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
  };
  renderCompositeWithQt(handle: number, hiddenLayerIds: number[], shownLayerIds: number[]): {
    width?: number;
    height?: number;
    data?: Uint8ClampedArray;
    error?: string;
    renderedLayers?: number;
    renderMode?: string;
  };
  releaseParser(handle: number): void;
  // Font registration
  allocateFontBuffer(size: number): void;
  getFontBufferView(): Uint8Array;
  registerFont(dataSize: number, filename: string): {
    fontId?: number;
    families?: string[];
    error?: string;
  };
  getRegisteredFonts(): string[];
}

class QtRenderer {
  private module: PsdQtModule | null = null;
  private initPromise: Promise<void> | null = null;
  private parserHandles: Map<string, number> = new Map();
  // Store PSD data for each file to allow re-parsing for Qt mode
  private psdDataCache: Map<string, ArrayBuffer> = new Map();

  async initialize(): Promise<void> {
    if (this.module) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.loadModule();
    return this.initPromise;
  }

  private async loadModule(): Promise<void> {
    try {
      const cacheBuster = Date.now();
      const response = await fetch(`/wasm/psddiff_qt.js?v=${cacheBuster}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch Qt WASM module: ${response.status}`);
      }

      const scriptText = await response.text();

      // The module exports psddiff_qt_entry factory (from Emscripten build)
      const scriptFunc = new Function(scriptText + '\nreturn psddiff_qt_entry;');
      const factory = scriptFunc() as (options?: Record<string, unknown>) => Promise<PsdQtModule>;

      this.module = await factory({
        locateFile: (path: string) => `/wasm/${path}?v=${cacheBuster}`
      });

      console.log('[QtRenderer] Module initialized');
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  isReady(): boolean {
    return this.module !== null;
  }

  // Cache PSD data for later re-parsing
  cachePsdData(file: string, data: ArrayBuffer): void {
    // Release existing parser handle if any (new file replaces old)
    const existingHandle = this.parserHandles.get(file);
    if (existingHandle !== undefined && this.module) {
      this.module.releaseParser(existingHandle);
      this.parserHandles.delete(file);
      console.log('[QtRenderer] Released old handle for file reload:', file);
    }
    this.psdDataCache.set(file, data);
  }

  // Parse PSD in Qt module (needed to get handle for Qt rendering)
  async parsePsd(file: string): Promise<number> {
    await this.initialize();

    if (!this.module) {
      throw new Error('Qt module not initialized');
    }

    const data = this.psdDataCache.get(file);
    if (!data) {
      throw new Error(`No PSD data cached for file ${file}`);
    }

    // Release previous parser if exists
    const existingHandle = this.parserHandles.get(file);
    if (existingHandle !== undefined) {
      this.module.releaseParser(existingHandle);
      this.parserHandles.delete(file);
    }

    // Allocate buffer and copy data
    const bytes = new Uint8Array(data);
    this.module.allocateBuffer(bytes.length);
    const bufferView = this.module.getBufferView();
    bufferView.set(bytes);

    const result = this.module.parsePsd(bytes.length);

    if (result.error) {
      throw new Error(`Failed to parse PSD in Qt module: ${result.error}`);
    }

    if (!result.handle) {
      throw new Error('Failed to parse PSD in Qt module: no handle returned');
    }

    this.parserHandles.set(file, result.handle);
    console.log('[QtRenderer] Parsed PSD', { file, handle: result.handle });

    return result.handle;
  }

  async renderCompositeWithQt(
    file: string,
    hiddenLayerIds: number[],
    shownLayerIds: number[]
  ): Promise<RenderedImage> {
    await this.initialize();

    if (!this.module) {
      throw new Error('Qt module not initialized');
    }

    // Get or create handle for this file
    let handle = this.parserHandles.get(file);
    if (handle === undefined) {
      handle = await this.parsePsd(file);
    }

    console.log('[QtRenderer] renderCompositeWithQt', {
      file,
      handle,
      hiddenLayerIds,
      shownLayerIds
    });

    const result = this.module.renderCompositeWithQt(handle, hiddenLayerIds, shownLayerIds);

    if (result.error) {
      throw new Error(`Failed to render with Qt: ${result.error}`);
    }

    if (!result.data) {
      throw new Error('Failed to render with Qt: no data');
    }

    console.log('[QtRenderer] Render complete', {
      width: result.width,
      height: result.height,
      renderedLayers: result.renderedLayers
    });

    return {
      width: result.width!,
      height: result.height!,
      data: result.data
    };
  }

  async registerFont(data: ArrayBuffer, filename: string): Promise<{ fontId: number; families: string[] }> {
    await this.initialize();

    if (!this.module) {
      throw new Error('Qt module not initialized');
    }

    const bytes = new Uint8Array(data);
    this.module.allocateFontBuffer(bytes.length);
    const bufferView = this.module.getFontBufferView();
    bufferView.set(bytes);

    const result = this.module.registerFont(bytes.length, filename);

    if (result.error) {
      throw new Error(`Failed to register font: ${result.error}`);
    }

    console.log('[QtRenderer] Font registered', { fontId: result.fontId, families: result.families });

    return {
      fontId: result.fontId!,
      families: result.families || []
    };
  }

  getRegisteredFonts(): string[] {
    if (!this.module) {
      return [];
    }
    return this.module.getRegisteredFonts();
  }

  release(file: string): void {
    if (!this.module) return;

    const handle = this.parserHandles.get(file);
    if (handle !== undefined) {
      this.module.releaseParser(handle);
      this.parserHandles.delete(file);
    }

    this.psdDataCache.delete(file);
  }

  // Invalidate cached handles so next render will re-parse with new fonts
  invalidateForFonts(): void {
    if (!this.module) return;

    // Release all parsers - they will be re-created on next render
    for (const [file, handle] of this.parserHandles) {
      this.module.releaseParser(handle);
      console.log('[QtRenderer] Released handle for font refresh:', file);
    }
    this.parserHandles.clear();
  }
}

// Singleton instance
export const qtRenderer = new QtRenderer();
