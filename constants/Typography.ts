// Familias de fuente (coinciden con el frontend web Grankers)
// Barlow  → headings, títulos, valores destacados (equivale a --font-outfit en web)
// DM_Sans → body text, labels, captions     (equivale a --font-inter en web)
// Nombres exactos de los exports de @expo-google-fonts/*
export const FontFamily = {
  heading: 'Barlow_700Bold',
  headingBold: 'Barlow_800ExtraBold',
  headingSemi: 'Barlow_600SemiBold',
  headingMedium: 'Barlow_500Medium',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemi: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
};

// ─── Escala de texto (mirror del sistema CSS del frontend) ────────────────────
export const FontSize = {
  h1: 36,       // web: 60px — reducido para pantalla móvil
  h2: 28,       // web: 44px
  h3: 22,       // web: 32px
  h4: 18,       // web: 24px
  bodyL: 17,    // web: 18px
  bodyM: 15,    // web: 16px
  bodyS: 13,    // web: 14px
  caption: 11,  // web: 12px
};

// ─── Altura de línea ──────────────────────────────────────────────────────────
export const LineHeight = {
  h1: 42,
  h2: 34,
  h3: 28,
  h4: 24,
  bodyL: 26,
  bodyM: 22,
  bodyS: 19,
  caption: 16,
};

// ─── Pesos ────────────────────────────────────────────────────────────────────
export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
};

// ─── Letter spacing ───────────────────────────────────────────────────────────
export const LetterSpacing = {
  h1: -0.5,
  h2: -0.3,
  body: 0,
  label: 0.3,
  caption: 0.4,
};
