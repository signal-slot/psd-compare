// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { usePsdStore } from '../stores/psd-store';
import { useDiffStore } from '../stores/diff-store';
import FileDropZone from './FileDropZone';
import LayerTree from './LayerTree';
import PreviewPane from './PreviewPane';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    backgroundColor: '#1a1a1a',
    color: '#e0e0e0'
  },
  header: {
    padding: '12px 20px',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: '18px',
    fontWeight: 600
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  },
  sidebar: {
    width: '320px',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden'
  },
  dropZones: {
    padding: '12px',
    borderBottom: '1px solid #333'
  },
  layerSection: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const
  },
  preview: {
    flex: 1,
    overflow: 'hidden'
  },
  error: {
    padding: '8px 12px',
    backgroundColor: '#ff4444',
    color: 'white',
    fontSize: '14px'
  },
  summary: {
    padding: '8px 12px',
    fontSize: '12px',
    borderBottom: '1px solid #333',
    display: 'flex',
    gap: '12px'
  },
  badge: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: color,
    fontSize: '11px',
    fontWeight: 500
  })
};

export default function App() {
  const { psdA, psdB, error } = usePsdStore();
  const { summary } = useDiffStore();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <span style={styles.title}>PSD Diff</span>
        <span style={{ fontSize: '12px', opacity: 0.6 }}>
          Compare PSD files locally - no upload required
        </span>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <main style={styles.main}>
        <aside style={styles.sidebar}>
          <div style={styles.dropZones}>
            <FileDropZone file="A" label="Before" />
            <div style={{ height: '8px' }} />
            <FileDropZone file="B" label="After" />
          </div>

          {summary && (
            <div style={styles.summary}>
              <span style={styles.badge('#2196f3')}>➕{summary.added}</span>
              <span style={styles.badge('#9c27b0')}>✏️{summary.modified}</span>
              <span style={styles.badge('#f44336')}>➖{summary.removed}</span>
              <span style={{ opacity: 0.5 }}>{summary.unchanged} unchanged</span>
            </div>
          )}

          <div style={styles.layerSection}>
            {(psdA || psdB) ? (
              <LayerTree />
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
                Load PSD files to view layers
              </div>
            )}
          </div>
        </aside>

        <section style={styles.preview}>
          <PreviewPane />
        </section>
      </main>
    </div>
  );
}
