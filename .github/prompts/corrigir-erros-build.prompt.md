---
description: Diagnostica e corrige erros de build/TypeScript no monorepo aleph-typescript.
---

Analise e corrija os erros de build no monorepo **aleph-typescript**.

## Como diagnosticar

### 1. Identifique a origem do erro

**Erro no `[vite:dts]`** → problema apenas nos `.d.ts` gerados. O JS compila normalmente. Pode ser:
- Import incorreto (caminho errado, inexistente)
- Tipos `any` implícitos (`strict: true` é ativo)
- Incompatibilidade de tipos

**Erro fora do `[vite:dts]`** → bundle JS falhou. Mais grave.

### 2. Erros conhecidos comuns de exemplo

| Arquivo | Linha | Erro |
|---|---|---|
| `packages/typescript/src/theme/implementations.ts:14` | `import { TThemeFontBuilder } from "dist"` | Importa do próprio dist — importação de arquivo errado |
| `packages/typescript/src/theme/implementations.ts:274` | `'unknown' not assignable to 'ColorTypes'` | Importação de importação de tipagem errada `import { TThemeFontBuilder } from "dist";` que ocasionou falha na tipagem |

### 3. Padrões de alias de path

Ao ver erros como `Cannot find module '@tsn-objeto/generic/...'`:
```
@ts/*        → packages/typescript/src/*
@tsn/*       → packages/typescript/src/natives/*
@tsn-array/* → packages/typescript/src/natives/array/*
@tsn-class/* → packages/typescript/src/natives/class/*
@tsn-function/* → packages/typescript/src/natives/function/*
@tsn-object/* → packages/typescript/src/natives/object/*
@tsn-string/* → packages/typescript/src/natives/string/*
```

E para importações externas do `@lotexiu/react`:
```
@lotexiu/typescript/natives/class/types  (correto — sem /generic/)
@lotexiu/typescript/implementations
@lotexiu/typescript/natives/object/proxy/ProxyHandler
@lotexiu/typescript/natives/object/proxy/types
```

### 4. Comportamentos normais (não reportar como erro)

- `Generated an empty chunk: "types"` — arquivos `types.ts` geram chunks vazios (0.00 kB) **propositalmente**
- `dist/types.js 0.00 kB` — esperado para todos os arquivos de tipos

## Comandos de build para testar

```bash
# Build de um pacote específico
cd packages/typescript && pnpm build
cd packages/react && pnpm build

# Build completo do monorepo (Não muito recomendado, já que é mais demorado e também irá rodar o build dos /apps, depende do que foi editado)
pnpm build
```

## Após corrigir

Verifique que:
1. O build completa sem erros fora do `[vite:dts]`
2. A estrutura `dist/` é quase um espelho de `src/`
3. Não há remoção de exports existentes que possam quebrar consumidores
