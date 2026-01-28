// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { useCallback, useState, useRef } from 'react';
import { usePsdStore } from '../stores/psd-store';
import type { FileSlot } from '../lib/types';

interface Props {
  file: FileSlot;
  label: string;
}

// Colors: Before (A) = Red, After (B) = Blue
const fileColors = {
  A: { primary: '#f44336', bg: 'rgba(244, 67, 54, 0.15)' },
  B: { primary: '#2196f3', bg: 'rgba(33, 150, 243, 0.15)' }
};

const styles = {
  container: (isDragging: boolean, hasFile: boolean, fileSlot: 'A' | 'B') => {
    const color = fileColors[fileSlot];
    return {
      padding: '16px',
      border: `2px dashed ${isDragging ? color.primary : hasFile ? '#555' : color.primary}`,
      borderRadius: '8px',
      backgroundColor: isDragging ? color.bg : hasFile ? 'transparent' : color.bg,
      cursor: 'pointer',
      transition: 'all 0.2s',
      opacity: hasFile ? 0.8 : 1
    };
  },
  label: (fileSlot: 'A' | 'B', hasFile: boolean) => ({
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '4px',
    color: hasFile ? '#999' : fileColors[fileSlot].primary
  }),
  fileName: {
    fontSize: '14px',
    wordBreak: 'break-all' as const
  },
  hint: {
    fontSize: '12px',
    opacity: 0.5
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px'
  },
  info: {
    fontSize: '11px',
    opacity: 0.5,
    marginTop: '4px'
  }
};

export default function FileDropZone({ file, label }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const psd = usePsdStore(state => file === 'A' ? state.psdA : state.psdB);
  const loading = usePsdStore(state => file === 'A' ? state.loadingA : state.loadingB);
  const loadPsd = usePsdStore(state => state.loadPsd);

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.psd')) {
      usePsdStore.getState().setError('Please select a PSD file');
      return;
    }

    setFileName(f.name);
    const buffer = await f.arrayBuffer();
    await loadPsd(file, buffer);
  }, [file, loadPsd]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  return (
    <div
      style={styles.container(isDragging, !!psd, file)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".psd"
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      <div style={styles.label(file, !!psd)}>{label}</div>

      {loading ? (
        <div style={styles.loading}>
          <span>Loading...</span>
        </div>
      ) : psd ? (
        <>
          <div style={styles.fileName}>{fileName}</div>
          <div style={styles.info}>
            {psd.width} x {psd.height} | {psd.layers.length} layers
          </div>
        </>
      ) : (
        <div style={styles.hint}>
          Drop PSD file or click to select
        </div>
      )}
    </div>
  );
}
