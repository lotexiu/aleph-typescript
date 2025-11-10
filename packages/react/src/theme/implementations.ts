import { ThemeUtils } from "@lotexiu/typescript/theme/utils";
import Color from "colorjs.io";

export const DefaultReactThemeBuilder = ThemeUtils.themeSchema(
  ["background", "foreground", "primary", "accent"],"background",
  {
    card: ({background, foreground}) => foreground.mix(background, 0.9, {space: 'lch'}),
    popover: ({background, foreground}) => foreground.mix(background, 0.8, {space: 'lch'}),
    // Functional
    secondary: ({primary, accent}) => primary.mix(accent, 0.5, {space: 'lch'}),
    destructive: ({accent})=> new Color("red").mix(accent, 0.4, {space: 'lch'}),
    muted: ({background, foreground}) => background.mix(foreground, 0.8, {space: 'lch'}),
    border: ({primary, foreground}) => primary.mix(foreground, 0.1, {space: 'lch'}),
    input: ({primary, foreground}) => primary.mix(foreground, 0.25, {space: 'lch'}),
    ring: ({primary, foreground}) => primary.mix(foreground, 0.4, {space: 'lch'}),
    // Charts 
    "chart-1": ({background})=> new Color("#003f5c").mix(background, 0.3, {space: 'lch'}),
    "chart-2": ({background})=> new Color("#444e86").mix(background, 0.3, {space: 'lch'}),
    "chart-3": ({background})=> new Color("#955196").mix(background, 0.3, {space: 'lch'}),
    "chart-4": ({background})=> new Color("#dd5182").mix(background, 0.3, {space: 'lch'}),
    "chart-5": ({background})=> new Color("#ff6e54").mix(background, 0.3, {space: 'lch'}),
    "chart-6": ({background})=> new Color("#ffa600").mix(background, 0.3, {space: 'lch'}),
    // Sidebar
    sidebar: ({background, primary}) => background.mix(primary, 0.2),
    sidebarPrimary: ({primary, accent}) => primary.mix(accent, 0.3),
    sidebarAccent: ({accent, primary}) => accent.mix(primary, 0.2),
    sidebarBorder: ({foreground, background}) => foreground.mix(background, 0.8),
    sidebarRing: ({accent, foreground}) => accent.mix(foreground, 0.3),
    // Base
    error: ({foreground})=> new Color("red").mix(foreground, 0.15, {space: 'lch'}),
    warning: ({accent})=> new Color("orange").mix(accent, 0.2, {space: 'lch'}),
    success: ({accent})=> new Color("rgb(0,220,80)").mix(accent, 0.2, {space: 'lch'}),
  }, {
    cardForeground: ({card}) => ThemeUtils.oppositeColor(card, {l:"full", s:"decrease"}),
    popoverForeground: ({popover}) => ThemeUtils.oppositeColor(popover, {l:"full", s:"decrease"}),
    primaryForeground: ({primary}) => ThemeUtils.oppositeColor(primary, {l:"full", s:"decrease"}),
    secondaryForeground: ({secondary}) => ThemeUtils.oppositeColor(secondary, {l:"full", s:"decrease"}),
    mutedForeground: ({muted}) => ThemeUtils.oppositeColor(muted, {l:"full", s:"decrease"}),
    accentForeground: ({accent}) => ThemeUtils.oppositeColor(accent, {l:"full", s:"decrease"}),
    sidebarForeground: ({sidebar}) => ThemeUtils.oppositeColor(sidebar, {l:"full", s:"decrease"}),
    sidebarPrimaryForeground: ({sidebarPrimary}) => ThemeUtils.oppositeColor(sidebarPrimary, {l:"full", s:"decrease"}),
    sidebarAccentForeground: ({sidebarAccent}) => ThemeUtils.oppositeColor(sidebarAccent, {l:"full", s:"decrease"}),
  }, (theme) => {
    theme.getVariations.forEach((key) => {
      const fontKey = `${key}Foreground`;
      if (fontKey in theme) {
        const contrast = theme[key].contrast((theme as any)[fontKey], 'WCAG21');
        if (contrast < 4.5) {
          console.error(`[WCAG21][VARIATION] Insufficient contrast (${contrast.toFixed(2)}). Minimum is 4.5 between '${key}' and '${fontKey}'. ${theme[key].toString()} vs ${(theme as any)[fontKey].toString()}`);
          return;
        }
        if (contrast < 7) {
          console.warn(`[WCAG21][FONT] Low contrast (${contrast.toFixed(2)}). Recommended to be above 7 between '${key}' and '${fontKey}'. ${theme[key].toString()} vs ${(theme as any)[fontKey].toString()}`);
          return;
        } 
      }
    })
  }
);

