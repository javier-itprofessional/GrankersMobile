import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DatabaseProvider } from "@nozbe/watermelondb/react";
import { database } from "../database";
import { CompetitionProvider } from "../providers/CompetitionProvider";
import { FreePlayProvider } from "../providers/FreePlayProvider";
import { PlayerAuthContext } from "../providers/PlayerAuthProvider";
import { configureGoogleSignIn } from "../services/auth";
import { verifyMagicLink } from "../services/auth";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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
  useEffect(() => {
    configureGoogleSignIn();
    SplashScreen.hideAsync();
  }, []);

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

    // Handle deep link when app is already open
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Handle deep link that launched the app
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <DatabaseProvider database={database}>
      <QueryClientProvider client={queryClient}>
        <PlayerAuthContext>
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
