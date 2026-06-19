import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const HOVER_DELAY_MS = 250;
const VIEWPORT_MARGIN_PX = 12;
const PREVIEW_MAX_WIDTH_PX = 360;
const PREVIEW_MAX_HEIGHT_PX = 260;
const HTTP_URL_REGEX = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING_URL_CHARS = '.,;:!?)]}';

type ImageProbeResult =
  | { status: 'loaded'; width: number; height: number }
  | { status: 'failed' };

interface ImageUrlPreviewTextProps {
  text: string;
  maxLength?: number;
  overflowSuffix?: string;
}

interface TextSegment {
  text: string;
  url?: string;
}

const imageProbeCache = new Map<string, ImageProbeResult>();
const pendingImageProbes = new Map<string, Promise<ImageProbeResult>>();

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function splitTrailingUrlPunctuation(value: string): { url: string; suffix: string } {
  let endIndex = value.length;
  while (endIndex > 0 && TRAILING_URL_CHARS.includes(value[endIndex - 1])) {
    endIndex -= 1;
  }

  return {
    url: value.slice(0, endIndex),
    suffix: value.slice(endIndex),
  };
}

function splitTextByHttpUrls(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  HTTP_URL_REGEX.lastIndex = 0;
  for (const match of text.matchAll(HTTP_URL_REGEX)) {
    const rawMatch = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      segments.push({ text: text.slice(lastIndex, matchIndex) });
    }

    const { url, suffix } = splitTrailingUrlPunctuation(rawMatch);
    if (url && isHttpUrl(url)) {
      segments.push({ text: url, url });
    } else {
      segments.push({ text: url });
    }

    if (suffix) {
      segments.push({ text: suffix });
    }

    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments;
}

function probeImageUrl(url: string): Promise<ImageProbeResult> {
  const cached = imageProbeCache.get(url);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = pendingImageProbes.get(url);
  if (pending) {
    return pending;
  }

  const probe = new Promise<ImageProbeResult>((resolve) => {
    const image = new Image();

    image.onload = () => {
      const result: ImageProbeResult = {
        status: 'loaded',
        width: image.naturalWidth || PREVIEW_MAX_WIDTH_PX,
        height: image.naturalHeight || PREVIEW_MAX_HEIGHT_PX,
      };
      imageProbeCache.set(url, result);
      pendingImageProbes.delete(url);
      resolve(result);
    };

    image.onerror = () => {
      const result: ImageProbeResult = { status: 'failed' };
      imageProbeCache.set(url, result);
      pendingImageProbes.delete(url);
      resolve(result);
    };

    image.src = url;
  });

  pendingImageProbes.set(url, probe);
  return probe;
}

function getPreviewSize(width: number, height: number) {
  const safeWidth = width > 0 ? width : PREVIEW_MAX_WIDTH_PX;
  const safeHeight = height > 0 ? height : PREVIEW_MAX_HEIGHT_PX;
  const scale = Math.min(
    PREVIEW_MAX_WIDTH_PX / safeWidth,
    PREVIEW_MAX_HEIGHT_PX / safeHeight,
    1
  );

  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

function getPreviewPosition(anchorRect: DOMRect, previewWidth: number, previewHeight: number) {
  const left = Math.min(
    Math.max(anchorRect.left, VIEWPORT_MARGIN_PX),
    Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - previewWidth - VIEWPORT_MARGIN_PX)
  );
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  const shouldShowAbove = spaceBelow < previewHeight + VIEWPORT_MARGIN_PX && spaceAbove > spaceBelow;
  const preferredTop = shouldShowAbove
    ? anchorRect.top - previewHeight - VIEWPORT_MARGIN_PX
    : anchorRect.bottom + VIEWPORT_MARGIN_PX;
  const top = Math.min(
    Math.max(preferredTop, VIEWPORT_MARGIN_PX),
    Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - previewHeight - VIEWPORT_MARGIN_PX)
  );

  return { left, top };
}

