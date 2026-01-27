// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { usePsdStore } from '../stores/psd-store';
import { useDiffStore } from '../stores/diff-store';
import SwipeCompare from './SwipeCompare';
import CrossfadeCompare from './CrossfadeCompare';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#222'
  },
  toolbar: {
    padding: '8px 12px',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  modeSelect: {
    display: 'flex',
    gap: '4px'
  },
  modeButton: (active: boolean) => ({
    padding: '4px 12px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: active ? '#4caf50' : '#333',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '12px'
  }),
  slider: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px'
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative' as const
  },
  placeholder: {
    height: '100%',
    overflow: 'auto',
    padding: '40px',
    boxSizing: 'border-box' as const
  },
  landingContent: {
    maxWidth: '640px',
    margin: '0 auto',
    color: '#ccc',
    fontSize: '14px',
    lineHeight: 1.7
  },
  landingTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '24px'
  },
  landingParagraph: {
    marginBottom: '16px'
  },
  landingList: {
    marginBottom: '16px',
    paddingLeft: '20px'
  },
  landingListItem: {
    marginBottom: '8px'
  },
  busyOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 100
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#4fc3f7',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  }
};

const sliderStyle = `
  .gradient-slider, .swipe-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 120px;
    height: 6px;
    border-radius: 3px;
    outline: none;
  }
  .gradient-slider {
    background: linear-gradient(to right, #2196f3, #9c27b0, #f44336);
  }
  .gradient-slider::-webkit-slider-thumb,
  .swipe-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
  .gradient-slider::-moz-range-thumb,
  .swipe-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

import SinglePreview from './SinglePreview';

export default function PreviewPane() {
  const { compositeA, compositeB, rendering, psdA, psdB } = usePsdStore();
  const {
    compareMode,
    setCompareMode,
    crossfadeValue,
    setCrossfadeValue,
    swipePosition,
    setSwipePosition,
    selectedLayerId
  } = useDiffStore();

  const hasBothImages = compositeA && compositeB;
  const hasSingleImage = (compositeA || compositeB) && !hasBothImages;
  const singleImage = compositeA || compositeB;

  // Get selected layer bounds from both PSD files
  const selectedLayerA = selectedLayerId !== null
    ? psdA?.layers.find(l => l.id === selectedLayerId) || null
    : null;
  const selectedLayerB = selectedLayerId !== null
    ? psdB?.layers.find(l => l.id === selectedLayerId) || null
    : null;

  return (
    <div style={styles.container}>
      <style>{sliderStyle}</style>
      <div style={styles.toolbar}>
        {hasBothImages && (
          <>
            <div style={styles.modeSelect}>
              <button
                style={styles.modeButton(compareMode === 'swipe')}
                onClick={() => setCompareMode('swipe')}
              >
                Swipe
              </button>
              <button
                style={styles.modeButton(compareMode === 'crossfade')}
                onClick={() => setCompareMode('crossfade')}
              >
                Crossfade
              </button>
            </div>

            {compareMode === 'crossfade' && (
              <div style={styles.slider}>
                <span style={{ color: '#2196f3', fontWeight: 500 }}>After</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={crossfadeValue}
                  onChange={(e) => setCrossfadeValue(Number(e.target.value))}
                  className="gradient-slider"
                />
                <span style={{ color: '#f44336', fontWeight: 500 }}>Before</span>
              </div>
            )}

            {compareMode === 'swipe' && (
              <div style={styles.slider}>
                <span style={{ color: '#2196f3', fontWeight: 500 }}>After</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={swipePosition}
                  onChange={(e) => setSwipePosition(Number(e.target.value))}
                  className="swipe-slider"
                  style={{
                    background: `linear-gradient(to right, #2196f3 0%, #2196f3 ${swipePosition}%, #f44336 ${swipePosition}%, #f44336 100%)`
                  }}
                />
                <span style={{ color: '#f44336', fontWeight: 500 }}>Before</span>
              </div>
            )}
          </>
        )}
        {hasSingleImage && (
          <span style={{ fontSize: '12px', opacity: 0.7 }}>
            Single file preview - load another PSD to compare
          </span>
        )}
      </div>

      <div style={styles.viewport}>
        {hasBothImages ? (
          compareMode === 'swipe' ? (
            <SwipeCompare imageA={compositeA} imageB={compositeB} selectedLayerA={selectedLayerA} selectedLayerB={selectedLayerB} />
          ) : (
            <CrossfadeCompare imageA={compositeA} imageB={compositeB} selectedLayerA={selectedLayerA} selectedLayerB={selectedLayerB} />
          )
        ) : hasSingleImage ? (
          <SinglePreview image={singleImage!} selectedLayer={selectedLayerA || selectedLayerB} />
        ) : (
          <div style={styles.placeholder}>
            <div style={styles.landingContent}>
              <h1 style={styles.landingTitle}>Compare PSD Files Online — Securely, Instantly, and Without Uploading</h1>

              <p style={styles.landingParagraph}>
                Have you ever received a PSD file and wondered what actually changed?
              </p>

              <p style={styles.landingParagraph}>
                Opening Photoshop just to check a small update is slow, expensive, and often unnecessary. This tool exists for one simple reason: to let you compare two PSD files and immediately see the differences — without installing anything and without uploading your files to a server.
              </p>

              <p style={styles.landingParagraph}>
                Everything runs entirely inside your browser. Your PSD files are never sent anywhere, stored anywhere, or analyzed on a remote server. You can verify this yourself using your browser's developer tools. This makes the tool safe to use even for confidential designs, client work, and NDA-protected projects.
              </p>

              <p style={styles.landingParagraph}>
                The workflow is intentionally simple. Select two PSD files, and the tool highlights what changed: visual differences, layer-level changes, and structural updates that matter during reviews. There is no editing, no history, and no account system. This is not a design tool. It is a review and verification tool.
              </p>

              <p style={styles.landingParagraph}>This is especially useful if you:</p>
              <ul style={styles.landingList}>
                <li style={styles.landingListItem}>Are an engineer or PM who needs to review design updates</li>
                <li style={styles.landingListItem}>Receive PSD files from designers or external vendors</li>
                <li style={styles.landingListItem}>Want to confirm changes without opening Photoshop</li>
                <li style={styles.landingListItem}>Work with legacy PSD assets in a Figma-first workflow</li>
              </ul>

              <p style={styles.landingParagraph}>
                The goal is not to replace Photoshop or Figma. It is to solve a narrow, real problem: understanding changes quickly and safely.
              </p>

              <p style={styles.landingParagraph}>
                The tool is free and will remain free. It collects no data, performs no tracking, and makes no assumptions about how you work. If it saves you time, that's enough.
              </p>

              <p style={styles.landingParagraph}>
                If you ever find yourself asking "what changed in this PSD?", this tool is for you.
              </p>
            </div>
          </div>
        )}
        {rendering && (
          <div style={styles.busyOverlay}>
            <div style={styles.spinner} />
          </div>
        )}
      </div>
    </div>
  );
}
