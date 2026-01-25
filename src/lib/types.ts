// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

// Layer information from PSD file
export interface LayerInfo {
  id: number;           // lyid from additional layer information (or index+1 fallback)
  index: number;        // Original index in PSD records (for rendering)
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;      // 0-255
  blendMode: BlendMode;
  type: LayerType;
}

export type LayerType = 'layer' | 'group' | 'groupEnd';

export type BlendMode =
  | 'passThrough'
  | 'normal'
  | 'dissolve'
  | 'darken'
  | 'multiply'
  | 'colorBurn'
  | 'linearBurn'
  | 'darkerColor'
  | 'lighten'
  | 'screen'
  | 'colorDodge'
  | 'linearDodge'
  | 'lighterColor'
  | 'overlay'
  | 'softLight'
  | 'hardLight'
  | 'vividLight'
  | 'linearLight'
  | 'pinLight'
  | 'hardMix'
  | 'difference'
  | 'exclusion'
  | 'subtract'
  | 'divide'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

// Parsed PSD data
export interface PsdData {
  parserId: number;
  width: number;
  height: number;
  channels: number;
  depth: number;
  colorMode: ColorMode;
  layers: LayerInfo[];
}

export type ColorMode =
  | 'Bitmap'
  | 'Grayscale'
  | 'Indexed'
  | 'RGB'
  | 'CMYK'
  | 'Multichannel'
  | 'Duotone'
  | 'Lab'
  | 'Unknown';

// Rendered image data
export interface RenderedImage {
  width: number;
  height: number;
  x?: number;
  y?: number;
  data: Uint8ClampedArray | null;
}

// Worker message types
export type WorkerRequest =
  | { type: 'init' }
  | { type: 'parse'; file: 'A' | 'B'; data: ArrayBuffer }
  | { type: 'renderCompositeWithVisibility'; file: 'A' | 'B'; hiddenLayerIds: number[]; shownLayerIds: number[] }
  | { type: 'renderLayer'; file: 'A' | 'B'; layerIndex: number }
  | { type: 'release'; file: 'A' | 'B' };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'parsed'; file: 'A' | 'B'; data: PsdData }
  | { type: 'rendered'; file: 'A' | 'B'; image: RenderedImage; layerIndex?: number }
  | { type: 'released'; file: 'A' | 'B' }
  | { type: 'error'; message: string; file?: 'A' | 'B'; operation?: string };

// Diff types
export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

export interface LayerDiff {
  layerA?: LayerInfo;  // undefined if added
  layerB?: LayerInfo;  // undefined if removed
  status: DiffStatus;
  changes?: LayerChanges;
}

export interface LayerChanges {
  name?: boolean;
  parentId?: boolean;
  position?: boolean;  // x, y changed
  size?: boolean;      // width, height changed
  visible?: boolean;
  opacity?: boolean;
  blendMode?: boolean;
}

// Tree node for layer display
export interface LayerTreeNode {
  layer: LayerInfo;
  diff: LayerDiff | null;
  children: LayerTreeNode[];
  expanded: boolean;
}

// Comparison mode
export type CompareMode = 'swipe' | 'crossfade' | 'sideBySide';

// File slot
export type FileSlot = 'A' | 'B';
