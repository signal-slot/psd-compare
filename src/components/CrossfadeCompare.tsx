// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { useRef, useEffect, useState, useCallback } from 'react';
import { useDiffStore } from '../stores/diff-store';
import type { RenderedImage, LayerInfo } from '../lib/types';

interface Props {
  imageA: RenderedImage;
  imageB: RenderedImage;
  selectedLayerA?: LayerInfo | null;
  selectedLayerB?: LayerInfo | null;
}

export default function CrossfadeCompare({ imageA, imageB, selectedLayerA, selectedLayerB }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { crossfadeValue, zoom, panX, panY, setPan, setZoom } = useDiffStore();

  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Track container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Render blended image to canvas - use data references to detect changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageA.data || !imageB.data) return;

    console.log('[CrossfadeCompare] Rendering canvas');

    // Use the larger dimensions
    const width = Math.max(imageA.width, imageB.width);
    const height = Math.max(imageA.height, imageB.height);

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create blended image data
    const blended = new Uint8ClampedArray(width * height * 4);
    const t = crossfadeValue / 100; // 0 = all A, 1 = all B

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const outIdx = (y * width + x) * 4;

        // Get pixel from A (default to transparent if out of bounds)
        let rA = 0, gA = 0, bA = 0, aA = 0;
        if (x < imageA.width && y < imageA.height) {
          const idxA = (y * imageA.width + x) * 4;
          rA = imageA.data[idxA];
          gA = imageA.data[idxA + 1];
          bA = imageA.data[idxA + 2];
          aA = imageA.data[idxA + 3];
        }

        // Get pixel from B (default to transparent if out of bounds)
        let rB = 0, gB = 0, bB = 0, aB = 0;
        if (x < imageB.width && y < imageB.height) {
          const idxB = (y * imageB.width + x) * 4;
          rB = imageB.data[idxB];
          gB = imageB.data[idxB + 1];
          bB = imageB.data[idxB + 2];
          aB = imageB.data[idxB + 3];
        }

        // Linear interpolation: result = A * (1 - t) + B * t
        blended[outIdx] = Math.round(rA * (1 - t) + rB * t);
        blended[outIdx + 1] = Math.round(gA * (1 - t) + gB * t);
        blended[outIdx + 2] = Math.round(bA * (1 - t) + bB * t);
        blended[outIdx + 3] = Math.round(aA * (1 - t) + aB * t);
      }
    }

    const imageData = new ImageData(blended, width, height);
    ctx.putImageData(imageData, 0, 0);
  }, [imageA.width, imageA.height, imageA.data, imageB.width, imageB.height, imageB.data, crossfadeValue]);

  // Handle pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - panX, y: e.clientY - panY });
    }
  }, [panX, panY]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setPan(e.clientX - startPan.x, e.clientY - startPan.y);
      }
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, startPan, setPan]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(zoom * delta);
  }, [zoom, setZoom]);

  // Calculate image position
  const imageWidth = Math.max(imageA.width, imageB.width) * zoom;
  const imageHeight = Math.max(imageA.height, imageB.height) * zoom;
  const imageLeft = (containerSize.width - imageWidth) / 2 + panX;
  const imageTop = (containerSize.height - imageHeight) / 2 + panY;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: isPanning ? 'grabbing' : 'grab',
        backgroundColor: '#1a1a1a'
      }}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          left: imageLeft,
          top: imageTop,
          width: imageWidth,
          height: imageHeight
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          padding: '4px 8px',
          backgroundColor: 'rgba(0,0,0,0.6)',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#fff',
          zIndex: 5,
          display: 'flex',
          gap: '8px'
        }}
      >
        <span style={{ color: '#2196f3' }}>After: {Math.round(crossfadeValue)}%</span>
        <span style={{ color: '#f44336' }}>Before: {Math.round(100 - crossfadeValue)}%</span>
      </div>

      {/* Pulsing glow animation */}
      <style>{`
        @keyframes pulseRed {
          0%, 100% { box-shadow: 0 0 8px rgba(244, 67, 54, 0.5), 0 0 16px rgba(244, 67, 54, 0.3); }
          50% { box-shadow: 0 0 16px rgba(244, 67, 54, 0.8), 0 0 32px rgba(244, 67, 54, 0.5); }
        }
        @keyframes pulseBlue {
          0%, 100% { box-shadow: 0 0 8px rgba(33, 150, 243, 0.5), 0 0 16px rgba(33, 150, 243, 0.3); }
          50% { box-shadow: 0 0 16px rgba(33, 150, 243, 0.8), 0 0 32px rgba(33, 150, 243, 0.5); }
        }
        @keyframes pulsePurple {
          0%, 100% { box-shadow: 0 0 8px rgba(156, 39, 176, 0.5), 0 0 16px rgba(156, 39, 176, 0.3); }
          50% { box-shadow: 0 0 16px rgba(156, 39, 176, 0.8), 0 0 32px rgba(156, 39, 176, 0.5); }
        }
      `}</style>
      {/* Selected layer highlight */}
      {(() => {
        const hasA = selectedLayerA && selectedLayerA.width > 0 && selectedLayerA.height > 0;
        const hasB = selectedLayerB && selectedLayerB.width > 0 && selectedLayerB.height > 0;
        const sameGeometry = hasA && hasB &&
          selectedLayerA.x === selectedLayerB.x &&
          selectedLayerA.y === selectedLayerB.y &&
          selectedLayerA.width === selectedLayerB.width &&
          selectedLayerA.height === selectedLayerB.height;

        if (sameGeometry) {
          // Same geometry - show purple
          return (
            <div
              style={{
                position: 'absolute',
                left: imageLeft + selectedLayerA!.x * zoom,
                top: imageTop + selectedLayerA!.y * zoom,
                width: selectedLayerA!.width * zoom,
                height: selectedLayerA!.height * zoom,
                border: '3px solid #9c27b0',
                backgroundColor: 'rgba(156, 39, 176, 0.1)',
                pointerEvents: 'none',
                zIndex: 15,
                animation: 'pulsePurple 1.5s ease-in-out infinite'
              }}
            />
          );
        }

        // Different geometry - show both
        return (
          <>
            {hasA && (
              <div
                style={{
                  position: 'absolute',
                  left: imageLeft + selectedLayerA!.x * zoom,
                  top: imageTop + selectedLayerA!.y * zoom,
                  width: selectedLayerA!.width * zoom,
                  height: selectedLayerA!.height * zoom,
                  border: '3px solid #f44336',
                  backgroundColor: 'rgba(244, 67, 54, 0.1)',
                  pointerEvents: 'none',
                  zIndex: 15,
                  animation: 'pulseRed 1.5s ease-in-out infinite'
                }}
              />
            )}
            {hasB && (
              <div
                style={{
                  position: 'absolute',
                  left: imageLeft + selectedLayerB!.x * zoom,
                  top: imageTop + selectedLayerB!.y * zoom,
                  width: selectedLayerB!.width * zoom,
                  height: selectedLayerB!.height * zoom,
                  border: '3px solid #2196f3',
                  backgroundColor: 'rgba(33, 150, 243, 0.1)',
                  pointerEvents: 'none',
                  zIndex: 15,
                  animation: 'pulseBlue 1.5s ease-in-out infinite'
                }}
              />
            )}
          </>
        );
      })()}
    </div>
  );
}
