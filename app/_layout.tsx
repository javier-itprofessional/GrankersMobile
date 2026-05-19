import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DatabaseProvider } from "@nozbe/watermelondb/react";
import { database } from "../database";
import { CompetitionProvider } from "../providers/CompetitionProvider";
import { FreePlayProvider } from "../providers/FreePlayProvider";
import { PlayerAuthContext, usePlayerAuth } from "../providers/PlayerAuthProvider";
import { configureGoogleSignIn } from "../services/auth";
import { verifyMagicLink } from "../services/auth";
import { syncEngine } from "../services/sync-engine";
import { refreshCourseCatalog } from "../services/course-service";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
  Barlow_800ExtraBold,
} from "@expo-google-fonts/barlow";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function SyncBootstrap() {
  const { isAuthenticated } = usePlayerAuth();
  const didPull = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !didPull.current) {
      didPull.current = true;
      // Both run in parallel, independently — neither blocks the UI
      syncEngine.pull().catch(() => {});
      refreshCourseCatalog().catch(() => {});
    }
    if (!isAuthenticated) {
      didPull.current = false;
    }
  }, [isAuthenticated]);

  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Atrás" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="competition/code-entry" options={{ headerShown: true }} />
      <Stack.Screen name="competition/confirmation" options={{ headerShown: true }} />
      <Stack.Screen name="competition/comprobacion" options={{ headerShown: false }} />
      <Stack.Screen name="game/scoring" options={{ headerShown: false }} />
      <Stack.Screen name="game/scorecard" options={{ headerShown: true }} />
      <Stack.Screen name="game/leaderboard" options={{ headerShown: true }} />
      <Stack.Screen name="game/review" options={{ headerShown: true }} />
      <Stack.Screen name="game/complete" options={{ headerShown: true }} />
      <Stack.Screen name="free-play/select-players" options={{ headerShown: true }} />
      <Stack.Screen name="free-play/setup" options={{ headerShown: true }} />
      <Stack.Screen name="free-play/search-license" options={{ headerShown: true }} />
      <Stack.Screen name="player-area/index" options={{ headerShown: true }} />
      <Stack.Screen name="player-area/login" options={{ headerShown: false }} />
      <Stack.Screen name="player-area/register" options={{ headerShown: false }} />
      <Stack.Screen name="player-area/competitions" options={{ headerShown: true }} />
      <Stack.Screen name="player-area/terms" options={{ headerShown: true }} />
      <Stack.Screen name="player-area/privacy" options={{ headerShown: true }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    Barlow_800ExtraBold,
  });

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const parsed = Linking.parse(url);
      const isAuthPath =
        parsed.path?.includes('auth/magic-link') ||
        parsed.hostname === 'auth' && parsed.path?.includes('magic-link');

      if (!isAuthPath) return;

      const token = parsed.queryParams?.token as string | undefined;
      if (!token) return;

      try {
        await verifyMagicLink(token);
        router.replace('/player-area');
      } catch {
        router.replace('/player-area/login?error=invalid_link');
      }
    };

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <DatabaseProvider database={database}>
      <QueryClientProvider client={queryClient}>
        <PlayerAuthContext>
          <SyncBootstrap />
          <CompetitionProvider>
            <FreePlayProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <RootLayoutNav />
              </GestureHandlerRootView>
            </FreePlayProvider>
          </CompetitionProvider>
        </PlayerAuthContext>
      </QueryClientProvider>
    </DatabaseProvider>
  );
}
