// Copyright (C) 2026 Signal Slot Inc.
// SPDX-License-Identifier: MIT

import { useRef, useEffect, useState, useCallback } from 'react';
import { useDiffStore } from '../stores/diff-store';
import type { RenderedImage, LayerInfo } from '../lib/types';

interface Props {
  image: RenderedImage;
  selectedLayer?: LayerInfo | null;
}

export default function SinglePreview({ image, selectedLayer }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { zoom, panX, panY, setPan, setZoom } = useDiffStore();

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

  // Render image to canvas - use image.data reference to detect changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image.data) return;

    console.log('[SinglePreview] Rendering canvas', {
      width: image.width,
      height: image.height,
      dataLength: image.data.length
    });

    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create ImageData with a copy of the data
    const dataCopy = new Uint8ClampedArray(image.data.length);
    dataCopy.set(image.data);
    const imageData = new ImageData(dataCopy, image.width, image.height);
    ctx.putImageData(imageData, 0, 0);
  }, [image.width, image.height, image.data]);

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
  const imageWidth = image.width * zoom;
  const imageHeight = image.height * zoom;
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

      {/* Pulsing glow animation */}
      <style>{`
        @keyframes pulseYellow {
          0%, 100% { box-shadow: 0 0 8px rgba(255, 235, 59, 0.5), 0 0 16px rgba(255, 235, 59, 0.3); }
          50% { box-shadow: 0 0 16px rgba(255, 235, 59, 0.8), 0 0 32px rgba(255, 235, 59, 0.5); }
        }
      `}</style>
      {/* Selected layer highlight */}
      {selectedLayer && selectedLayer.width > 0 && selectedLayer.height > 0 && (
        <div
          style={{
            position: 'absolute',
            left: imageLeft + selectedLayer.x * zoom,
            top: imageTop + selectedLayer.y * zoom,
            width: selectedLayer.width * zoom,
            height: selectedLayer.height * zoom,
            border: '3px solid #ffeb3b',
            backgroundColor: 'rgba(255, 235, 59, 0.15)',
            pointerEvents: 'none',
            zIndex: 15,
            animation: 'pulseYellow 1.5s ease-in-out infinite'
          }}
        />
      )}
    </div>
  );
}
