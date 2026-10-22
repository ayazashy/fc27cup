import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';

/**
 * AutoFitName
 * Dynamically shrinks the text font size so that the participant's full name
 * fits inside the available label container WITHOUT wrapping to multiple lines
 * and WITHOUT changing the screen ratio or card height.
 */
export default function AutoFitName({ 
  text, 
  maxFontSize = 1.05, // in rem (~16.8px, maximized, bold & prominent)
  minFontSize = 0.80, // in rem (~12.8px, clear and readable)
  compact = false,
  color = 'var(--text-main)',
  fontWeight = 800,
  align = 'right',
  title = ''
}) {
  const containerRef = useRef(null);
  const textRef = useRef(null);

  const baseSize = compact ? 0.88 : maxFontSize;

  // Start with full baseSize - do not prematurely shrink based on character count
  const [fontSize, setFontSize] = useState(baseSize);
  const [scale, setScale] = useState(1);

  // Exact measurement & auto-shrink adjustment via useLayoutEffect
  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl || !text) return;

    // Reset to baseSize first if text changed
    const containerWidth = container.clientWidth;
    const scrollWidth = textEl.scrollWidth;

    if (containerWidth > 0 && scrollWidth > containerWidth) {
      const ratio = (containerWidth - 1) / scrollWidth;
      const targetSize = Math.max(minFontSize, fontSize * ratio);
      
      if (Math.abs(targetSize - fontSize) > 0.01) {
        setFontSize(targetSize);
      } else if (ratio < 0.99) {
        // If already at minFontSize and still slightly exceeds, apply smooth CSS transform scale
        setScale(Math.max(0.78, ratio));
      }
    } else if (containerWidth > 0 && scrollWidth <= containerWidth * 0.85 && fontSize < baseSize) {
      // Container has plenty of space: restore baseSize
      setFontSize(baseSize);
      setScale(1);
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
