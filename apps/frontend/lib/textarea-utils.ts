export interface Coordinates {
  top: number;
  left: number;
  height: number;
}

/**
 * Calculates the cursor/selection position in a textarea.
 * Based on https://github.com/component/textarea-caret
 */
export const getSelectionCoordinates = (element: HTMLTextAreaElement, position: number): Coordinates => {
  // We'll create a mirror div and copy the styles
  const div = document.createElement('div');
  const style = div.style;
  const computed = window.getComputedStyle(element);

  // Transfer specific styles
  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.position = 'absolute'; // Position off-screen
  style.visibility = 'hidden';

  // Copy font/text properties
  [
    'direction',
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing',
  ].forEach((prop) => {
    // @ts-ignore
    style[prop] = computed[prop];
  });

  // Firefox needs this for accurate height calculation with scrollbars
  if ((element as any).mozInnerScreenX != null) {
    if (element.scrollHeight > parseInt(computed.height)) {
      style.overflowY = 'scroll';
    }
  } else {
    style.overflow = 'hidden'; 
  }

  div.textContent = element.value.substring(0, position);
  
  // The span is the cursor position
  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);

  document.body.appendChild(div);

  const coordinates = {
    top: span.offsetTop + parseInt(computed['borderTopWidth']),
    left: span.offsetLeft + parseInt(computed['borderLeftWidth']),
    height: parseInt(computed['lineHeight'])
  };

  document.body.removeChild(div);

  return coordinates;
}

/**
 * Get bounding rect for a specific selection range in textarea
 * Since selection can span multiple lines, we simplify by getting the start and end coordinates.
 * We'll return a rect that covers the start point and width based on end point (approximation).
 * For a perfect rect, we'd need to measure each line.
 * 
 * For a popup menu, we usually want to center it above the selection.
 * We'll take the midpoint between start and end coordinates.
 */
export const getSelectionRect = (element: HTMLTextAreaElement) => {
  const { selectionStart, selectionEnd } = element;
  if (selectionStart === selectionEnd) return null;

  const startCoords = getSelectionCoordinates(element, selectionStart);
  const endCoords = getSelectionCoordinates(element, selectionEnd);

  // Adjust for scroll
  const scrollTop = element.scrollTop;
  const rect = element.getBoundingClientRect();

  // Coordinates are relative to the top-left of the textarea content (including padding/border)
  // We need to translate them to viewport coordinates.
  
  const top = rect.top + startCoords.top - scrollTop;
  const bottom = rect.top + endCoords.top + endCoords.height - scrollTop;
  const left = rect.left + startCoords.left;
  const right = rect.left + endCoords.left; // This might be on a different line!

  // If on diff lines, we center horizontally based on the middle of the textarea or just based on start/end
  // For simplicity, let's position it above the start of the selection, or try to center it.
  
  // If multiline selection, let's just use the end point or start point.
  // Standard behavior for tooltips: above the selection midpoint (if single line) or start/end.
  
  // Let's settle on: Top-Center of the START of the selection to keep it predictable,
  // or maybe better: midpoint of the first line of selection?
  
  // Let's try to center between start and end IF they are on the same line (appx same top).
  let menuLeft = left;
  if (Math.abs(startCoords.top - endCoords.top) < 5) {
     menuLeft = (left + right) / 2;
  } else {
     // Multiline: Center above the start point is safer visually
     menuLeft = left + 20; // Slight offset
  }

  // Position relative to viewport
  return {
    top: top + window.scrollY,
    left: menuLeft + window.scrollX,
    height: startCoords.height,
    width: 0 // Point rect
  };
};
