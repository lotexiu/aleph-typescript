const _typeof = typeof '';
type TTypeOfValue = typeof _typeof;

/**
 * Type representing `null` or `never`.
 */
type TNever<T extends null|never = null> = T;
// type INever<T extends null|never = null> = T;

/**
 * Type that allows `null` or `undefined` in addition to the specified type.
 * 
 * @example
 * type NullableString = Nullable<string>; // string | null | undefined
 */
type TNullable<
  Type=any,
  NoVoid extends boolean = false
> = NoVoid extends false ?
  Type | undefined | null | void :
  Type | undefined | null;

type TNotUndefined<T> = T extends undefined ? never : T;

type As<T,U> = T extends U ? T&U : never;

export type { 
  TNever,
  TNullable,
  TNotUndefined,
  TTypeOfValue,
  As,
}