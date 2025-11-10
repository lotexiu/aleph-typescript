import type { Extract } from "@tsn/types";

/**
 * Makes all properties of T required.
 *
 * @example
 * type RequiredExample = _Required<{ a?: number; b?: string }>; // { a: number; b: string }
 */
type _IRequired<T> = Required<T>;

/**
 * Makes all properties of T readonly.
 *
 * @example
 * type ReadonlyExample = _Readonly<{ a: number; b?: string }>; // { readonly a: number; readonly b: string }
 */
type _IReadonly<T> = Readonly<T>;

/**
 * From T, picks a set of properties whose keys are in the union K.
 *
 * @example
 * type PickExample = _Pick<{ a: number; b: string }, 'a'>; // { a: number }
 */
type _IPick<T, KeyType> = {
  [K in keyof T as K extends KeyType ? K : never]: T[K]
}

/**
 * Constructs a type with a set of properties K of type T.
 *
 * @example
 * type RecordExample = _Record<'a' | 'b', number>; // { a: number; b: number }
 */
type _IRecord<K extends keyof any, T> = Record<K, T>;

/**
 * Constructs a type with the properties of T except for those in type K.
 *
 * @example
 * type OmitExample = _Omit<{ a: number; b: string }, 'a'>; // { b: string }
 */
type _IOmit<T, K extends keyof any> = Omit<T, K>;

/**
 * Makes all properties of T optional.
 *
 * @example
 * type PartialExample = _Partial<{ a: number; b: string }>; // { a?: number; b?: string }
 */
type _IPartial<T> = Partial<T>;

export type {
  _IRequired as Required,
  _IReadonly as Readonly,
  _IPick as Pick,
  _IRecord as Record,
  _IOmit as Omit,
  _IPartial as Partial,
}