function ImagePreviewPortal({
  url,
  anchorRect,
  width,
  height,
}: {
  url: string;
  anchorRect: DOMRect;
  width: number;
  height: number;
}) {
  const previewSize = getPreviewSize(width, height);
  const popoverWidth = previewSize.width + 8;
  const popoverHeight = previewSize.height + 8;
  const position = getPreviewPosition(anchorRect, popoverWidth, popoverHeight);

  return createPortal(
    <div
      className="pointer-events-none fixed z-[100] rounded-md border bg-popover p-1 shadow-lg"
      style={{
        left: position.left,
        top: position.top,
        width: popoverWidth,
      }}
      role="tooltip"
    >
      <img
        src={url}
        alt="URL image preview"
        className="block rounded-sm object-contain"
        style={{
          width: previewSize.width,
          height: previewSize.height,
          maxWidth: PREVIEW_MAX_WIDTH_PX,
          maxHeight: PREVIEW_MAX_HEIGHT_PX,
        }}
      />
    </div>,
    document.body
  );
}

export function ImageUrlHoverPreview({
  url,
  children,
  className,
}: {
  url: string;
  children: ReactNode;
  className?: string;
}) {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [preview, setPreview] = useState<{ width: number; height: number } | null>(null);
  const hoverTokenRef = useRef(0);
  const delayRef = useRef<number | null>(null);

  const clearDelay = useCallback(() => {
    if (delayRef.current !== null) {
      window.clearTimeout(delayRef.current);
      delayRef.current = null;
    }
  }, []);

  const hidePreview = useCallback(() => {
    hoverTokenRef.current += 1;
    clearDelay();
    setPreview(null);
  }, [clearDelay]);

  const schedulePreview = useCallback((target: HTMLElement) => {
    if (!isHttpUrl(url)) return;

    const nextToken = hoverTokenRef.current + 1;
    hoverTokenRef.current = nextToken;
    setAnchorRect(target.getBoundingClientRect());
    clearDelay();

    delayRef.current = window.setTimeout(() => {
      probeImageUrl(url).then((result) => {
        if (hoverTokenRef.current !== nextToken || result.status !== 'loaded' || !target.isConnected) {
          return;
        }

        setAnchorRect(target.getBoundingClientRect());
        setPreview({ width: result.width, height: result.height });
      });
    }, HOVER_DELAY_MS);
  }, [clearDelay, url]);

  useEffect(() => clearDelay, [clearDelay]);

  useEffect(() => {
    if (!preview) return undefined;

    const close = () => hidePreview();
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);

    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [hidePreview, preview]);

  return (
    <span
      className={cn(
        'rounded-sm underline decoration-current decoration-dotted underline-offset-2 cursor-zoom-in',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        className
      )}
      tabIndex={0}
      onMouseEnter={(event) => schedulePreview(event.currentTarget)}
      onMouseMove={(event) => {
        if (preview) {
          setAnchorRect(event.currentTarget.getBoundingClientRect());
        }
      }}
      onMouseLeave={hidePreview}
      onFocus={(event) => schedulePreview(event.currentTarget)}
      onBlur={hidePreview}
    >
      {children}
      {preview && anchorRect && (
        <ImagePreviewPortal
          url={url}
          anchorRect={anchorRect}
          width={preview.width}
          height={preview.height}
        />
      )}
    </span>
  );
}

export function ImageUrlPreviewText({
  text,
  maxLength,
  overflowSuffix = '',
}: ImageUrlPreviewTextProps) {
  const shouldTruncate = maxLength !== undefined && text.length > maxLength;
  const remainingChars = shouldTruncate ? maxLength : text.length;
  let visibleChars = remainingChars;
  const nodes: ReactNode[] = [];

  splitTextByHttpUrls(text).some((segment, index) => {
    if (visibleChars <= 0) return true;

    const visibleText = segment.text.slice(0, visibleChars);
    if (!visibleText) return false;

    if (segment.url) {
      nodes.push(
        <ImageUrlHoverPreview key={`${index}-${segment.url}`} url={segment.url}>
          {visibleText}
        </ImageUrlHoverPreview>
      );
    } else {
      nodes.push(visibleText);
    }

    visibleChars -= visibleText.length;
    return false;
  });

  if (shouldTruncate && overflowSuffix) {
    nodes.push(overflowSuffix);
  }

  if (nodes.length === 0) return null;
  return <>{nodes}</>;
}
