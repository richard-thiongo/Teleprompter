import { DarkTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Colors } from '@/constants/theme';
import { ScriptsProvider } from '@/hooks/use-scripts';

import AppTabs from '@/components/app-tabs';

// Prevent the splash screen from hiding until the navigator is ready.
// This eliminates the expo-router race condition where useLinking tries
// to update state before ContextNavigator has mounted.
SplashScreen.preventAutoHideAsync();

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.backgroundElement,
    text: Colors.dark.text,
  },
};

export default function TabLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={CustomDarkTheme}>
      <ScriptsProvider>
        <AppTabs />
      </ScriptsProvider>
    </ThemeProvider>
  );
}
