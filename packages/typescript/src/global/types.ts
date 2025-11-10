import { TFunction, TParameters, TReturnType } from "@tsn-function/generic/types";
import { TKeyOf } from "@tsn-object/generic/types";

type KeysTarget<T extends TFunction> = TKeyOf<TReturnType<T>, {exclude: "valueOf"}>;

type TypeExtension<Target extends TFunction> = Partial<{
  [Key in KeysTarget<Target>]: TReturnType<Target>[Key];
}>;

type GlobalDeclaration<T> = 
  T extends TFunction 
    ? TParameters<T> extends [this: infer A, ...infer Rest]
      ? ((this: A, ...args: Rest) => TReturnType<T>)
      : never
    : never;

export {
  TypeExtension,
  GlobalDeclaration
}