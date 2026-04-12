---
applyTo: "**/vite.config.ts"
---

# Instruções para `vite.config.ts` (Bibliotecas do monorepo)

## Configuração Padrão de Bibliotecas

Os pacotes `packages/typescript` e `packages/react` usam a mesma estratégia de build.

### Estrutura obrigatória

```typescript
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import path from "path";
import {
  externalDependencies,
  extractTsconfigAliases,
  getLibraryEntries
} from "@lotexiu/vite-utils/utils";
import { betterOutDirCleanPlugin } from "@lotexiu/vite-utils/plugins/BetterOutDirClean";
import { packageJsonPlugin } from "@lotexiu/vite-utils/plugins/PackageJsonPlugin";
import { createIndexFile } from "@lotexiu/vite-utils/plugins/IndexPlugin";

const libSrc = path.resolve(__dirname, "src");
const entries = getLibraryEntries(libSrc);

createIndexFile(libSrc);  // gera src/index.ts automaticamente
entries["index"] = path.resolve(libSrc, "index.ts");

export default defineConfig({
  resolve: { alias: extractTsconfigAliases() },
  plugins: [
    dts({ include: ["src"], outDir: "dist", insertTypesEntry: false }),
    betterOutDirCleanPlugin(),         // limpa órfãos — NÃO usar emptyOutDir: true
    packageJsonPlugin(["dist", "./"], { generateExports: false }),
  ],
  build: {
    minify: false,      // OBRIGATÓRIO — HMR e legibilidade
    emptyOutDir: false, // OBRIGATÓRIO — limpeza feita pelo betterOutDirCleanPlugin
    lib: {
      entry: entries,
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'js' : 'cjs';
        return `${entryName}.${ext}`;
      },
    },
    rollupOptions: {
      external: externalDependencies(), // lê do package.json raiz
      output: [
        {
          format: 'es',
          dir: 'dist',
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          preserveModules: true,
          preserveModulesRoot: 'src',
          exports: 'named'
        },
        {
          format: 'cjs',
          dir: 'dist',
          entryFileNames: '[name].cjs',
          chunkFileNames: 'chunks/[name]-[hash].cjs',
          preserveModules: true,
          preserveModulesRoot: 'src',
          exports: 'named'
        }
      ]
    },
  },
});
```

## Plugins Disponíveis em `@lotexiu/vite-utils/plugins/`

| Plugin | Import | Uso |
|---|---|---|
| `betterOutDirCleanPlugin()` | `./BetterOutDirClean` | Remove `.js`/`.cjs` órfãos do dist |
| `packageJsonPlugin(dirs, options?)` | `./PackageJsonPlugin` | Atualiza package.json sem gerar exports quando `generateExports: false` |
| `createIndexFile(srcDir, options?)` | `./IndexPlugin` | Gera barrel index.ts |
| `indexPlugin(dirs?)` | `./IndexPlugin` | Gera index.js/cjs/d.ts no dist |
| `copyAllSASSPlugin(srcDir)` | `./CopyAllSASS` | Copia SASS para dist |
| `excludeSASSPProcessPlugin(srcDir)` | `./ExcludeSASSPProcess` | Marca SASS como external |

## Regras

- `minify: false` — nunca usar `true` (quebra HMR)
- `emptyOutDir: false` — nunca usar `true` (usa `betterOutDirCleanPlugin`)
- `preserveModules: true` — sempre (espelha estrutura src/ no dist/)
- `packageJsonPlugin(..., { generateExports: false })` — obrigatório para não gerar `exports`
- `src/index.ts` — gerado por `createIndexFile()`, nunca editar à mão
- `external: externalDependencies()` — lê dependências do package.json raiz, não hardcodar
