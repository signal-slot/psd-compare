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

export default function SwipeCompare({ imageA, imageB, selectedLayerA, selectedLayerB }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasARef = useRef<HTMLCanvasElement>(null);
  const canvasBRef = useRef<HTMLCanvasElement>(null);

  const { swipePosition, setSwipePosition, zoom, panX, panY, setPan, setZoom } = useDiffStore();

  const [isDragging, setIsDragging] = useState(false);
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

  // Render images to canvases - use data reference to detect changes
  useEffect(() => {
    const renderToCanvas = (canvas: HTMLCanvasElement | null, image: RenderedImage) => {
      if (!canvas || !image.data) return;

      canvas.width = image.width;
      canvas.height = image.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Create ImageData with a copy of the data
      const dataCopy = new Uint8ClampedArray(image.data.length);
      dataCopy.set(image.data);
      const imageData = new ImageData(dataCopy, image.width, image.height);
      ctx.putImageData(imageData, 0, 0);
    };

    console.log('[SwipeCompare] Rendering canvases', {
      widthA: imageA.width,
      heightA: imageA.height,
      widthB: imageB.width,
      heightB: imageB.height
    });

    renderToCanvas(canvasARef.current, imageA);
    renderToCanvas(canvasBRef.current, imageB);
  }, [imageA.width, imageA.height, imageA.data, imageB.width, imageB.height, imageB.data]);

  // Handle swipe divider drag
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  // Handle pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - panX, y: e.clientY - panY });
    }
  }, [panX, panY]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        setSwipePosition(Math.max(0, Math.min(100, x)));
      }

      if (isPanning) {
        setPan(e.clientX - startPan.x, e.clientY - startPan.y);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isPanning, startPan, setSwipePosition, setPan]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(zoom * delta);
  }, [zoom, setZoom]);

  // Calculate image position (centered in container with pan offset)
  const imageWidth = imageA.width * zoom;
  const imageHeight = imageA.height * zoom;
  const imageLeft = (containerSize.width - imageWidth) / 2 + panX;
  const imageTop = (containerSize.height - imageHeight) / 2 + panY;

  // Divider position in pixels
  const dividerX = containerSize.width * swipePosition / 100;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: isPanning ? 'grabbing' : 'grab',
        backgroundColor: '#1a1a1a',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
    >
      {/* Image B (left side - After) - clipped at divider */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: dividerX,
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <canvas
          ref={canvasBRef}
          style={{
            position: 'absolute',
            left: imageLeft,
            top: imageTop,
            width: imageWidth,
            height: imageHeight
          }}
        />
      </div>

      {/* Image A (right side - Before) - clipped at divider */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: dividerX,
          right: 0,
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <canvas
          ref={canvasARef}
          style={{
            position: 'absolute',
            left: imageLeft - dividerX,
            top: imageTop,
            width: imageWidth,
            height: imageHeight
          }}
        />
      </div>

      {/* Labels */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          padding: '4px 8px',
          backgroundColor: 'rgba(33, 150, 243, 0.8)',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#fff',
          zIndex: 5,
          userSelect: 'none'
        }}
      >
        After
      </div>
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          padding: '4px 8px',
          backgroundColor: 'rgba(244, 67, 54, 0.8)',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#fff',
          zIndex: 5,
          userSelect: 'none'
        }}
      >
        Before
      </div>

      {/* Divider */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${swipePosition}%`,
          width: '3px',
          background: 'linear-gradient(to right, #2196f3, #9c27b0, #f44336)',
          cursor: 'ew-resize',
          zIndex: 10,
          transform: 'translateX(-50%)'
        }}
        onMouseDown={handleDividerMouseDown}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(to right, #2196f3, #f44336)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          ⟺
        </div>
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
