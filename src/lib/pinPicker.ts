// [OWNER: MAP] Geometry for the hold-and-slide group picker on the map (pure, so it's testable).

export const HOLD_MS = 400;
/** A finger that moves more than this before HOLD_MS is panning the map, not dropping a pin. */
export const MOVE_TOLERANCE = 10;
export const ITEM_H = 48;
export const MENU_W = 220;
const TITLE_H = 28;
const GAP = 28; // space between finger and menu so the finger doesn't cover it
const EDGE = 8;

export interface MenuLayout {
  left: number;
  top: number;
  /** y of the first item (below the title). */
  itemsTop: number;
}

/** Places the menu above the finger (below it if there's no room), kept inside the container. */
export function menuLayout(x: number, y: number, count: number, width: number, height: number): MenuLayout {
  const h = TITLE_H + count * ITEM_H;
  const left = Math.min(Math.max(x - MENU_W / 2, EDGE), Math.max(EDGE, width - MENU_W - EDGE));
  let top = y - GAP - h;
  if (top < EDGE) top = Math.min(y + GAP, Math.max(EDGE, height - h - EDGE));
  return { left, top, itemsTop: top + TITLE_H };
}

/**
 * Which item the finger at (x, y) is over, or null. Horizontal slack lets the finger drift a
 * little outside the menu while sliding up and down it.
 */
export function hoverIndex(x: number, y: number, layout: MenuLayout, count: number, slack = 40): number | null {
  if (x < layout.left - slack || x > layout.left + MENU_W + slack) return null;
  const i = Math.floor((y - layout.itemsTop) / ITEM_H);
  return i >= 0 && i < count ? i : null;
}
