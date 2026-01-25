// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { useDiffStore } from '../stores/diff-store';
import { usePsdStore } from '../stores/psd-store';
import type { LayerTreeNode, DiffStatus } from '../lib/types';

// FileSlot type for layer tree context
type FileSlot = 'A' | 'B';

const statusColors: Record<DiffStatus, { border: string; bg: string }> = {
  added: { border: '#2196f3', bg: 'rgba(33, 150, 243, 0.15)' },    // Blue = After (new)
  removed: { border: '#f44336', bg: 'rgba(244, 67, 54, 0.15)' },   // Red = Before (deleted)
  modified: { border: '#9c27b0', bg: 'rgba(156, 39, 176, 0.15)' }, // Purple = changed
  unchanged: { border: 'transparent', bg: 'transparent' }
};

const diffMarkers: Record<DiffStatus, { symbol: string; color: string }> = {
  added: { symbol: '➕', color: '#2196f3' },
  removed: { symbol: '➖', color: '#f44336' },
  modified: { symbol: '✏️', color: '#9c27b0' },
  unchanged: { symbol: '', color: 'transparent' }
};

const styles = {
  container: {
    flex: 1,
    overflow: 'auto',
    fontSize: '13px'
  },
  filters: {
    padding: '8px 12px',
    borderBottom: '1px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px'
  },
  searchInput: {
    width: '100%',
    padding: '6px 10px',
    border: '1px solid #444',
    borderRadius: '4px',
    backgroundColor: '#2a2a2a',
    color: '#e0e0e0',
    fontSize: '13px',
    outline: 'none'
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  tree: {
    padding: '8px 0'
  },
  node: (depth: number, status: DiffStatus, selected: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    padding: '4px 8px',
    paddingLeft: `${24 + depth * 16}px`,
    cursor: 'pointer',
    backgroundColor: selected ? 'rgba(255,255,255,0.2)' : statusColors[status].bg,
    position: 'relative' as const
  }),
  diffMarker: (status: DiffStatus) => ({
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    width: '22px',
    minWidth: '22px',
    maxWidth: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    lineHeight: 1,
    backgroundColor: statusColors[status].border,
    overflow: 'hidden'
  }),
  toggle: {
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '4px',
    opacity: 0.5,
    fontSize: '10px'
  },
  icon: {
    marginRight: '6px',
    opacity: 0.5
  },
  name: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  visibility: (visible: boolean, clickable: boolean) => ({
    marginLeft: '6px',
    padding: '2px 6px',
    fontSize: '12px',
    borderRadius: '3px',
    backgroundColor: clickable ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
    color: visible ? '#4fc3f7' : '#666',
    transition: 'background-color 0.15s',
    width: '20px',
    textAlign: 'center' as const,
    display: 'inline-block'
  })
};

function LayerNodeComponent({ node, depth, file, canToggleVisibility, toggleBothFiles }: { node: LayerTreeNode; depth: number; file: FileSlot; canToggleVisibility: boolean; toggleBothFiles: boolean }) {
  const { selectedLayerId, setSelectedLayerId, toggleExpanded } = useDiffStore();
  const { toggleLayerVisibility, setLayerVisibilityBatch, getEffectiveVisibility } = usePsdStore();

  const status = node.diff?.status || 'unchanged';
  const isSelected = selectedLayerId === node.layer.id;

  // Get effective visibility (considering ancestor groups)
  // For removed layers, check file A; for added layers, check file B
  const visibilityFile: FileSlot = status === 'removed' ? 'A' : file;
  const isVisible = getEffectiveVisibility(visibilityFile, node.layer.id);

  const handleClick = () => {
    setSelectedLayerId(node.layer.id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpanded(node.layer.id);
  };

  const handleVisibilityToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canToggleVisibility) {
      // Target visibility is the opposite of current
      const targetVisible = !isVisible;

      if (toggleBothFiles) {
        // In comparison mode, set explicit visibility based on diff status
        // Use batch function to render both files in parallel and update UI at once
        const diffStatus = node.diff?.status;
        if (diffStatus === 'removed') {
          // Layer only exists in A (before)
          await setLayerVisibilityBatch(node.layer.id, targetVisible, ['A']);
        } else if (diffStatus === 'added') {
          // Layer only exists in B (after)
          await setLayerVisibilityBatch(node.layer.id, targetVisible, ['B']);
        } else {
          // Layer exists in both files - render both in parallel
          await setLayerVisibilityBatch(node.layer.id, targetVisible, ['A', 'B']);
        }
      } else {
        // Single file mode
        await toggleLayerVisibility(file, node.layer.id);
      }
    }
  };

  const isGroup = node.layer.type === 'group';

  return (
    <>
      <div
        style={styles.node(depth, status, isSelected)}
        onClick={handleClick}
      >
        <span style={styles.diffMarker(status)}>
          {diffMarkers[status].symbol}
        </span>

        {isGroup ? (
          <span style={styles.toggle} onClick={handleToggle}>
            {node.expanded ? '▼' : '▶'}
          </span>
        ) : (
          <span style={styles.toggle} />
        )}

        <span style={styles.icon}>
          {isGroup ? '📁' : '🖼'}
        </span>

        <span style={styles.name} title={node.layer.name}>
          {node.layer.name || '(unnamed)'}
        </span>

        <span
          style={{
            ...styles.visibility(isVisible, canToggleVisibility),
            cursor: canToggleVisibility ? 'pointer' : 'default'
          }}
          onClick={handleVisibilityToggle}
          title={isVisible ? 'Hide layer' : 'Show layer'}
          onMouseEnter={(e) => {
            if (canToggleVisibility) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = canToggleVisibility ? 'rgba(255, 255, 255, 0.1)' : 'transparent';
          }}
        >
          {isVisible ? '👁️' : '🙈'}
        </span>
      </div>

      {isGroup && node.expanded && node.children.map((child, i) => (
        <LayerNodeComponent key={child.layer.id || i} node={child} depth={depth + 1} file={file} canToggleVisibility={canToggleVisibility} toggleBothFiles={toggleBothFiles} />
      ))}
    </>
  );
}

export default function LayerTree() {
  const {
    filteredTree,
    showDiffOnly,
    setShowDiffOnly,
    searchQuery,
    setSearchQuery
  } = useDiffStore();
  const { psdA, psdB } = usePsdStore();

  // Determine which file the tree is based on (B if loaded, otherwise A)
  const treeFile: FileSlot = psdB ? 'B' : 'A';

  // Always allow visibility toggle
  const canToggle = psdA !== null || psdB !== null;

  // In comparison mode (both files loaded), toggle both files
  const isComparisonMode = psdA !== null && psdB !== null;

  return (
    <div style={styles.container}>
      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Search layers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />

        <div style={styles.filterRow}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={showDiffOnly}
              onChange={(e) => setShowDiffOnly(e.target.checked)}
            />
            Show changes only
          </label>
        </div>
      </div>

      <div style={styles.tree}>
        {filteredTree.length > 0 ? (
          filteredTree.map((node, i) => (
            <LayerNodeComponent key={node.layer.id || i} node={node} depth={0} file={treeFile} canToggleVisibility={canToggle} toggleBothFiles={isComparisonMode} />
          ))
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
            No layers match filters
          </div>
        )}
      </div>
    </div>
  );
}
