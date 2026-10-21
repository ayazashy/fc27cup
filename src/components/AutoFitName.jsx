import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';

/**
 * AutoFitName
 * Dynamically shrinks the text font size so that the participant's full name
 * fits inside the available label container WITHOUT wrapping to multiple lines
 * and WITHOUT changing the screen ratio or card height.
 */
export default function AutoFitName({ 
  text, 
  maxFontSize = 0.88, // in rem
  minFontSize = 0.46, // in rem
  compact = false,
  color = 'var(--text-main)',
  fontWeight = 800,
  align = 'right',
  title = ''
}) {
  const containerRef = useRef(null);
  const textRef = useRef(null);

  const baseSize = compact ? 0.78 : maxFontSize;

  // Immediate heuristic calculation based on character count to prevent any flash of layout
  const computeInitialSize = (str) => {
    if (!str) return baseSize;
    const len = str.trim().length;
    if (len <= 10) return baseSize;
    if (len <= 14) return Math.max(minFontSize, baseSize * 0.85);
    if (len <= 18) return Math.max(minFontSize, baseSize * 0.72);
    if (len <= 23) return Math.max(minFontSize, baseSize * 0.62);
    if (len <= 28) return Math.max(minFontSize, baseSize * 0.55);
    return Math.max(minFontSize, baseSize * 0.48);
  };

  const [fontSize, setFontSize] = useState(() => computeInitialSize(text));
  const [scale, setScale] = useState(1);

  // Exact measurement & auto-shrink adjustment via useLayoutEffect
  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl || !text) return;

    const containerWidth = container.clientWidth;
    const scrollWidth = textEl.scrollWidth;

    if (containerWidth > 0 && scrollWidth > containerWidth) {
      const ratio = (containerWidth - 1) / scrollWidth;
      const targetSize = Math.max(minFontSize, fontSize * ratio);
      
      if (Math.abs(targetSize - fontSize) > 0.015) {
        setFontSize(targetSize);
      } else if (ratio < 0.99) {
        // If already at minFontSize and still slightly exceeds, apply smooth CSS transform scale
        setScale(Math.max(0.65, ratio));
      }
    } else if (containerWidth > 0 && scrollWidth <= containerWidth * 0.75 && fontSize < baseSize) {
      // Container expanded or text shortened: scale font size back up
      const ratio = (containerWidth - 1) / scrollWidth;
      const targetSize = Math.min(baseSize, fontSize * ratio * 0.95);
      if (targetSize > fontSize + 0.02) {
        setFontSize(targetSize);
        setScale(1);
      }
    }
  }, [text, fontSize, baseSize, minFontSize]);

  // Window resize & orientation change handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => {
      const textEl = textRef.current;
      if (!textEl || !container || !text) return;
      const containerWidth = container.clientWidth;
      const scrollWidth = textEl.scrollWidth;
      if (containerWidth > 0 && scrollWidth > containerWidth) {
        const ratio = (containerWidth - 1) / scrollWidth;
        setFontSize(prev => Math.max(minFontSize, prev * ratio));
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [minFontSize, text]);

  const transformOrigin = align === 'left' ? 'left center' : 'right center';

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
        textAlign: align,
        lineHeight: 1.25,
        display: 'block'
      }}
      title={title || text}
    >
      <span 
        ref={textRef}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          fontWeight,
          fontSize: `${fontSize.toFixed(3)}rem`,
          color,
          transform: scale < 1 ? `scale(${scale.toFixed(3)})` : 'none',
          transformOrigin,
          transition: 'font-size 0.08s ease',
          verticalAlign: 'middle',
          maxWidth: 'none'
        }}
      >
        {text}
      </span>
    </div>
  );
}
