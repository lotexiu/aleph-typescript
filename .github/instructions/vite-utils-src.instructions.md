---
applyTo: "packages/vite-utils/src/**"
---

# Instruções para `packages/vite-utils`

## Características Especiais do Pacote

`@lotexiu/vite-utils` é **source-linked** — **não tem build próprio**.
- `package.json exports`: `{ "./*": "./src/*.ts" }` — importa diretamente os `.ts`
- Consumidores importam como: `import { ... } from "@lotexiu/vite-utils/plugins/MinhaPlugin"`
- O script `buildx` existe mas não é usado no fluxo normal do Turborepo

## Estrutura

```
src/
  utils.ts          → funções utilitárias de build (getLibraryEntries, extractTsconfigAliases, etc.)
  plugins/
    BetterOutDirClean.ts   → betterOutDirCleanPlugin()
    CopyAllSASS.ts         → copyAllSASSPlugin()
    ExcludeSASSPProcess.ts → excludeSASSPProcessPlugin()
    IndexPlugin.ts         → indexPlugin() e createIndexFile()
    PackageJsonPlugin.ts   → packageJsonPlugin()
    PreserveKeywords.ts    → preserveKeywordsPlugin()
```

## Plugins — Contratos

### `betterOutDirCleanPlugin()`
- Remove arquivos em `dist/` cujo "nome base" não aparece no bundle gerado
- Rastreia via `generateBundle` hook (conjunto `generatedFiles`)
- Executa em `closeBundle` — após todos os arquivos gerados
- **Não** remove diretórios, apenas arquivos

### `packageJsonPlugin(desiredOutDirs?: string[])`
- Lê todos os arquivos de `dist/` após build
- Agrupa por nome base via `groupFilesByBase()`
- Gera mapa de `exports` com `"types"`, `"import"`, `"require"`, `"default"`
- Salva em cada diretório de `desiredOutDirs` (ex: `['dist', './']`)
- Remove `scripts` e `devDependencies` na versão `dist`
- Remove dependências `workspace:`, `file:`, `link:` na versão publicável

### `createIndexFile(srcDir: string)`
- Função (não plugin) — chamada **antes** do `defineConfig`
- Faz glob de todos `.ts/.tsx/.js` em `srcDir` (exceto `index.ts` e `.d.ts`)
- Gera `src/index.ts` com `export * from './...'` para cada arquivo
- Sobrescreve sempre que o build é executado

### `indexPlugin(desiredOutDirs?)`
- Plugin Vite para gerar `index.js`, `index.cjs`, `index.d.ts` no `dist/`
- Agrega todos os `.d.ts` encontrados em `dist/`
- Executado em `closeBundle`

### `copyAllSASSPlugin(srcDir)`
- Copia todos `.scss`/`.sass` de `srcDir` para `dist/` preservando estrutura
- Executado em `writeBundle`

### `excludeSASSPProcessPlugin(srcDir)`
- Marca arquivos SASS como `external` no Rollup (não processa)
- Em `writeBundle`, copia os arquivos SASS manualmente

### `preserveKeywordsPlugin()`
- Usa a API do TypeScript (`ts.SourceFile`) para extrair keywords dos arquivos `.ts`
- Reaplica `abstract`, `readonly`, `private`, `protected`, `static` nos `.d.ts` gerados

## Funções em `utils.ts`

```typescript
getLibraryEntries(srcDir, list?)   // glob de todos .ts/.tsx em srcDir → entries object
extractTsconfigAliases()           // converte paths do tsconfig em aliases Vite
loadRootPackage()                  // lê package.json da raiz (com spinner ora)
groupFilesByBase(filePaths, outputPath) // agrupa arquivos por nome base → extensões
externalDependencies()             // retorna função para marcar deps como external no Rollup
buildPackageName(author, folder)   // "@author/folder"
```

## Dependências

- `fs-extra` — operações de filesystem (globSync, readJSON, writeJSON, outputFile, etc.)
- `chalk` — colorização de logs
- `ora` — spinners no terminal
- `typescript` (via `ts.*`) — usado apenas em `PreserveKeywords.ts` para parsear AST

## Regras

- Nenhum arquivo aqui é compilado — escrever código compatível com Node.js/Vite
- Usar `fs-extra` em vez de `fs` nativo
- Funções de log via `logger.info/success/error/warn/step` (chalk)
- Tabs para indentação