export const DefaultReactThemes = {
  // --- 1. TEMA BÁSICO (Para um visual sóbrio e profissional) ---
  basic: {
    dark: DefaultReactThemeBuilder({
      accent: "rgb(255, 87, 34)",     // Laranja Vibrante
      background: "rgb(33, 33, 33)",  // Cinza Escuro
      foreground: "rgb(245, 245, 245)",// Quase Branco
      primary: "rgb(30, 136, 229)"    // Azul Padrão
    }),
    light: DefaultReactThemeBuilder({
      accent: "rgb(255, 87, 34)",     // Laranja Vibrante
      background: "rgb(250, 250, 250)",// Cinza Claro
      foreground: "rgb(51, 51, 51)",  // Cinza Escuro para Leitura
      primary: "rgb(25, 118, 210)"    // Azul Mais Escuro
    })
  },

  // --- 2. TEMA SYNTHWAVE (Cores neon e ambiente escuro) ---
  synthwave: {
    dark: DefaultReactThemeBuilder({
      accent: "rgb(255, 0, 150)",     // Rosa Neon
      background: "rgb(15, 0, 30)",   // Roxo Escuro Profundo
      foreground: "rgb(0, 255, 255)", // Ciano/Turquesa Neon
      primary: "rgb(255, 130, 0)"     // Laranja Brilhante
    }),
    light: DefaultReactThemeBuilder({
      // Difícil para synthwave, mas tentando manter a paleta clara
      accent: "rgb(255, 0, 150)",
      background: "rgb(240, 240, 240)",
      foreground: "rgb(50, 50, 100)",
      primary: "rgb(0, 200, 200)"
    })
  },

  // --- 3. TEMA MINIMALIST (Clean, focando em branco, preto e um toque de cor) ---
  minimalist: {
    dark: DefaultReactThemeBuilder({
      accent: "rgb(120, 120, 120)",   // Cinza Suave
      background: "rgb(18, 18, 18)",  // Preto Profundo
      foreground: "rgb(230, 230, 230)",// Branco Suave
      primary: "rgb(100, 200, 100)"   // Verde Calmo (Para Destaque)
    }),
    light: DefaultReactThemeBuilder({
      accent: "rgb(150, 150, 150)",   // Cinza Médio
      background: "rgb(255, 255, 255)",// Branco Puro
      foreground: "rgb(30, 30, 30)",  // Preto Forte
      primary: "rgb(80, 180, 80)"     // Verde Calmo
    })
  },

  // --- 4. TEMA FOREST (Inspirado em musgo, madeira e céu) ---
  forest: {
    dark: DefaultReactThemeBuilder({
      accent: "rgb(200, 150, 100)",   // Marrom Claro (Madeira)
      background: "rgb(20, 40, 25)",  // Verde Escuro Profundo (Floresta)
      foreground: "rgb(220, 255, 220)",// Branco Esverdeado
      primary: "rgb(80, 180, 80)"     // Verde Musgo
    }),
    light: DefaultReactThemeBuilder({
      accent: "rgb(130, 90, 50)",     // Marrom Escuro
      background: "rgb(230, 245, 230)",// Verde/Cinza Muito Claro
      foreground: "rgb(30, 40, 30)",  // Verde Escuro para Texto
      primary: "rgb(40, 140, 40)"     // Verde Floresta
    })
  },

  // --- 5. TEMA OCEANIC (Azuis profundos e areia) ---
  oceanic: {
    dark: DefaultReactThemeBuilder({
      accent: "rgb(0, 191, 255)",     // Azul Céu Claro
      background: "rgb(10, 20, 50)",  // Azul Marinho Profundo
      foreground: "rgb(255, 250, 240)",// Areia/Branco
      primary: "rgb(0, 128, 192)"     // Azul Médio (Oceano)
    }),
    light: DefaultReactThemeBuilder({
      accent: "rgb(0, 120, 180)",     // Azul Oceano
      background: "rgb(240, 250, 255)",// Branco Azulado
      foreground: "rgb(20, 40, 60)",  // Azul Escuro para Texto
      primary: "rgb(50, 150, 220)"    // Azul Céu
    })
  },

  // --- 6. TEMA VOLCANIC (Cores quentes e ricas) ---
  volcanic: {
    dark: DefaultReactThemeBuilder({
      accent: "rgb(255, 120, 0)",     // Laranja Lava
      background: "rgb(40, 20, 20)",  // Vermelho Escuro/Preto Vulcânico
      foreground: "rgb(250, 250, 200)",// Creme/Areia
      primary: "rgb(200, 0, 0)"       // Vermelho Forte
    }),
    light: DefaultReactThemeBuilder({
      accent: "rgb(200, 80, 0)",      // Laranja Escuro
      background: "rgb(255, 245, 240)",// Salmão Claro
      foreground: "rgb(80, 30, 30)",  // Marrom Escuro Avermelhado
      primary: "rgb(150, 0, 0)"       // Vermelho Vinho
    })
  }
};