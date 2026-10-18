// App entry. Same as expo-router's default entry, except it loads the saved appearance (Dark /
// Light / Match phone) BEFORE any screen module, so src/theme.ts resolves the right colors.
// (Android can't swap colors after they're resolved; iOS can, but this also avoids a dark flash.)
// `@expo/metro-runtime` must be the first import (Fast Refresh).
import '@expo/metro-runtime';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { useEffect, useState, type ComponentType } from 'react';
import { prepareAppearance } from './src/lib/appearance';

function Root() {
  const [App, setApp] = useState<ComponentType | null>(null);

  useEffect(() => {
    prepareAppearance().finally(() => {
      // Required lazily so the routes (and the theme they import) load after the preference.
      const { App: RouterApp } = require('expo-router/build/qualified-entry') as { App: ComponentType };
      setApp(() => RouterApp);
    });
  }, []);

  return App ? <App /> : null;
}

renderRootComponent(Root);
