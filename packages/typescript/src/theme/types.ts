import { TAsArray } from "@tsn-array/generic/types"
import type { TRecord } from "@tsn-object/generic/types"
import type Color from "colorjs.io"
import type { ColorTypes } from "colorjs.io"

type TMainColors<T=any, R=ColorTypes> = { [key in TAsArray<T>[number]]: R }

type TColorBuilder<K> = (mainColors: TMainColors<K,Color>, darkTheme: boolean) => Color

type TThemeVariationsBuilder<K> = {
  [key: string]: TColorBuilder<K> | ColorTypes
}

type TTheme<K=any, T1=any, T2=any> = TRecord<K, Color> & TRecord<T1, Color> & TRecord<T2, Color> & {
  getBackground: Color,
  getMainColors: K,
  getVariations: [keyof T1],
  getFontVariations: [keyof T2],
}

/**
 * A function that takes the main colors and returns the themed colors.
 * @param mainColors - The main colors to use for the theme.
 * @returns The themed colors.
 */
type TThemeBuilder<K, R = any> = (mainColors: TMainColors<K>, validate?: boolean) => TTheme<K, R>

type R = TThemeBuilder<["background"]>


type TOppositeColorOptions = {
  l?: "full" | boolean,
  h?: boolean,
  s?: "decrease" | "increase" | boolean,
}

export {
  TMainColors,
  TColorBuilder,
  TThemeVariationsBuilder,
  TThemeBuilder,
  TTheme,
  TOppositeColorOptions,
}