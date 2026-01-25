// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { create } from 'zustand';
import type { PsdData, RenderedImage, FileSlot, LayerInfo } from '../lib/types';
import { psdEngine } from '../lib/psd-engine';

// Helper: Get all descendant layer IDs for a group
// PSD structure (bottom-to-top): groupEnd -> layers -> group (header)
function getDescendantIds(layers: LayerInfo[], groupId: number): number[] {
  const descendants: number[] = [];

  // Find the group record by ID
  const groupIndex = layers.findIndex(l => l.id === groupId && l.type === 'group');
  if (groupIndex === -1) return descendants;

  // Find the corresponding groupEnd by walking backwards
  let depth = 0;
  for (let i = groupIndex - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.type === 'group') {
      depth++;
    } else if (layer.type === 'groupEnd') {
      if (depth === 0) {
        // Found the matching groupEnd
        // Collect all layers between this groupEnd and the group header
        for (let j = i + 1; j < groupIndex; j++) {
          descendants.push(layers[j].id);
        }
        break;
      }
      depth--;
    }
  }

  return descendants;
}

// Helper: Get all ancestor group IDs for a layer
// Returns array of group IDs from immediate parent to root
function getAncestorGroupIds(layers: LayerInfo[], layerIndex: number): number[] {
  const ancestors: number[] = [];

  // Walk forward from the layer to find enclosing groups
  // When we see a 'group' header, we're exiting that group
  // When we see a 'groupEnd', we're entering a group (going towards root)
  let depth = 0;
  for (let i = layerIndex + 1; i < layers.length; i++) {
    const layer = layers[i];
    if (layer.type === 'groupEnd') {
      depth++;
    } else if (layer.type === 'group') {
      if (depth === 0) {
        // This group contains our layer
        ancestors.push(layer.id);
      } else {
        depth--;
      }
    }
  }

  return ancestors;
}

// Compute effective visibility for a layer considering ancestor visibility
function computeEffectiveVisibility(
  layers: LayerInfo[],
  layerId: number,
  overrides: Map<number, boolean>
): boolean {
  const layerIndex = layers.findIndex(l => l.id === layerId);
  if (layerIndex === -1) return false;

  const layer = layers[layerIndex];

  // Get layer's own visibility (override or original)
  const ownVisible = overrides.has(layerId) ? overrides.get(layerId)! : layer.visible;
  if (!ownVisible) return false;

  // Check all ancestors - if any is hidden, this layer is effectively hidden
  const ancestorIds = getAncestorGroupIds(layers, layerIndex);
  for (const ancestorId of ancestorIds) {
    const ancestor = layers.find(l => l.id === ancestorId);
    if (!ancestor) continue;

    const ancestorVisible = overrides.has(ancestorId) ? overrides.get(ancestorId)! : ancestor.visible;
    if (!ancestorVisible) return false;
  }

  return true;
}

interface PsdState {
  psdA: PsdData | null;
  psdB: PsdData | null;
  compositeA: RenderedImage | null;
  compositeB: RenderedImage | null;
  loadingA: boolean;
  loadingB: boolean;
  rendering: boolean;
  error: string | null;
  // Visibility overrides: layerId -> visible (true/false), undefined = use original
  visibilityOverridesA: Map<number, boolean>;
  visibilityOverridesB: Map<number, boolean>;
}

// Synchronous loading guards (outside Zustand state to avoid async race)
const loadingGuard = { A: false, B: false };

interface PsdActions {
  loadPsd: (file: FileSlot, data: ArrayBuffer) => Promise<void>;
  toggleLayerVisibility: (file: FileSlot, layerId: number) => Promise<void>;
  setLayerVisibility: (file: FileSlot, layerId: number, visible: boolean) => Promise<void>;
  setLayerVisibilityBatch: (layerId: number, visible: boolean, files: ('A' | 'B')[]) => Promise<void>;
  recomposite: (file: FileSlot) => Promise<void>;
  getEffectiveVisibility: (file: FileSlot, layerId: number) => boolean;
  clear: (file: FileSlot) => void;
  clearAll: () => void;
  setError: (error: string | null) => void;
}

