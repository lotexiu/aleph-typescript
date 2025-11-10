import type { TNever } from "@ts/types";

/**
 * Returns the first element of an array.
 * @example
 * type FirstElement = First<[number, string, boolean]>; // number
 */
type TFirst<T extends any[], _nv extends TNever = never> = T extends [infer Rest, ...infer Last] ? Rest : _nv;

/**
 * Returns the last element of an array.
 * @example
 * type LastElement = Last<[number, string, boolean]>; // boolean
 */
type TLast<T extends any[], _nv extends TNever = never> = T extends [...infer Rest, infer Last] ? Last : _nv;

/**
 * Represents an array type.
 * @example
 * type NumberArray = ArrayType<number>; // number[]
 * type MixedArray = ArrayType<[number, string]>; // [number, string]
 */
type TArrayType<
  Types = any[],
  Inf extends boolean = false,
  InfType = TNever,
  _nv extends TNever = never
> = [
  ...Types extends any[] ? Types : [Types],
  ...Inf extends true ? 
    InfType extends TNever ?
      Types extends any[] ? 
        TLast<Types, _nv>[] : Types[] : 
      InfType[] : []
]

/**
 * Defines a value or a read-only array-like structure with a `.length` property and indexed values.
 * @example
 * type ArrayLikeString = ArrayLike<string>; // { readonly length: number; readonly [index: number]: string; }
 */
type TArrayLike<T> = ArrayLike<T>;

/**
 * Extracts the values from a tuple or array type.
 * @example
 * type Values = ExtractValues<[1, 2, 3]>; // 1 | 2 | 3
 */
type TExtractValues<T extends readonly any[]> = T[number];

/**
 * Builds an array of a given length and type.
 * @example
 * type FiveNumbers = BuildArray<5, [], number>; // number[] with length 5
 */
type TBuildArray<
  Length extends number,
  Acc extends unknown[] = [],
  Type = any
> = Acc['length'] extends Length ? Acc : TBuildArray<Length, [...Acc, Type], Type>;

/**
 * Represents a tuple of two types.
 * @example
 * type PairExample = Pair<string, number>; // [string, number]
 */
type TPair<T=any,T2=any> = [T, T2]

/**
 * Gets the item type of an array.
 * @example
 * type Item = ItemType<number[]>; // number
 */
type TItemType<T> = T extends (infer U)[] ? U : never;

/**
 * Represents a standard array type.
 * @example
 * type MyArray = Array<string>; // string[]
 */
type TArray<T=any> = Array<T>

type TAsArray<T> = T extends any[] ? T : never;

type TOptionalArray<T extends any[]> = {
  [K in keyof T]?: T[K];
}

export type { 
  TFirst,
  TLast,
  TArrayType,
  TArrayLike,
  TExtractValues,
  TBuildArray,
  TPair,
  TItemType,
  TArray,
  TAsArray,
  TOptionalArray,
}