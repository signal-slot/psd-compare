// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { create } from 'zustand';
import type { LayerDiff, LayerTreeNode, DiffStatus, CompareMode } from '../lib/types';
import { computeLayerDiffs, buildLayerTree, filterDiffOnly, filterByStatus, searchLayers, getDiffSummary, type DiffSummary } from '../lib/diff-engine';
import { usePsdStore } from './psd-store';

interface DiffState {
  diffs: Map<number, LayerDiff>;
  treeB: LayerTreeNode[];
  filteredTree: LayerTreeNode[];
  summary: DiffSummary | null;

  // Filters
  showDiffOnly: boolean;
  statusFilter: DiffStatus[];
  searchQuery: string;

  // View settings
  compareMode: CompareMode;
  crossfadeValue: number; // 0-100
  swipePosition: number;  // 0-100
  zoom: number;
  panX: number;
  panY: number;

  // Selection
  selectedLayerId: number | null;
}

interface DiffActions {
  computeDiffs: () => void;
  setShowDiffOnly: (show: boolean) => void;
  setStatusFilter: (statuses: DiffStatus[]) => void;
  setSearchQuery: (query: string) => void;
  setCompareMode: (mode: CompareMode) => void;
  setCrossfadeValue: (value: number) => void;
  setSwipePosition: (position: number) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setSelectedLayerId: (id: number | null) => void;
  toggleExpanded: (layerId: number) => void;
  reset: () => void;
  applyFilters: () => void;
}

const initialState: DiffState = {
  diffs: new Map(),
  treeB: [],
  filteredTree: [],
  summary: null,
  showDiffOnly: false,
  statusFilter: ['added', 'removed', 'modified', 'unchanged'],
  searchQuery: '',
  compareMode: 'swipe',
  crossfadeValue: 50,
  swipePosition: 50,
  zoom: 1,
  panX: 0,
  panY: 0,
  selectedLayerId: null
};

export const useDiffStore = create<DiffState & DiffActions>((set, get) => ({
  ...initialState,

  computeDiffs: () => {
    const { psdA, psdB } = usePsdStore.getState();

    // Handle no files loaded
    if (!psdA && !psdB) {
      set({ diffs: new Map(), treeB: [], filteredTree: [], summary: null });
      return;
    }

    // Defensive: ensure layers arrays exist
    const layersA = psdA?.layers || [];
    const layersB = psdB?.layers || [];

    // Use whichever file is loaded for tree display
    const layersForTree = layersB.length > 0 ? layersB : layersA;

    // Only compute diffs if both files loaded
    const diffs = (psdA && psdB)
      ? computeLayerDiffs(layersA, layersB)
      : new Map<number, LayerDiff>();

    const treeB = buildLayerTree(layersForTree, diffs);
    const summary = (psdA && psdB) ? getDiffSummary(diffs) : null;

    set({ diffs, treeB, summary });
    get().applyFilters();
  },

  setShowDiffOnly: (show) => {
    set({ showDiffOnly: show });
    get().applyFilters();
  },

  setStatusFilter: (statuses) => {
    set({ statusFilter: statuses });
    get().applyFilters();
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().applyFilters();
  },

  setCompareMode: (mode) => set({ compareMode: mode }),
  setCrossfadeValue: (value) => set({ crossfadeValue: value }),
  setSwipePosition: (position) => set({ swipePosition: position }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  setSelectedLayerId: (id) => set({ selectedLayerId: id }),

  toggleExpanded: (layerId) => {
    const toggleNode = (nodes: LayerTreeNode[]): LayerTreeNode[] => {
      return nodes.map(node => {
        if (node.layer.id === layerId) {
          return { ...node, expanded: !node.expanded };
        }
        if (node.children.length > 0) {
          return { ...node, children: toggleNode(node.children) };
        }
        return node;
      });
    };

    set(state => ({
      treeB: toggleNode(state.treeB),
      filteredTree: toggleNode(state.filteredTree)
    }));
  },

  reset: () => set(initialState),

  // Internal helper
  applyFilters: () => {
    const { treeB, showDiffOnly, statusFilter, searchQuery } = get();

    let filtered = treeB;

    if (showDiffOnly) {
      filtered = filterDiffOnly(filtered);
    }

    if (statusFilter.length < 4) {
      filtered = filterByStatus(filtered, statusFilter);
    }

    if (searchQuery) {
      filtered = searchLayers(filtered, searchQuery);
    }

    set({ filteredTree: filtered });
  }
}));

// Subscribe to PSD changes to auto-compute diffs
usePsdStore.subscribe((state, prevState) => {
  if (state.psdA !== prevState.psdA || state.psdB !== prevState.psdB) {
    useDiffStore.getState().computeDiffs();
  }
});
