import { describe, expect, it } from '@jest/globals';
import { hoverIndex, ITEM_H, MENU_W, menuLayout } from '@/lib/pinPicker';

describe('pin picker geometry', () => {
  it('puts the menu above the finger when there is room', () => {
    const l = menuLayout(200, 600, 3, 400, 800);
    expect(l.top + 28 + 3 * ITEM_H).toBeLessThan(600);
  });

  it('flips below the finger near the top, and stays on screen horizontally', () => {
    const l = menuLayout(5, 40, 3, 400, 800);
    expect(l.top).toBeGreaterThan(40);
    expect(l.left).toBeGreaterThanOrEqual(8);
    const r = menuLayout(398, 600, 3, 400, 800);
    expect(r.left + MENU_W).toBeLessThanOrEqual(400 - 8);
  });

  it('maps finger position to the item under it', () => {
    const l = menuLayout(200, 600, 3, 400, 800);
    const mid = l.left + MENU_W / 2;
    expect(hoverIndex(mid, l.itemsTop + 1, l, 3)).toBe(0);
    expect(hoverIndex(mid, l.itemsTop + ITEM_H * 2 + 5, l, 3)).toBe(2);
    expect(hoverIndex(mid, l.itemsTop - 5, l, 3)).toBeNull();
    expect(hoverIndex(mid, l.itemsTop + ITEM_H * 3 + 1, l, 3)).toBeNull();
    expect(hoverIndex(l.left - 100, l.itemsTop + 1, l, 3)).toBeNull();
  });
});
