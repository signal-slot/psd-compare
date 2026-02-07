// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { usePsdStore } from '../stores/psd-store';

const styles = {
  container: {
    padding: '12px',
    borderTop: '1px solid #333'
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#888',
    marginBottom: '8px',
    display: 'block'
  },
  toggle: {
    display: 'flex',
    gap: '4px'
  },
  button: (isActive: boolean, isDisabled: boolean) => ({
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: isActive ? '#9c27b0' : '#333',
    color: isActive ? '#fff' : '#888',
    fontSize: '11px',
    fontWeight: 500,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'all 0.2s'
  }),
  description: {
    marginTop: '8px',
    fontSize: '10px',
    color: '#666',
    lineHeight: 1.4
  }
};

export default function RenderModeToggle() {
  const { renderMode, setRenderMode, psdA, psdB, rendering } = usePsdStore();

  const hasPsd = psdA || psdB;
  const disabled = !hasPsd || rendering;

  return (
    <div style={styles.container}>
      <span style={styles.label}>Render Mode</span>
      <div style={styles.toggle}>
        <button
          style={styles.button(renderMode === 'fast', disabled)}
          onClick={() => setRenderMode('fast')}
          disabled={disabled}
        >
          Image
        </button>
        <button
          style={styles.button(renderMode === 'qt', disabled)}
          onClick={() => setRenderMode('qt')}
          disabled={disabled}
        >
          Rendering
        </button>
      </div>
      <div style={styles.description}>
        {renderMode === 'fast'
          ? 'Pre-rasterized layer data'
          : 'Full rendering with effects and fonts'}
      </div>
    </div>
  );
}
