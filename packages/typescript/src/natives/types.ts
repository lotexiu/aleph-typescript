/**
 * Recursively unwraps the "awaited" type of a type. Non-promise thenables should resolve to `never`. This emulates the behavior of `await`.
 * 
 * @example
 * type AwaitedString = _Awaited<Promise<string>>; // string
 */
type _IAwaited<T> = Awaited<T>;

/**
 * Marker for type position without inference.
 * 
 * @example
 * type NoInferExample<T> = _NoInfer<T>;
 */
type _INoInfer<T> = NoInfer<T>;

/**
 * Removes null and undefined from T.
 *
 * @example
 * type NonNullableExample = _NonNullable<string | null | undefined>; // string
 */
type _INonNullable<T> = NonNullable<T>;

/**
 * Excludes from T the types that are assignable to U.
 *
 * @example
 * type ExcludeExample = _Exclude<'a' | 'b' | 'c', 'a'>; // 'b' | 'c'
 */
type _IExclude<T, U> = Exclude<T, U>;

/**
 * Extracts from T the types that are assignable to U.
 *
 * @example
 * type ExtractExample = _Extract<'a' | 'b' | 'c', 'a' | 'b'>; // 'a' | 'b'
 */
type _IExtract<T, U> = Extract<T, U>;

export type {
  _IAwaited as Awaited, 
  _INoInfer as NoInfer,
  _INonNullable as NonNullable,
  _IExclude as Exclude,
  _IExtract as Extract,
}