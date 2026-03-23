---
description: Cria um novo módulo nativo no pacote @lotexiu/typescript seguindo todas as convenções do projeto.
---

Crie um novo módulo nativo no pacote `packages/typescript` seguindo as convenções do projeto.

## O que criar

O módulo deve se chamar: **${input:modulo:Nome do módulo (ex: number, date, regex)}**

## Estrutura de Arquivos

Crie os seguintes arquivos em `src/natives/${input:modulo}/generic/`:

### 1. `types.ts`
Apenas tipos TypeScript puro — sem runtime, sem imports de módulos JS, apenas `type` e `interface`.
- Prefixar todos os tipos com `T`
- Usar tabs para indentação
- Exportar como `export type { ... }`

### 2. `implementations.ts`
Funções puras exportadas num objeto literal com prefixo `_`:
```typescript
import type { TMinhaCoisa } from './types';

function minhaFuncao(...): ... { ... }

export const _NomeDoModulo = { minhaFuncao, ... };
export type TUtilsNomeDoModulo = typeof _NomeDoModulo;
```

### 3. `utils.ts`
Classe estática espelhando o objeto `_Nome`:
```typescript
import { _NomeDoModulo, TUtilsNomeDoModulo } from './implementations';

export class NomeDoModuloUtils {
  static minhaFuncao: TUtilsNomeDoModulo['minhaFuncao'] = _NomeDoModulo.minhaFuncao;
}
```

### 4. `declarations.ts` (somente se precisar de constantes runtime)
Constantes e declarações de valor:
```typescript
export const MinhaConstante = ...;
```

## Após criar os arquivos

1. Adicione o alias em `packages/typescript/tsconfig.json` dentro de `compilerOptions.paths`:
```json
"@tsn-${input:modulo}/*": ["./src/natives/${input:modulo}/*"]
```

2. Reconstrua o pacote para atualizar `src/index.ts` e `package.json` exports automaticamente:
```bash
cd packages/typescript && pnpm build
```

## Regras obrigatórias

- Tabs (não espaços) para indentação
- Prefixo `T` em todos os tipos
- Prefixo `_` nos objetos de implementação
- Arquivos `types.ts` apenas com `type`/`interface` — jamais runtime
- Nunca editar `src/index.ts` ou `exports` do `package.json` manualmente
