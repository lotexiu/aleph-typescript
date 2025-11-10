import type { TConcatStrIntoKeys, TEntriesReturn, TKeyOf, TObject, TRemoveCicularReferences } from "./types";
import { _String } from "@tsn-string/generic/implementations";
import type { TClazz } from "@tsn-class/generic/types";
import { isNull } from "@ts/implementations";
import { TFunction, TLambdaToFunction } from "@tsn-function/generic/types";
import { GlobalDeclaration } from "@ts/global/types";


export function isEmptyObj(obj: TObject): obj is {} {
	for (let _x in obj) {
		return false;
	}
	return true;
}

export function circularReferenceHandler(): TRemoveCicularReferences {
  const seen = new Set();
  return function(key: string, value: any): any {
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) {
        return undefined;
      }
      seen.add(value);
    }
    return value;
  };
}

function addPrefixToKeys<
  T extends TObject, 
  Prefix extends string
>(value: T, prefix: Prefix): TConcatStrIntoKeys<T, Prefix> {
  type PrefixedKeys = TKeyOf<T, {extract:string}, true>;
  const obj: any = {};
  (Object.getOwnPropertyNames(value) as PrefixedKeys[])
    .forEach((key: PrefixedKeys): void => {
      const newKey = `${prefix}${_String.capitalize(key)}`;
      obj[newKey] = value[key];
    });
  return obj as TConcatStrIntoKeys<T, Prefix>;
}

function getValueFromPath(obj: any, path: string): any {
  if (!path || !obj) return obj;
  return path.split('.').reduce((acc: any, key: string): any => {
    return acc[key];
  }, obj);
}

function setValueFromPath(obj: any, path: string, value: any): void {
  if (!path || !obj) return;
  const keys: string[] = path.split('.');
  keys.reduce((acc: any, key: string, idx: number): any => {
    if (idx == keys.length - 1) {
      acc[key] = value;
    }
    return acc[key];
  }, obj);
}

function removeNullFields<T extends object>(obj: T): Partial<T> {
  return (Object.entries(obj) as TEntriesReturn<T>[])
    .reduce((acc: Partial<T>, [key, value]: TEntriesReturn<T>): Partial<T> => {
      if (!isNull(value)) {
        acc[key as keyof T] = value;
      }
      return acc;
    }, {} as Partial<T>);
}

function thisAsParameter<T extends TFunction>(fn: T): TLambdaToFunction<GlobalDeclaration<T>> {
  return function(this: any, ...args: any[]): any {
    return fn.call(null, this, ...args);
  } as any;
}

function isAClassDeclaration<T>(obj: any): obj is TClazz<T> & T {
  return typeof obj === 'function' && /^class\s/.test(obj.toString());
}

export const _Object = {
  isEmptyObj,
	isAClassDeclaration,
	circularReferenceHandler,
	addPrefixToKeys,
	getValueFromPath,
	setValueFromPath,
	removeNullFields,
  thisAsParameter
};

export type TUtilsObject = typeof _Object;