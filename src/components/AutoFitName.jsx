import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';

/**
 * AutoFitName
 * Dynamically fits the participant's full name inside the available label container
 * by adjusting font size smoothly down to minFontSize if needed, without clipping
 * or leaving phantom whitespace from CSS transform scales.
 */
export default function AutoFitName({ 
  text = '', 
  maxFontSize = 1.05, // in rem (~16.8px, prominent, bold & clear)
  minFontSize = 0.74, // in rem (~11.8px, readable minimum)
  compact = false,
  color = 'var(--text-main)',
  fontWeight = 800,
  align = 'right',
  title = ''
}) {
  const containerRef = useRef(null);
  const textRef = useRef(null);

  const baseSize = compact ? 0.88 : maxFontSize;
  const [fontSize, setFontSize] = useState(baseSize);
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;

  // Whenever text or baseSize changes, reset fontSize to baseSize
  useEffect(() => {
    setFontSize(baseSize);
  }, [text, baseSize]);

  // Exact measurement & auto-fit adjustment via useLayoutEffect
  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl || !text) return;

    const containerWidth = container.clientWidth;
    const scrollWidth = textEl.scrollWidth;

    if (containerWidth <= 0 || scrollWidth <= 0) return;

    if (scrollWidth > containerWidth) {
      // Shrunk proportionally to fit within container
      const ratio = containerWidth / scrollWidth;
      const target = Math.max(minFontSize, fontSize * ratio * 0.98);
      if (Math.abs(target - fontSize) > 0.015) {
        setFontSize(target);
      }
    } else if (scrollWidth < containerWidth * 0.82 && fontSize < baseSize) {
      // Container has extra space: allow expanding back up towards baseSize
      const ratio = containerWidth / scrollWidth;
      const target = Math.min(baseSize, fontSize * ratio * 0.95);
      if (target > fontSize + 0.025) {
        setFontSize(target);
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
      if (containerWidth <= 0 || scrollWidth <= 0) return;

      const currentSize = fontSizeRef.current;
      if (scrollWidth > containerWidth) {
        const ratio = containerWidth / scrollWidth;
        const target = Math.max(minFontSize, currentSize * ratio * 0.98);
        if (Math.abs(target - currentSize) > 0.015) {
          setFontSize(target);
        }
      } else if (scrollWidth < containerWidth * 0.82 && currentSize < baseSize) {
        const ratio = containerWidth / scrollWidth;
        const target = Math.min(baseSize, currentSize * ratio * 0.95);
        if (target > currentSize + 0.025) {
          setFontSize(target);
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [baseSize, minFontSize, text]);

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
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          verticalAlign: 'middle',
          transition: 'font-size 0.06s ease'
        }}
      >
        {text}
      </span>
    </div>
  );
}
