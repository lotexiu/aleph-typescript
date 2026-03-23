---
applyTo: "packages/typescript/src/**"
---

# Instruções para `packages/typescript`

## Convenções Obrigatórias

### Nomenclatura de tipos
- **Prefixo `T` obrigatório** em todos os tipos: `TMinhaCoisa`, `TConfig`, `TOptions`
- Interfaces também com `T`: não usar `IMinhaInterface`, usar `TMinhaInterface`
- Tipos nativos re-exportados: prefixo interno `_I` (ex: `_IRequired`), re-exportados sem prefixo

### Estrutura de módulos
Todo módulo nativo segue o padrão de 4 arquivos:

```
src/natives/<tipo>/generic/
  types.ts          → APENAS tipos — sem runtime, gera chunk vazio (comportamento correto)
  implementations.ts → funções puras no objeto `_NomeModulo`
  utils.ts           → classe estática `NomeModuloUtils` espelhando `_NomeModulo`
  declarations.ts    → constantes/declarações runtime
```

### Objetos de implementação
```typescript
// implementations.ts — PADRÃO OBRIGATÓRIO
export const _Meu = { funcaoA, funcaoB };
export type TUtilsMeu = typeof _Meu;

// utils.ts — PADRÃO OBRIGATÓRIO
export class MeuUtils {
  static funcaoA: TUtilsMeu['funcaoA'] = _Meu.funcaoA;
  static funcaoB: TUtilsMeu['funcaoB'] = _Meu.funcaoB;
}
```

### Indentação e formatação
- **Tabs** (não espaços) — sempre
- Aspas simples em strings de runtime, aspas duplas em tipos quando necessário

## Aliases de Path Disponíveis

```typescript
import { ... } from "@ts/types";                         // src/types.ts
import { ... } from "@ts/implementations";               // src/implementations.ts
import { ... } from "@tsn-object/generic/implementations"; // src/natives/object/generic/implementations.ts
import { ... } from "@tsn-function/generic/types";       // src/natives/function/generic/types.ts
import { ... } from "@tsn-class/types";                  // src/natives/class/types.ts
import { ... } from "@tsn-string/generic/implementations"; // src/natives/string/generic/implementations.ts
import { ... } from "@tsn-array/generic/types";          // src/natives/array/generic/types.ts
```

## Proibições

- **NUNCA** adicionar código runtime em `types.ts`
- **NUNCA** editar `src/index.ts` manualmente — gerado por `createIndexFile()`
- **NUNCA** editar os `exports` no `package.json` — gerados por `packageJsonPlugin()`
- **NUNCA** usar espaços para indentação
- **NUNCA** criar classe sem espelhar no objeto `_Nome` correspondente

## Tipos Utilitários Disponíveis

```typescript
// src/types.ts
TNullable<T, NoVoid>     // T | undefined | null | (void se NoVoid=false)
TNever<T>                // null | never
TNotUndefined<T>         // exclui undefined
As<T, U>                 // interseção condicional: T extends U ? T & U : never
TTypeOfValue             // tipo do typeof

// src/natives/object/generic/types.ts
TObject<T>               // exclui Function e Array
TUnionize<T>             // converte objeto em union de single-property objects
TMap<Type, Default, Pairs>  // mapeamento de tipos via lista de pares [K, V]
TKeysOfType<Target, Type>   // chaves cujo valor extends Type
TKeyOf<T, Options>          // variação de keyof com extract/exclude

// src/natives/function/generic/types.ts
TFunction<Types, RType, Inf, InfType>
TModifyReturnType<Func, NewReturnType>
TParameters<T>
TReturnType<T>
TInstanceType<T>
TRebindedFunction<T>

// src/natives/class/types.ts
TConstructor<T>
TClazz<T>
TExtendClass<T, E>

// src/natives/array/generic/types.ts
TArrayType<Types, Inf, InfType>  // suporte a tipos infinitos
TFirst<T>, TLast<T>
TAsArray<T>
TPair<K, V>
```
