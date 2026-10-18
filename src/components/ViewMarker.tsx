// [OWNER: MAP] A map Marker with a custom view that snapshots it once instead of every frame.
// react-native-maps defaults tracksViewChanges to true, which re-renders each custom marker's bitmap
// continuously; on Android (Google Maps) that ran the Java heap out (OutOfMemoryError in maps_core).
// The view is tracked briefly (1.5 s) after mount so it is captured once laid out, then frozen. Callers
// re-key the marker on whatever the view shows, so a change remounts it and it is captured again.
// Something inside that finishes later (a profile photo loading) calls useMarkerRedraw() to be
// captured again.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Marker } from 'react-native-maps';

// Long enough for the view to lay out (and a cached photo to decode) before the pin is frozen.
const CAPTURE_MS = 1500;

const RedrawContext = createContext<() => void>(() => {});

/** Inside a ViewMarker: call after the view changes on its own (e.g. an image loaded) to re-capture it. */
export const useMarkerRedraw = () => useContext(RedrawContext);

export function ViewMarker(props: ComponentProps<typeof Marker>) {
  const [tracking, setTracking] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capture = useCallback(() => {
    setTracking(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTracking(false), CAPTURE_MS);
  }, []);
  useEffect(() => {
    capture();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [capture]);
  return (
    <RedrawContext.Provider value={capture}>
      <Marker {...props} tracksViewChanges={tracking} />
    </RedrawContext.Provider>
  );
}
