import { TFunction, TRebindedFunction } from "./types";

function rebind<T extends TFunction>(fn: T, context: any): TRebindedFunction<T> {
	const originalFn: TFunction = fn.fn || fn;
	const previousArgs: any[] = fn.args || [];
	const newFn = function(this: any, ...args: any[]) {
		return originalFn.apply(context, [...previousArgs, ...args]);
	};
	newFn.fn = originalFn;
	return newFn as any;
}

export const _Function = {
	rebind
}

export type TUtilsFunction = typeof _Function;