export const usePsdStore = create<PsdState & PsdActions>((set, get) => ({
  psdA: null,
  psdB: null,
  compositeA: null,
  compositeB: null,
  loadingA: false,
  loadingB: false,
  rendering: false,
  error: null,
  visibilityOverridesA: new Map(),
  visibilityOverridesB: new Map(),

  loadPsd: async (file, data) => {
    const loadingKey = file === 'A' ? 'loadingA' : 'loadingB';
    const psdKey = file === 'A' ? 'psdA' : 'psdB';
    const compositeKey = file === 'A' ? 'compositeA' : 'compositeB';
    const overridesKey = file === 'A' ? 'visibilityOverridesA' : 'visibilityOverridesB';

    // Synchronous guard to prevent concurrent loads of the same file slot
    // (Zustand's set() is async, so state-based guard has race condition)
    if (loadingGuard[file]) {
      console.log('[loadPsd] Skipping - already loading file', file);
      return;
    }
    loadingGuard[file] = true;

    // Get existing overrides from the other file to inherit
    const state = get();
    const otherOverrides = file === 'A' ? state.visibilityOverridesB : state.visibilityOverridesA;

    set({ [loadingKey]: true, error: null });

    try {
      console.log('[loadPsd] Starting load for file', file);
      await psdEngine.initialize();
      const psdData = await psdEngine.parsePsd(file, data);
      console.log('[loadPsd] Parsed file', file, 'with parserId:', psdData.parserId);
      set({ [psdKey]: psdData, [compositeKey]: null });

      // Inherit visibility overrides from the other file (for matching layer IDs)
      const newOverrides = new Map<number, boolean>();
      for (const [layerId, visible] of otherOverrides) {
        // Check if this layer exists in the newly loaded file
        const layerExists = psdData.layers.some(l => l.id === layerId);
        if (layerExists) {
          newOverrides.set(layerId, visible);
        }
      }

      console.log('[loadPsd] Inherited overrides from other file:', newOverrides.size);

      set({ [overridesKey]: newOverrides });

      // Compute effective visibility (considering group hierarchy and inherited overrides)
      const hiddenLayerIds: number[] = [];
      const shownLayerIds: number[] = [];

      for (const layer of psdData.layers) {
        if (layer.type === 'groupEnd') continue;

        const effectiveVisible = computeEffectiveVisibility(psdData.layers, layer.id, newOverrides);

        if (effectiveVisible && !layer.visible) {
          // Originally hidden but effectively visible now
          shownLayerIds.push(layer.id);
        } else if (!effectiveVisible && layer.visible) {
          // Originally visible but effectively hidden now
          hiddenLayerIds.push(layer.id);
        }
      }

      console.log('[loadPsd] Hidden layers:', hiddenLayerIds, 'Shown layers:', shownLayerIds);

      // Use layer-by-layer rendering with QtPsd (proper rendering)
      console.log('[loadPsd] Calling renderCompositeWithVisibility for file', file, 'with parserId:', psdData.parserId);
      const composite = await psdEngine.renderCompositeWithVisibility(file, hiddenLayerIds, shownLayerIds);
      console.log('[loadPsd] Render complete for file', file);
      set({ [compositeKey]: composite });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load PSD' });
    } finally {
      loadingGuard[file] = false;
      set({ [loadingKey]: false });
    }
  },

  toggleLayerVisibility: async (file, layerId) => {
    const state = get();
    const psd = file === 'A' ? state.psdA : state.psdB;
    const overridesKey = file === 'A' ? 'visibilityOverridesA' : 'visibilityOverridesB';
    const overrides = file === 'A' ? state.visibilityOverridesA : state.visibilityOverridesB;

    if (!psd) return;

    // Find the layer
    const layer = psd.layers.find(l => l.id === layerId);
    if (!layer) {
      console.error('[toggleLayerVisibility] Layer not found:', layerId);
      return;
    }

    const currentVisible = overrides.has(layerId) ? overrides.get(layerId)! : layer.visible;
    const newVisible = !currentVisible;

    console.log('[toggleLayerVisibility]', {
      layerId,
      layerName: layer.name,
      layerType: layer.type,
      originalVisible: layer.visible,
      currentVisible,
      newVisible
    });

    // Toggle visibility for the layer and its descendants (if it's a group)
    const newOverrides = new Map(overrides);
    newOverrides.set(layerId, newVisible);

    // If this is a group, also toggle all descendants
    if (layer.type === 'group') {
      const descendantIds = getDescendantIds(psd.layers, layerId);
      console.log('[toggleLayerVisibility] Group descendants:', descendantIds);
      for (const descId of descendantIds) {
        newOverrides.set(descId, newVisible);
      }
    }

    // Compute effective visibility for all layers (considering hierarchy)
    const hiddenLayerIds: number[] = [];
    const shownLayerIds: number[] = [];

    for (const l of psd.layers) {
      // Skip group markers
      if (l.type === 'groupEnd') continue;

      const effectiveVisible = computeEffectiveVisibility(psd.layers, l.id, newOverrides);

      if (effectiveVisible && !l.visible) {
        // Originally hidden but effectively visible now
        shownLayerIds.push(l.id);
      } else if (!effectiveVisible && l.visible) {
        // Originally visible but effectively hidden now
        hiddenLayerIds.push(l.id);
      }
    }

    console.log('[toggleLayerVisibility] Will render with:', { hiddenLayerIds, shownLayerIds });

    set({ [overridesKey]: newOverrides });

    // Render with the computed lists
    const compositeKey = file === 'A' ? 'compositeA' : 'compositeB';
    try {
      const composite = await psdEngine.renderCompositeWithVisibility(file, hiddenLayerIds, shownLayerIds);
      set({ [compositeKey]: composite });
    } catch (err) {
      console.error('Failed to render composite:', err);
      set({ error: err instanceof Error ? err.message : 'Failed to render' });
    }
  },

  setLayerVisibility: async (file, layerId, visible) => {
    const state = get();
    const psd = file === 'A' ? state.psdA : state.psdB;
    const overridesKey = file === 'A' ? 'visibilityOverridesA' : 'visibilityOverridesB';
    const overrides = file === 'A' ? state.visibilityOverridesA : state.visibilityOverridesB;

    if (!psd) return;

    // Find the layer
    const layer = psd.layers.find(l => l.id === layerId);
    if (!layer) {
      console.error('[setLayerVisibility] Layer not found:', layerId);
      return;
    }

    console.log('[setLayerVisibility]', {
      file,
      layerId,
      layerName: layer.name,
      layerType: layer.type,
      targetVisible: visible
    });

    // Set visibility for the layer and its descendants (if it's a group)
    const newOverrides = new Map(overrides);
    newOverrides.set(layerId, visible);

    // If this is a group, also set all descendants
    if (layer.type === 'group') {
      const descendantIds = getDescendantIds(psd.layers, layerId);
      for (const descId of descendantIds) {
        newOverrides.set(descId, visible);
      }
    }

    // Compute effective visibility for all layers (considering hierarchy)
    const hiddenLayerIds: number[] = [];
    const shownLayerIds: number[] = [];

    for (const l of psd.layers) {
      if (l.type === 'groupEnd') continue;

      const effectiveVisible = computeEffectiveVisibility(psd.layers, l.id, newOverrides);

      if (effectiveVisible && !l.visible) {
        shownLayerIds.push(l.id);
      } else if (!effectiveVisible && l.visible) {
        hiddenLayerIds.push(l.id);
      }
    }

    set({ [overridesKey]: newOverrides });

    // Render with the computed lists
    const compositeKey = file === 'A' ? 'compositeA' : 'compositeB';
    try {
      const composite = await psdEngine.renderCompositeWithVisibility(file, hiddenLayerIds, shownLayerIds);
      set({ [compositeKey]: composite });
    } catch (err) {
      console.error('Failed to render composite:', err);
      set({ error: err instanceof Error ? err.message : 'Failed to render' });
    }
  },

  setLayerVisibilityBatch: async (layerId, visible, files) => {
    const state = get();

    // Prepare render data for each file
    const renderTasks: { file: FileSlot; hiddenLayerIds: number[]; shownLayerIds: number[]; newOverrides: Map<number, boolean> }[] = [];

    for (const file of files) {
      const psd = file === 'A' ? state.psdA : state.psdB;
      const overrides = file === 'A' ? state.visibilityOverridesA : state.visibilityOverridesB;

      if (!psd) continue;

      // Find the layer
      const layer = psd.layers.find(l => l.id === layerId);
      if (!layer) continue;

      // Set visibility for the layer and its descendants (if it's a group)
      const newOverrides = new Map(overrides);
      newOverrides.set(layerId, visible);

      if (layer.type === 'group') {
        const descendantIds = getDescendantIds(psd.layers, layerId);
        for (const descId of descendantIds) {
          newOverrides.set(descId, visible);
        }
      }

      // Compute effective visibility for all layers
      const hiddenLayerIds: number[] = [];
      const shownLayerIds: number[] = [];

      for (const l of psd.layers) {
        if (l.type === 'groupEnd') continue;

        const effectiveVisible = computeEffectiveVisibility(psd.layers, l.id, newOverrides);

        if (effectiveVisible && !l.visible) {
          shownLayerIds.push(l.id);
        } else if (!effectiveVisible && l.visible) {
          hiddenLayerIds.push(l.id);
        }
      }

      renderTasks.push({ file, hiddenLayerIds, shownLayerIds, newOverrides });
    }

    // Update all overrides and set rendering state
    const overrideUpdates: Record<string, Map<number, boolean> | boolean> = { rendering: true };
    for (const task of renderTasks) {
      const overridesKey = task.file === 'A' ? 'visibilityOverridesA' : 'visibilityOverridesB';
      overrideUpdates[overridesKey] = task.newOverrides;
    }
    set(overrideUpdates);

    // Render all files in parallel
    try {
      const renderPromises = renderTasks.map(task =>
        psdEngine.renderCompositeWithVisibility(task.file, task.hiddenLayerIds, task.shownLayerIds)
          .then(composite => ({ file: task.file, composite }))
      );

      const results = await Promise.all(renderPromises);

      // Update all composites at once and clear rendering state
      const compositeUpdates: Record<string, RenderedImage | boolean> = { rendering: false };
      for (const result of results) {
        const compositeKey = result.file === 'A' ? 'compositeA' : 'compositeB';
        compositeUpdates[compositeKey] = result.composite;
      }
      set(compositeUpdates);
    } catch (err) {
      console.error('Failed to render composites:', err);
      set({ error: err instanceof Error ? err.message : 'Failed to render', rendering: false });
    }
  },

  getEffectiveVisibility: (file, layerId) => {
    const state = get();
    const psd = file === 'A' ? state.psdA : state.psdB;
    const overrides = file === 'A' ? state.visibilityOverridesA : state.visibilityOverridesB;

    if (!psd) return false;
    return computeEffectiveVisibility(psd.layers, layerId, overrides);
  },

  recomposite: async (file) => {
    const state = get();
    const psd = file === 'A' ? state.psdA : state.psdB;
    const overrides = file === 'A' ? state.visibilityOverridesA : state.visibilityOverridesB;
    const compositeKey = file === 'A' ? 'compositeA' : 'compositeB';

    if (!psd) return;

    // Compute effective visibility for all layers (considering hierarchy)
    const hiddenLayerIds: number[] = [];  // Force hide these
    const shownLayerIds: number[] = [];   // Force show these

    for (const layer of psd.layers) {
      // Skip group markers
      if (layer.type === 'groupEnd') continue;

      const effectiveVisible = computeEffectiveVisibility(psd.layers, layer.id, overrides);

      if (effectiveVisible && !layer.visible) {
        // Originally hidden but effectively visible now
        shownLayerIds.push(layer.id);
      } else if (!effectiveVisible && layer.visible) {
        // Originally visible but effectively hidden now
        hiddenLayerIds.push(layer.id);
      }
    }

    console.log('[recomposite] hiddenLayerIds:', hiddenLayerIds, 'shownLayerIds:', shownLayerIds);

    try {
      // Always use layer-by-layer compositing (more reliable than pre-baked composite)
      const composite = await psdEngine.renderCompositeWithVisibility(file, hiddenLayerIds, shownLayerIds);
      set({ [compositeKey]: composite });
    } catch (err) {
      console.error('Failed to render composite:', err);
      set({ error: err instanceof Error ? err.message : 'Failed to render' });
    }
  },

  clear: (file) => {
    const psdKey = file === 'A' ? 'psdA' : 'psdB';
    const compositeKey = file === 'A' ? 'compositeA' : 'compositeB';
    const overridesKey = file === 'A' ? 'visibilityOverridesA' : 'visibilityOverridesB';
    psdEngine.release(file);
    set({ [psdKey]: null, [compositeKey]: null, [overridesKey]: new Map() });
  },

  clearAll: () => {
    psdEngine.release('A');
    psdEngine.release('B');
    set({
      psdA: null,
      psdB: null,
      compositeA: null,
      compositeB: null,
      error: null,
      visibilityOverridesA: new Map(),
      visibilityOverridesB: new Map()
    });
  },

  setError: (error) => set({ error })
}));
