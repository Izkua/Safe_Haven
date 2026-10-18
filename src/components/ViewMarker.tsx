// [OWNER: MAP] A map Marker with a custom view that snapshots it once instead of every frame.
// react-native-maps defaults tracksViewChanges to true, which re-renders each custom marker's bitmap
// continuously; on Android (Google Maps) that ran the Java heap out (OutOfMemoryError in maps_core).
// The view is tracked briefly (1.5 s) after mount so it is captured once laid out, then frozen. Callers
// re-key the marker on whatever the view shows, so a change remounts it and it is captured again.
import { useEffect, useState, type ComponentProps } from 'react';
import { Marker } from 'react-native-maps';

// Long enough for a profile photo (data URI) to decode before the pin is frozen.
const CAPTURE_MS = 1500;

export function ViewMarker(props: ComponentProps<typeof Marker>) {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracking(false), CAPTURE_MS);
    return () => clearTimeout(t);
  }, []);
  return <Marker {...props} tracksViewChanges={tracking} />;
}
