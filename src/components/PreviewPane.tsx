// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { useState, useCallback } from 'react';
import { usePsdStore } from '../stores/psd-store';
import { useDiffStore } from '../stores/diff-store';
import SwipeCompare from './SwipeCompare';
import CrossfadeCompare from './CrossfadeCompare';
import type { RenderedImage } from '../lib/types';

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
    maxWidth: '720px',
    margin: '0 auto',
    color: '#bbb',
    fontSize: '15px',
    lineHeight: 1.6
  },
  landingTitle: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '12px',
    textAlign: 'center' as const
  },
  landingSubtitle: {
    fontSize: '18px',
    color: '#888',
    textAlign: 'center' as const,
    marginBottom: '48px'
  },
  section: {
    marginBottom: '40px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '20px',
    paddingBottom: '8px',
    borderBottom: '1px solid #444'
  },
  cards: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap' as const
  },
  card: {
    flex: '1 1 180px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center' as const
  },
  cardIcon: {
    fontSize: '32px',
    marginBottom: '12px'
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '8px'
  },
  cardDesc: {
    fontSize: '13px',
    color: '#888'
  },
  steps: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '16px'
  },
  stepNum: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#4caf50',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    flexShrink: 0
  },
  features: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px'
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '16px'
  },
  featureIcon: {
    fontSize: '20px'
  },
  copyright: {
    marginTop: '48px',
    paddingTop: '24px',
    borderTop: '1px solid #333',
    textAlign: 'center' as const,
    fontSize: '13px',
    color: '#666'
  },
  copyrightLink: {
    color: '#888',
    textDecoration: 'none'
  },
  toolbarSpacer: {
    flex: 1
  },
  copyButton: (color: string) => ({
    padding: '4px 12px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: color,
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px'
  }),
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

  const [copiedA, setCopiedA] = useState(false);
  const [copiedB, setCopiedB] = useState(false);

  const copyToClipboard = useCallback(async (image: RenderedImage, setCopied: (v: boolean) => void) => {
    if (!image.data) return;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    const dataCopy = new Uint8ClampedArray(image.data.length);
    dataCopy.set(image.data);
    const imageData = new ImageData(dataCopy, image.width, image.height);
    ctx.putImageData(imageData, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

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
        <div style={styles.toolbarSpacer} />
        {compositeA && (
          <button
            style={styles.copyButton('#f44336')}
            onClick={() => copyToClipboard(compositeA, setCopiedA)}
          >
            {copiedA ? 'Copied!' : 'Copy Before'}
          </button>
        )}
        {compositeB && (
          <button
            style={styles.copyButton('#2196f3')}
            onClick={() => copyToClipboard(compositeB, setCopiedB)}
          >
            {copiedB ? 'Copied!' : 'Copy After'}
          </button>
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
              <h1 style={styles.landingTitle}>What changed in this PSD?</h1>
              <p style={styles.landingSubtitle}>Compare two PSD files instantly. No Photoshop. No uploads. 100% private.</p>

              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Who is this for?</h2>
                <div style={styles.cards}>
                  <div style={styles.card}>
                    <div style={styles.cardIcon}>👨‍💻</div>
                    <div style={styles.cardTitle}>Engineers</div>
                    <div style={styles.cardDesc}>Review design changes without Photoshop</div>
                  </div>
                  <div style={styles.card}>
                    <div style={styles.cardIcon}>📋</div>
                    <div style={styles.cardTitle}>Project Managers</div>
                    <div style={styles.cardDesc}>Verify deliverables from designers</div>
                  </div>
                  <div style={styles.card}>
                    <div style={styles.cardIcon}>🎨</div>
                    <div style={styles.cardTitle}>Designers</div>
                    <div style={styles.cardDesc}>Show clients exactly what changed</div>
                  </div>
                </div>
              </div>

              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>How it works</h2>
                <div style={styles.steps}>
                  <div style={styles.step}><span style={styles.stepNum}>1</span> Drop "Before" PSD on the left</div>
                  <div style={styles.step}><span style={styles.stepNum}>2</span> Drop "After" PSD below it</div>
                  <div style={styles.step}><span style={styles.stepNum}>3</span> See visual diff + layer changes</div>
                </div>
              </div>

              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Why this tool?</h2>
                <div style={styles.features}>
                  <div style={styles.feature}><span style={styles.featureIcon}>🔒</span> Files never leave your browser</div>
                  <div style={styles.feature}><span style={styles.featureIcon}>⚡</span> Instant comparison via WebAssembly</div>
                  <div style={styles.feature}><span style={styles.featureIcon}>🆓</span> Free forever, no account needed</div>
                </div>
              </div>

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
