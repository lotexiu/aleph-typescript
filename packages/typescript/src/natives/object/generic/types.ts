import type { TFunction } from "@tsn-function/generic/types";
import type { TAsArray, TPair } from "@tsn-array/generic/types";
import type { Pick } from "./types.native";
import { As } from "@ts/types";

type TCommonFields<T, U> = Pick<T, Extract<keyof T, keyof U>>;

type TPrimitiveObject = {
  [key: TKeyOf]: any;
} & Object

/**
 * Converts each property of a type into a union of single-property objects.
 * @template T - The object or class type
 *
 * @example
 * interface Example {
 *   id: number;
 *   name: string;
 * }
 * type Unionized = Unionize<Example>;
 * // Result: { id: number } | { name: string }
 */
type TUnionize<T> = {
  [Key in keyof T]: {
    [Key2 in Key]: T[Key2];
  }
}[keyof T];

type TObject<T=Object> =
  T extends Function ? never :
  T extends Array<any> ? never :
  T extends object ? T :
  never;

/**
 * Maps a type to a set of return types based on a list of pairs.
 *
 * @template Type - The type to match against the first element of each pair.
 * @template Returns - An array of pairs [key, returnType].
 *
 * @example
 * type CReturn<T> = CustomReturn<T, [
 *   ["X", string],
 *   ["Y" | "K", number]
 * ]>;
 *
 * type Result1 = CReturn<"X" | "Y">; // string | number
 * type Result2 = CReturn<"Y">; // number
 * type Result3 = CReturn<"K">; // number
 * type Result4 = CReturn<"X">; // string
 * type Result5 = CReturn<"Z">; // never
 *
 * // Result: Returns the mapped type for the given key, or never if not found.
 */
type TCustomReturn <
Type, 
Returns extends TPair<any, any>[]
> = {
  [Return in TKeyOf<Returns>]: 
    Type extends Returns[Return][0] ?
      Returns[Return][1] :
      never
}[number]

/**
 * Returns the keys that are of a specific type in the target object.
 *
 * @template Target - The object or class type
 * @template Type - The type to match
 *
 * @example
 * interface Example {
 *   id: number;
 *   name: string;
 *   isActive: boolean;
 * }
 * type StringKeys = KeysOfType<Example, string>; // "name"
 *
 * @returns A union of keys whose values match the specified type.
 */
type TKeysOfType<
  Target, 
  Type
> = {
  [Key in TKeyOf<Target>]: Target[Key] extends Type ? Key : never
}[TKeyOf<Target>]

/**
 * Returns the key if it exists in the target and matches the type.
 *
 * @template Target - The object or class type
 * @template Key - The key to check
 * @template Type - The type to match
 *
 * @example
 * interface Example {
 *   id: number;
 *   name: string;
 * }
 * type ExactKey = HasExactKey<Example, 'id', number>; // 'id'
 *
 * @returns The key if it matches the type, otherwise never.
 */
type THasExactKey <
  Target, 
  Key extends TKeyOf<Target>,
  Type extends Target[Key]
> = Target[Key] extends Type ? Key : never

/**
 * Concatenates a prefix and capitalizes the first letter of each method key.
 *
 * @template Base - The base object or class
 * @template Prefix - The prefix string
 *
 * @example
 * interface Methods {
 *   getName(): string;
 *   getAge(): number;
 * }
 * type PrefixedMethods = ConcatStrIntoKeys<Methods, 'prefix'>;
 * // {
 * //   prefixGetName(): string;
 * //   prefixGetAge(): number;
 * // }
 */
type TConcatStrIntoKeys<Base, Prefix extends string|null|undefined> = {
  [Key in TKeyOf<Base> as 
    Key extends string ? `${Prefix}${Capitalize<Key>}`
    : never
  ]: Base[Key];
};

/**
 * Extracts the type of a specific key from an object or class.
 *
 * @template T - The object or class type
 * @template K - The key to extract
 *
 * @example
 * interface Example {
 *   id: number;
 * }
 * type IdType = GetTypeFromKey<Example, 'id'>; // number
 */
type TTypeFromKey<T, K extends TKeyOf<T>> = T[K];

/**
 * Returns a tuple of [key, value] for an object or class.
 *
 * @template T - The object or class type
 *
 * @example
 * interface Example {
 *   id: number;
 *   name: string;
 * }
 * type Entry = EntriesReturn<Example>; // ["id" | "name", number | string]
 */
type TEntriesReturn<T> = [TKeyOf<T>, TTypeFromKey<T, TKeyOf<T>>];

/**
 * Function type for removing circular references from an object.
 *
 * @example
 * const cleaned = removeCircularReferences(obj);
 */
type TRemoveCicularReferences = TFunction<[string, any], any> ;

/**
 * Makes all properties of an object or array deeply optional.
 *
 * @template T - The object or array type
 *
 * @example
 * interface Example {
 *   id: number;
 *   nested: { value: string };
 * }
 * type PartialExample = DeepPartial<Example>;
 * // { id?: number; nested?: { value?: string } }
 */
type TDeepPartial<T> =
  T extends (...args: any[]) => any ? any :
  T extends Array<infer U> ? Array<TDeepPartial<U>> :
  T extends object ? {
    [K in keyof T]?: TDeepPartial<T[K]>|T[K]
  } :
  T;

type TAsKeys<
  T,
  Else = never
> = T extends TKeyOf ? T : Else;

type TRecord<T, R> = 
  T extends TAsKeys<T>
    ? { [key in T]: R }
    : T extends TAsArray<T>
      ? { [key in TAsArray<T>[number]]: R }
      : { [key in TKeyOf<T>]: R }

type TKeyOfOptions<T> = TUnionize<{
  extract?: keyof T,
  exclude?: keyof T,
}>

/**
 * Type that returns the keys of a type as a union of strings.
 *
 * @template T - The type of the object or class
 *
 * @example
 * interface Example {
 *   id: number;
 *   name: string;
 * }
 *
 * type Keys = KeyOf<Example>; // "id" | "name"
 */
type TKeyOf<
  T=any, 
  KeyType extends (TKeyOfOptions<WeakValidation extends true ? any : T>|null)=null,
  WeakValidation extends boolean = true
> = 
  KeyType extends null 
    ? keyof T 
    : KeyType extends { extract: infer E }
      ? Extract<keyof T, E & string>
      : KeyType extends { exclude: infer Ex }
        ? Exclude<keyof T, Ex & string>
        : keyof T
;

export type {
  TCommonFields,
  TRemoveCicularReferences,
  TPrimitiveObject,
  TObject,
  TEntriesReturn,
  TTypeFromKey,
  TConcatStrIntoKeys,
  TKeysOfType,
  TCustomReturn,
  TDeepPartial,
  THasExactKey,
  TAsKeys,
  TRecord,
  TKeyOf,
  TKeyOfOptions
};
