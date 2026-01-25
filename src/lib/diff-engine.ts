// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import type { LayerInfo, LayerDiff, LayerChanges, DiffStatus, LayerTreeNode } from './types';

export function computeLayerDiffs(
  layersA: LayerInfo[],
  layersB: LayerInfo[]
): Map<number, LayerDiff> {
  const diffs = new Map<number, LayerDiff>();

  // Defensive: ensure arrays exist
  const safeLayersA = layersA || [];
  const safeLayersB = layersB || [];

  const mapA = new Map<number, LayerInfo>();
  const mapB = new Map<number, LayerInfo>();

  for (const layer of safeLayersA) {
    if (layer.id > 0) mapA.set(layer.id, layer);
  }
  for (const layer of safeLayersB) {
    if (layer.id > 0) mapB.set(layer.id, layer);
  }

  for (const [id, layerA] of mapA) {
    const layerB = mapB.get(id);
    if (!layerB) {
      diffs.set(id, { layerA, status: 'removed' });
    } else {
      const changes = detectChanges(layerA, layerB);
      diffs.set(id, {
        layerA,
        layerB,
        status: changes ? 'modified' : 'unchanged',
        changes: changes || undefined
      });
    }
  }

  for (const [id, layerB] of mapB) {
    if (!mapA.has(id)) {
      diffs.set(id, { layerB, status: 'added' });
    }
  }

  return diffs;
}

function detectChanges(a: LayerInfo, b: LayerInfo): LayerChanges | null {
  const changes: LayerChanges = {};
  let hasChanges = false;

  if (a.name !== b.name) { changes.name = true; hasChanges = true; }
  // parentId comparison removed - tree structure determined by buildLayerTree
  if (a.x !== b.x || a.y !== b.y) { changes.position = true; hasChanges = true; }
  if (a.width !== b.width || a.height !== b.height) { changes.size = true; hasChanges = true; }
  if (a.visible !== b.visible) { changes.visible = true; hasChanges = true; }
  if (a.opacity !== b.opacity) { changes.opacity = true; hasChanges = true; }
  if (a.blendMode !== b.blendMode) { changes.blendMode = true; hasChanges = true; }

  return hasChanges ? changes : null;
}

export function buildLayerTree(
  layers: LayerInfo[],
  diffs: Map<number, LayerDiff>
): LayerTreeNode[] {
  // Defensive: ensure layers is an array
  if (!layers || !Array.isArray(layers) || layers.length === 0) {
    return [];
  }

  const result: LayerTreeNode[] = [];
  const stack: LayerTreeNode[][] = [result];

  // Iterate forward (PSD stores layers bottom to top)
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (!layer) continue;

    const diff = diffs.get(layer.id) || null;

    if (layer.type === 'groupEnd') {
      // Entering a group (in forward iteration) - push new level
      stack.push([]);
    } else if (layer.type === 'group') {
      // Exiting a group - pop children and create group node
      const children = stack.pop() || [];
      if (stack.length > 0) {
        // Reverse children to get correct top-to-bottom order within group
        stack[stack.length - 1].push({
          layer,
          diff,
          children: children.reverse(),
          expanded: true
        });
      }
    } else {
      // Regular layer - add to current level
      if (stack.length > 0) {
        stack[stack.length - 1].push({
          layer,
          diff,
          children: [],
          expanded: false
        });
      }
    }
  }

  // Reverse result for top-to-bottom display order
  return result.reverse();
}

export function filterDiffOnly(nodes: LayerTreeNode[]): LayerTreeNode[] {
  return nodes.reduce((acc, node) => {
    const children = filterDiffOnly(node.children);
    const hasDiff = node.diff && node.diff.status !== 'unchanged';
    if (hasDiff || children.length > 0) {
      acc.push({ ...node, children });
    }
    return acc;
  }, [] as LayerTreeNode[]);
}

export function filterByStatus(nodes: LayerTreeNode[], statuses: DiffStatus[]): LayerTreeNode[] {
  return nodes.reduce((acc, node) => {
    const children = filterByStatus(node.children, statuses);
    const matches = node.diff && statuses.includes(node.diff.status);
    if (matches || children.length > 0 || node.layer.type === 'group') {
      acc.push({ ...node, children });
    }
    return acc;
  }, [] as LayerTreeNode[]);
}

export function searchLayers(nodes: LayerTreeNode[], query: string): LayerTreeNode[] {
  const q = query.toLowerCase();
  return nodes.reduce((acc, node) => {
    const children = searchLayers(node.children, query);
    const matches = node.layer.name.toLowerCase().includes(q);
    if (matches || children.length > 0) {
      acc.push({ ...node, children, expanded: children.length > 0 });
    }
    return acc;
  }, [] as LayerTreeNode[]);
}

export interface DiffSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
}

export function getDiffSummary(diffs: Map<number, LayerDiff>): DiffSummary {
  const summary: DiffSummary = { added: 0, removed: 0, modified: 0, unchanged: 0, total: diffs.size };
  for (const diff of diffs.values()) {
    summary[diff.status]++;
  }
  return summary;
}
