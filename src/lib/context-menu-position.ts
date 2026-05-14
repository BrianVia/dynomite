const MENU_VIEWPORT_PADDING = 8;

export function clampContextMenuPosition(
  x: number,
  y: number,
  menuRect: Pick<DOMRect, 'width' | 'height'>,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight
) {
  return {
    x: Math.max(
      MENU_VIEWPORT_PADDING,
      Math.min(x, viewportWidth - menuRect.width - MENU_VIEWPORT_PADDING)
    ),
    y: Math.max(
      MENU_VIEWPORT_PADDING,
      Math.min(y, viewportHeight - menuRect.height - MENU_VIEWPORT_PADDING)
    ),
  };
}

