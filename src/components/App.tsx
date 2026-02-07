// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { usePsdStore } from '../stores/psd-store';
import { useDiffStore } from '../stores/diff-store';
import FileDropZone from './FileDropZone';
import FontDropZone from './FontDropZone';
import RenderModeToggle from './RenderModeToggle';
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
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
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
  const { psdA, psdB, error, renderMode } = usePsdStore();
  const { summary } = useDiffStore();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <span style={styles.title}>
          <svg width="24" height="24" viewBox="0 0 32 32">
            <rect x="2" y="6" width="16" height="20" rx="2" fill="#2196f3" opacity="0.9"/>
            <rect x="14" y="6" width="16" height="20" rx="2" fill="#f44336" opacity="0.9"/>
            <rect x="14" y="6" width="4" height="20" fill="#9c27b0"/>
            <text x="16" y="22" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="bold" fill="#fff">PSD</text>
          </svg>
          PSD Compare
        </span>
        <span style={{ fontSize: '12px', opacity: 0.6 }}>
          © 2026 <a href="https://signal-slot.co.jp" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Signal Slot Inc.</a>
          <span style={{ margin: '0 8px' }}>·</span>
          <a href="https://github.com/signal-slot/psd-compare" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
        </span>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <main style={styles.main}>
        <aside style={styles.sidebar}>
          <div style={styles.dropZones}>
            <FileDropZone file="A" label="Before" />
            <div style={{ height: '8px' }} />
            <FileDropZone file="B" label="After" />
            <RenderModeToggle />
            {renderMode === 'qt' && (
              <>
                <div style={{ height: '8px' }} />
                <FontDropZone />
              </>
            )}
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
