import { TFunction } from "@tsn-function/generic/types";
import { TypeExtension } from "./types";

function register<
  Target extends TFunction,
  Declare extends TypeExtension<Target>
>(
  target: Target,
  extension: Declare
) {
  try {
    Object.entries(extension).forEach(([key, value]) => {
      Object.defineProperty(target.prototype, key, {
        value,
        writable: true,
        configurable: true,
      });
    });
  } catch (error) {
    throw new Error(`Error registering global implementation for ${target.name}: ${error}`);
  }
}

export const _Global = {
  register,
}