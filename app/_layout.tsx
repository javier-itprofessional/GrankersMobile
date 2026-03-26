import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CompetitionProvider } from "../providers/CompetitionProvider";
import { FreePlayProvider } from "../providers/FreePlayProvider";
import { PlayerAuthContext } from "../providers/PlayerAuthProvider";
import { trpc, trpcClient } from "../lib/trpc";

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
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
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
    </trpc.Provider>
  );
}
