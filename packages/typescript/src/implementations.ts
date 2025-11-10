import type { TNullable } from "@ts/types";
import { circularReferenceHandler } from "@tsn-object/generic/implementations";


export function json(obj: any): string {
  return JSON.stringify(obj, circularReferenceHandler());
}

export function isNull<T>(value: TNullable<T>, ...customNullValues: any[]): value is TNullable<null> {
  const negatedValues = [0, '', false] as typeof value[];
  const jsonNullValues: string[] = customNullValues.map((v: any): string=> json(v));
  return (
    jsonNullValues.includes(json(value)) ?
      true :
      !negatedValues.includes(value) && !value
  );
}

export function isNullOrUndefined<T>(value: TNullable<T>): value is TNullable<null> {
  return value == null || value == undefined;
}

export function equals<T,R>(a: T, b: R, ...customNullValues: any[]): a is T&R {
  let result: boolean = isNull(a, ...customNullValues) && isNull(b, ...customNullValues);
  if (!result) {
    result = json(a) == json(b);
  }
  return result;
}