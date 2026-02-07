// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { useCallback, useState, useRef } from 'react';
import { useFontStore } from '../stores/font-store';

const styles = {
  container: (isDragging: boolean) => ({
    padding: '12px',
    border: `2px dashed ${isDragging ? '#9c27b0' : '#555'}`,
    borderRadius: '8px',
    backgroundColor: isDragging ? 'rgba(156, 39, 176, 0.15)' : 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#9c27b0'
  },
  count: {
    fontSize: '11px',
    color: '#888',
    backgroundColor: '#333',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  hint: {
    fontSize: '11px',
    opacity: 0.5
  },
  fontList: {
    marginTop: '8px',
    maxHeight: '100px',
    overflowY: 'auto' as const
  },
  fontItem: {
    fontSize: '11px',
    padding: '4px 0',
    borderBottom: '1px solid #333',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px'
  },
  fontFileName: {
    color: '#aaa'
  },
  fontFamilies: {
    color: '#9c27b0',
    fontSize: '10px'
  },
  loading: {
    fontSize: '11px',
    color: '#9c27b0'
  }
};

export default function FontDropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { fonts, loading, registerFont } = useFontStore();

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.ttf') && !ext.endsWith('.otf')) {
      useFontStore.getState().clearError();
      return;
    }
    await registerFont(file);
  }, [registerFont]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Handle multiple files
    const files = Array.from(e.dataTransfer.files);
    files.forEach(f => {
      const ext = f.name.toLowerCase();
      if (ext.endsWith('.ttf') || ext.endsWith('.otf')) {
        handleFile(f);
      }
    });
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(f => handleFile(f));
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFile]);

  return (
    <div
      style={styles.container(isDragging)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".ttf,.otf"
        multiple
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      <div style={styles.header}>
        <span style={styles.label}>Fonts</span>
        {fonts.length > 0 && (
          <span style={styles.count}>{fonts.length} loaded</span>
        )}
      </div>

      {loading ? (
        <div style={styles.loading}>Loading font...</div>
      ) : fonts.length > 0 ? (
        <div style={styles.fontList}>
          {fonts.map((font, idx) => (
            <div key={idx} style={styles.fontItem}>
              <span style={styles.fontFileName}>{font.fileName}</span>
              <span style={styles.fontFamilies}>{font.families.join(', ')}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.hint}>
          Drop .ttf/.otf fonts for text layers
        </div>
      )}
    </div>
  );
}
