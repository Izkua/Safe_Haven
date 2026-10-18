// [OWNER: MAP] Hold a finger on the map for 0.4 s → a list of your groups pops up next to it.
// Slide onto a group and let go to drop that group's meeting place there. Letting go without
// sliding leaves the list open so you can tap instead. With only one option, it skips the list.
// Built on plain touch events (no extra native deps): touches inside the MapView bubble up to this wrapper's onTouch* handlers.
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { HOLD_MS, hoverIndex, ITEM_H, MENU_W, menuLayout, MOVE_TOLERANCE, type MenuLayout } from '@/lib/pinPicker';
import { colors } from '@/theme';
import type { LatLng } from '@/types';

export type PickOption = { id: string | null; label: string };

type Props = {
  options: PickOption[];
  /** Map coordinate under a point in this view's coordinates. */
  getCoordinate: (pt: { x: number; y: number }) => Promise<LatLng | null>;
  /** Return false to refuse (e.g. offline); the caller shows why. */
  canStart: () => boolean;
  /** Freeze map panning/zooming while the finger is choosing a group. */
  onLockMap: (locked: boolean) => void;
  /** Where the pin would go (draw a preview marker), or null when done. */
  onPendingChange: (coord: LatLng | null) => void;
  onPick: (coord: LatLng, option: PickOption) => void;
  children: ReactNode;
};

type Picker = { coord: LatLng; layout: MenuLayout; mode: 'drag' | 'tap' };

export function HoldGroupPicker({ options, getCoordinate, canStart, onLockMap, onPendingChange, onPick, children }: Props) {
  const viewRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pickerRef = useRef<Picker | null>(null);
  const hoverRef = useRef<number | null>(null);
  const [picker, setPickerState] = useState<Picker | null>(null);
  const [hover, setHoverState] = useState<number | null>(null);

  const rows = options.length + 1; // + "Cancel"
  const setPicker = (p: Picker | null) => { pickerRef.current = p; setPickerState(p); };
  const setHover = (i: number | null) => { if (hoverRef.current !== i) { hoverRef.current = i; setHoverState(i); } };
  const local = (e: GestureResponderEvent) => ({ x: e.nativeEvent.pageX - origin.current.x, y: e.nativeEvent.pageY - origin.current.y });

  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const close = () => {
    clearTimer();
    start.current = null;
    setPicker(null);
    setHover(null);
    onLockMap(false);
    onPendingChange(null);
  };
  const choose = (i: number | null) => {
    const p = pickerRef.current;
    if (!p) return;
    const option = i !== null && i < options.length ? options[i] : null;
    close();
    if (option) onPick(p.coord, option);
  };

  const onTouchStart = (e: GestureResponderEvent) => {
    const open = pickerRef.current;
    if (open) {
      // List is open in tap mode: a touch outside it cancels; touches on it go to the rows.
      const pt = local(e);
      const insideX = pt.x >= open.layout.left && pt.x <= open.layout.left + MENU_W;
      const insideY = pt.y >= open.layout.top && pt.y <= open.layout.itemsTop + rows * ITEM_H;
      if (!insideX || !insideY) close();
      return;
    }
    if (e.nativeEvent.touches.length !== 1) { clearTimer(); start.current = null; return; } // pinch
    const pt = local(e);
    start.current = pt;
    clearTimer();
    timer.current = setTimeout(async () => {
      timer.current = null;
      const at = start.current;
      if (!at) return;
      if (!canStart()) { start.current = null; return; }
      onLockMap(true);
      const coord = await getCoordinate(at).catch(() => null);
      if (!coord || !start.current) { onLockMap(false); return; } // finger lifted meanwhile
      // Only one place it can go (one group, or just me): skip the list.
      if (options.length === 1) {
        start.current = null;
        onLockMap(false);
        onPick(coord, options[0]);
        return;
      }
      setPicker({ coord, layout: menuLayout(at.x, at.y, rows, origin.current.w, origin.current.h), mode: 'drag' });
      setHover(null);
      onPendingChange(coord);
    }, HOLD_MS);
  };

  const onTouchMove = (e: GestureResponderEvent) => {
    const p = pickerRef.current;
    if (p?.mode === 'drag') {
      const pt = local(e);
      setHover(hoverIndex(pt.x, pt.y, p.layout, rows));
      return;
    }
    const s = start.current;
    if (!p && s && timer.current) {
      const pt = local(e);
      if (Math.hypot(pt.x - s.x, pt.y - s.y) > MOVE_TOLERANCE || e.nativeEvent.touches.length > 1) {
        clearTimer(); // it's a pan or pinch
        start.current = null;
      }
    }
  };

  const onTouchEnd = () => {
    clearTimer();
    start.current = null;
    const p = pickerRef.current;
    if (p?.mode !== 'drag') return;
    if (hoverRef.current !== null) choose(hoverRef.current);
    else {
      setPicker({ ...p, mode: 'tap' }); // let go without sliding: keep the list open to tap
      onLockMap(false);
    }
  };

  const onTouchCancel = () => {
    if (pickerRef.current?.mode === 'drag') close();
    clearTimer();
    start.current = null;
  };

  return (
    <View
      ref={viewRef}
      style={styles.fill}
      onLayout={() => viewRef.current?.measureInWindow((x, y, w, h) => { origin.current = { x, y, w, h }; })}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      {children}
      {picker && (
        <View style={[styles.menu, { left: picker.layout.left, top: picker.layout.top }]}>
          <Text style={styles.title}>{picker.mode === 'drag' ? 'Slide to a group, then let go' : 'Meeting place for…'}</Text>
          {options.map((o, i) => (
            <Pressable key={o.id ?? 'me'} onPress={() => choose(i)} style={[styles.row, hover === i && styles.rowActive]}>
              <Text style={[styles.rowText, hover === i && styles.rowTextActive]} numberOfLines={1}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={close} style={[styles.row, hover === options.length && styles.rowCancel]}>
            <Text style={[styles.rowText, { color: hover === options.length ? '#fff' : colors.muted }]}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  menu: { position: 'absolute', width: MENU_W, backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  title: { height: 28, lineHeight: 28, paddingHorizontal: 12, color: colors.muted, fontSize: 12, fontWeight: '700' },
  row: { height: ITEM_H, justifyContent: 'center', paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.bg },
  rowActive: { backgroundColor: colors.meeting },
  rowCancel: { backgroundColor: colors.danger },
  rowText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowTextActive: { color: '#fff' },
});
