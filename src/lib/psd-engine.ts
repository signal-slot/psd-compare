// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import type { WorkerRequest, WorkerResponse, PsdData, RenderedImage, FileSlot, RenderMode } from './types';
import { qtRenderer } from './qt-renderer';

type ResponseHandler = (response: WorkerResponse) => void;

class PsdEngine {
  private worker: Worker | null = null;
  private isReady = false;
  private readyPromise: Promise<void> | null = null;
  private pendingCallbacks: Map<string, ResponseHandler[]> = new Map();
  // Cache PSD data for Qt renderer
  private psdDataCache: Map<FileSlot, ArrayBuffer> = new Map();

  async initialize(): Promise<void> {
    if (this.worker) {
      return this.readyPromise!;
    }

    this.worker = new Worker(
      new URL('../worker/psd.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.readyPromise = new Promise((resolve, reject) => {
      const onReady = (response: WorkerResponse) => {
        if (response.type === 'ready') {
          this.isReady = true;
          resolve();
        } else if (response.type === 'error') {
          reject(new Error(response.message));
        }
      };

      this.addCallback('init', onReady);
    });

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleResponse(event.data);
    };

    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
    };

    this.postMessage({ type: 'init' });

    return this.readyPromise;
  }

  private postMessage(request: WorkerRequest): void {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    this.worker.postMessage(request);
  }

  private addCallback(key: string, callback: ResponseHandler): void {
    const callbacks = this.pendingCallbacks.get(key) || [];
    callbacks.push(callback);
    this.pendingCallbacks.set(key, callbacks);
  }

  private handleResponse(response: WorkerResponse): void {
    let key: string;

    switch (response.type) {
      case 'ready':
        key = 'init';
        break;
      case 'parsed':
        key = `parse-${response.file}`;
        break;
      case 'rendered':
        key = response.layerIndex !== undefined
          ? `renderLayer-${response.file}-${response.layerIndex}`
          : `renderComposite-${response.file}`;
        break;
      case 'released':
        key = `release-${response.file}`;
        break;
      case 'fontRegistered':
        key = 'registerFont';
        break;
      case 'registeredFonts':
        key = 'getRegisteredFonts';
        break;
      case 'error':
        // Try to route error to specific callback if file/operation provided
        if (response.file && response.operation) {
          const errorKey = response.operation === 'renderComposite'
            ? `renderComposite-${response.file}`
            : response.operation === 'parse'
            ? `parse-${response.file}`
            : null;

          if (errorKey) {
            const callbacks = this.pendingCallbacks.get(errorKey);
            if (callbacks) {
              callbacks.forEach(cb => cb(response));
              this.pendingCallbacks.delete(errorKey);
              return;
            }
          }
        }
        // Fallback: broadcast error to all pending callbacks
        this.pendingCallbacks.forEach((callbacks, k) => {
          callbacks.forEach(cb => cb(response));
          this.pendingCallbacks.delete(k);
        });
        return;
    }

    const callbacks = this.pendingCallbacks.get(key);
    if (callbacks) {
      callbacks.forEach(cb => cb(response));
      this.pendingCallbacks.delete(key);
    }
  }

  async parsePsd(file: FileSlot, data: ArrayBuffer): Promise<PsdData> {
    if (!this.isReady) {
      await this.initialize();
    }

    // Cache the PSD data for Qt renderer (it needs to re-parse in main thread)
    this.psdDataCache.set(file, data.slice(0));
    qtRenderer.cachePsdData(file, data.slice(0));

    return new Promise((resolve, reject) => {
      this.addCallback(`parse-${file}`, (response) => {
        if (response.type === 'parsed') {
          resolve(response.data);
        } else if (response.type === 'error') {
          reject(new Error(response.message));
        }
      });

      this.postMessage({ type: 'parse', file, data });
    });
  }

  async renderCompositeWithVisibility(file: FileSlot, hiddenLayerIds: number[], shownLayerIds: number[] = [], renderMode: RenderMode = 'fast'): Promise<RenderedImage> {
    if (!this.isReady) {
      throw new Error('Engine not ready');
    }

    // Qt mode uses main thread renderer (requires QGuiApplication with DOM access)
    if (renderMode === 'qt') {
      return qtRenderer.renderCompositeWithQt(file, hiddenLayerIds, shownLayerIds);
    }

    // Fast mode uses worker
    return new Promise((resolve, reject) => {
      this.addCallback(`renderComposite-${file}`, (response) => {
        if (response.type === 'rendered') {
          resolve(response.image);
        } else if (response.type === 'error') {
          reject(new Error(response.message));
        }
      });

      this.postMessage({ type: 'renderCompositeWithVisibility', file, hiddenLayerIds, shownLayerIds, renderMode });
    });
  }

  async renderLayer(file: FileSlot, layerIndex: number): Promise<RenderedImage> {
    if (!this.isReady) {
      throw new Error('Engine not ready');
    }

    return new Promise((resolve, reject) => {
      this.addCallback(`renderLayer-${file}-${layerIndex}`, (response) => {
        if (response.type === 'rendered') {
          resolve(response.image);
        } else if (response.type === 'error') {
          reject(new Error(response.message));
        }
      });

      this.postMessage({ type: 'renderLayer', file, layerIndex });
    });
  }

  async release(file: FileSlot): Promise<void> {
    // Release from Qt renderer
    qtRenderer.release(file);
    this.psdDataCache.delete(file);

    if (!this.worker) return;

    return new Promise((resolve) => {
      this.addCallback(`release-${file}`, () => {
        resolve();
      });

      this.postMessage({ type: 'release', file });
    });
  }

  async registerFont(data: ArrayBuffer, filename: string): Promise<{ fontId: number; families: string[] }> {
    if (!this.isReady) {
      await this.initialize();
    }

    // Register font in both worker (fast mode) and main thread Qt renderer
    const workerPromise = new Promise<{ fontId: number; families: string[] }>((resolve, reject) => {
      this.addCallback('registerFont', (response) => {
        if (response.type === 'fontRegistered') {
          resolve({ fontId: response.fontId, families: response.families });
        } else if (response.type === 'error') {
          reject(new Error(response.message));
        }
      });

      this.postMessage({ type: 'registerFont', data, filename });
    });

    // Also register in Qt renderer (for Qt mode)
    // Use a copy of the data since ArrayBuffer can only be transferred once
    const qtPromise = qtRenderer.registerFont(data.slice(0), filename).catch(err => {
      console.warn('[PsdEngine] Failed to register font in Qt renderer:', err);
      return null;
    });

    // Wait for both, but only return worker result (they should match)
    const [workerResult] = await Promise.all([workerPromise, qtPromise]);
    return workerResult;
  }

  async getRegisteredFonts(): Promise<string[]> {
    if (!this.isReady) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.addCallback('getRegisteredFonts', (response) => {
        if (response.type === 'registeredFonts') {
          resolve(response.fonts);
        } else if (response.type === 'error') {
          reject(new Error(response.message));
        }
      });

      this.postMessage({ type: 'getRegisteredFonts' });
    });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      this.readyPromise = null;
      this.pendingCallbacks.clear();
    }
  }
}

// Singleton instance
export const psdEngine = new PsdEngine();
