import Color from "colorjs.io";
import { TMainColors, TOppositeColorOptions, TTheme, TThemeBuilder, TThemeVariationsBuilder } from "./types";
import { TObject } from "@tsn-object/generic/types";

/**
 * Creates a theme schema with the specified main colors and rules.
 * @param mainColors - The main colors to include in the theme.
 * @param variations - The rules to apply to the theme.
 * @returns A function that takes the main colors and returns the themed colors.
 */
export function themeSchema<
  const K extends string[],
  T1 extends TThemeVariationsBuilder<K>,
  T2 extends TThemeVariationsBuilder<K|[keyof T1]>
>(
  mainColors: K,
  backgroundKey: K[number],
  variations: T1,
  fontVariations: T2,
  validator?: (theme: TTheme<K, T1, T2>) => void
): TThemeBuilder<K,T1> {
  return (colors: TMainColors<any>, validate?: boolean): TTheme<K, T1, T2> => {
    validateMainColors<K>(mainColors, colors);
    const theme: TTheme = mapMainColorsToTheme(colors);
    const darkTheme = theme[backgroundKey].lch.l < 50;
    processThemeDefinitions<T1, T2>(variations, theme, darkTheme, fontVariations);
    initializeThemeProperties<K, T1, T2>(theme, backgroundKey, mainColors, variations, fontVariations);
    if (validate){
      checkVariationContrast(theme);
      validator?.(theme as any);
    }
    return theme as any;
  }
}

function checkVariationContrast<T extends TTheme>(theme: TObject<T>) {
  theme.getVariations.forEach((key) => {
    if (!(key in theme)) {
      throw new Error(`Missing theme variation color: ${key.toString()}`);
    }
    const contrast = theme[key as string].contrast(theme.getBackground, "Lstar");
    if (contrast < 8) {
      console.warn(`[Lstar][VARIATION] Low contrast (${contrast.toFixed(2)}). Recommended to be above 8 between '${key.toString()}' and background.`);
    }
  });
}

function initializeThemeProperties<const K extends string[],
  T1 extends TThemeVariationsBuilder<K>,
  T2 extends TThemeVariationsBuilder<K | [keyof T1]>
>(
  theme: TTheme,
  backgroundKey: K[number],
  mainColors: K,
  variations: T1,
  fontVariations: T2
) {
  theme.getBackground = theme[backgroundKey];
  theme.getMainColors = mainColors;
  theme.getVariations = Object.keys(variations) as [keyof T1];
  theme.getFontVariations = Object.keys(fontVariations) as [keyof T2];
}

function processThemeDefinitions<
  T1 extends TThemeVariationsBuilder<any>,
  T2 extends TThemeVariationsBuilder<any | [keyof T1]>
> (
  variations: T1, 
  theme: Record<string, Color>, 
  darkTheme: boolean, 
  fontVariations: T2
) {
  Object.entries(variations).forEach(([key, value]) => {
    if (typeof value === "function") {
      theme[key] = new Color(value(theme, darkTheme)).to('lch');
    } else {
      theme[key] = new Color(value).to('lch');
    }
  });

  Object.entries(fontVariations).forEach(([key, value]) => {
    if (typeof value === "function") {
      theme[key] = new Color(value(theme, darkTheme)).to('lch');
    } else {
      theme[key] = new Color(value).to('lch');
    }
  });
}

function mapMainColorsToTheme(colors: TMainColors<any>): TTheme {
  const theme: TTheme = {} as TTheme;
  Object.entries(colors).forEach(([key, value]) => {
    theme[key] = new Color(value).to('lch');
  });
  return theme;
}

function validateMainColors<const K extends string[]>(mainColors: K, colors: TMainColors<any>) {
  const colorsNotFounded = mainColors.filter((key => !(key in colors)));
  if (colorsNotFounded.length > 0) {
    throw new Error(`Missing main colors: ${colorsNotFounded.join(", ")}`);
  }
}

function applyThemeToDocument<T extends TTheme>(theme: TObject<T>) {
  const root = document.documentElement;
  Object.entries(theme).forEach(([key, value]) => {
    root.style.setProperty(`--${key.toKebabCase()}`, value.toString());
  });
}

function oppositeColor(color: Color, options: TOppositeColorOptions={h: true}): Color {
  const lch = color.to("oklch");
  const h = options.h ? (lch.h + 180) % 360 : lch.h;
  
  // const l = options.l ? 1 - lch.l : lch.l;
  let l = lch.l;
  switch(options.l) {
    case "full": { l = lch.l < 0.5 ? 1 : 0; break; }
    case true: { l = 1 - lch.l; break; }
  }

  let c = lch.c;
  switch(options.s) {
    case "decrease": { c = lch.c * 0.2; break; }
    case "increase": { c = Math.min(lch.c * 1.5, 0.4); break; }
    case true: { c = lch.c * (lch.c < 0.1 ? 4 : 0.25); break; }
  }
  return color.to("oklch").set({l, c, h});
}

export const _Theme = {
  themeSchema,
  applyThemeToDocument,
  oppositeColor,
}

/**
 * ## HINTS ##
 * 
 * - About checking the contrast between colors, its recommended to use WCAG21 for text and Lstar for UI elements.
 *  - WCAG21: min: 4.5; recommended: ^7
 *  - Lstar: min: 8; recommended: ^15
 * 
 * - Recommended to use space colors below for color mixing to get best results:
 *  - a98rgb
 *  - hsl
 *  - hwb
 *  - lch
 *  - oklch
 */