# Copilot Instructions — aleph-typescript

## Estado do Projeto e Política de Atualização

> **Este projeto está em desenvolvimento ativo.** O código aqui não é a versão final — mudanças pequenas e grandes acontecerão continuamente.

### Foco atual

O desenvolvimento está centrado no app **`apps/proton-desk`** (Vite + React). Durante a criação do app, os pacotes `packages/typescript` e `packages/react` receberão atualizações frequentes — novas features, correções e ajustes de API descobertos durante o uso real no app.

**Pacotes com maior probabilidade de mudança:**
- `packages/react` — especialmente `ReactWrapper` e o `ProxyHandler` reativo
- `packages/typescript` — novas utilidades conforme a necessidade do app

### Regra de sincronização de documentação

**Toda vez que um pacote recebe uma mudança** (novo módulo, alteração de API, correção, novo comportamento), é obrigatório:

1. **Atualizar os arquivos `.github/`** correspondentes:
   - `copilot-instructions.md` — se mudar a arquitetura geral ou APIs fundamentais
   - `agents/<pacote>.agent.md` — se mudar APIs ou comportamentos do pacote
   - `instructions/<pacote>-src.instructions.md` — se mudar convenções ou regras de escrita de código
   - `prompts/` — se mudar o processo de criação de novos módulos/componentes

2. **Atualizar o `README.md`** do pacote afetado com o novo comportamento

3. **Manter este arquivo** (`copilot-instructions.md`) como a fonte de verdade do estado atual do projeto

> **Motivo:** como o projeto muda frequentemente, ter a documentação desatualizada causa erros — o modelo trabalhará com uma visão errada da API existente e gerará código incompatível.

---

## Visão Geral do Projeto

Monorepo TypeScript gerenciado com **pnpm workspaces** + **Turborepo**. Escopo npm: `@lotexiu/`.

### Pacotes principais (`packages/`)

| Pacote | Nome npm | Descrição |
|---|---|---|
| `packages/typescript` | `@lotexiu/typescript` | Biblioteca utilitária TypeScript pura (tipos, funções, extensões de nativos, temas, keyboard, proxy) |
| `packages/react` | `@lotexiu/react` | Framework de componentes React OOP (class-based) |
| `packages/vite-utils` | `@lotexiu/vite-utils` | Plugins Vite e utilitários de build (sem compilação própria, source-linked via `exports: ./*: ./src/*.ts`) |
| `packages/typescript-config` | `@lotexiu/typescript-config` | Configs tsconfig compartilhadas |
| `packages/eslint-config` | `@lotexiu/eslint-config` | Configs ESLint compartilhadas |

App: `apps/proton-desk` — app Vite + React (ainda vazia/em desenvolvimento).

---

## Convenções de Código

### Nomenclatura de Tipos

- **Prefixo `T` obrigatório** em todos os tipos: `TFunction`, `TObject`, `TClazz`, `TNullable`, `TKeyOf`, etc.
- Tipos nativos re-exportados com prefixo `_I`: `_IRequired`, `_IReadonly`, `_IPick` → re-exportados como `Required`, `Readonly`, `Pick` do arquivo `types.native.ts`
- Genéricos de tipo-mapeamento: `TMap`, `TMapRec`, `TPair`, `TUnionize`, `TKeysOfType`

### Organização de Arquivos por Módulo

Cada módulo segue o padrão:
```
modulo/
  types.ts          → apenas tipos (type/interface), sem runtime
  implementations.ts → funções puras exportadas como objeto `_NomeUtils`
  utils.ts           → classe estática `NomeUtils` wrapeando o objeto `_NomeUtils`
  declarations.ts    → constantes e declarações runtime (ex: `const Timeout = ...`)
```

- `implementations.ts` exporta objeto: `export const _Object = { isEmptyObj, circularReferenceHandler, ... }`
- `utils.ts` exporta classe estática: `export class ObjectUtils { static isEmptyObj = _Object.isEmptyObj; ... }`
- Arquivos `types.ts` geram **empty chunks** no build (0.00 kB) — comportamento esperado e correto

### Aliases de Path (tsconfig.json de cada pacote)

No `packages/typescript`:
```
@ts/*        → ./src/*
@tsn/*       → ./src/natives/*
@tsn-array/* → ./src/natives/array/*
@tsn-class/* → ./src/natives/class/*
@tsn-function/* → ./src/natives/function/*
@tsn-object/* → ./src/natives/object/*
@tsn-string/* → ./src/natives/string/*
```

### Indentação e Formatação

- **Tabs** para indentação (não espaços)
- Prettier configurado com `--use-tabs`
- Aspas duplas para strings de tipo, aspas simples no JS geral

---

## Sistema de Build

### Fluxo de Build (Turborepo)

```
turbo run build
  ├── @lotexiu/typescript-config   (sem build)
  ├── @lotexiu/eslint-config       (sem build)
  ├── @lotexiu/vite-utils          (sem build — source-linked)
  ├── @lotexiu/typescript          (vite build → dist/)
  ├── @lotexiu/react               (pnpm clean && vite build → dist/)
  └── proton-desk                  (tsc -b && vite build → dist/)
```

Turborepo respeita `dependsOn: ["^build"]` — dependências são buildadas primeiro.

### Configuração Vite (padrão para bibliotecas)

Ambos `packages/typescript` e `packages/react` usam a mesma estratégia:

```typescript
// Dual output: ESM (.js) + CJS (.cjs), módulos preservados
rollupOptions: {
  output: [
    { format: 'es',  preserveModules: true, preserveModulesRoot: 'src', entryFileNames: '[name].js' },
    { format: 'cjs', preserveModules: true, preserveModulesRoot: 'src', entryFileNames: '[name].cjs' }
  ]
}
```

- `minify: false` — obrigatório para hot reload funcionar no React
- `emptyOutDir: false` — limpeza feita pelo `betterOutDirCleanPlugin`
- `vite-plugin-dts` gera `.d.ts` e `.d.ts.map`

### Plugins `@lotexiu/vite-utils`

| Plugin | Função |
|---|---|
| `betterOutDirCleanPlugin()` | Remove arquivos `.js`/`.cjs` órfãos do build anterior (não remove novos) |
| `packageJsonPlugin(['dist', './'])` | Auto-gera as `exports` em `package.json` a partir dos arquivos em `dist/` |
| `createIndexFile(libSrc)` | Gera `src/index.ts` com `export * from` para todos os arquivos `.ts` da `src/` |
| `indexPlugin()` | Gera `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` |
| `copyAllSASSPlugin(srcDir)` | Copia `.scss`/`.sass` para `dist/` sem processar |
| `excludeSASSPProcessPlugin(srcDir)` | Marca SASS como external no Rollup |

### Outputs do Build

Estrutura espelhada de `src/` em `dist/`:
```
dist/
  index.js / index.cjs / index.d.ts / index.d.ts.map
  implementations.js / .cjs / .d.ts / .d.ts.map
  types.js (empty, 0.00 kB) / types.d.ts
  global.js / .cjs / .d.ts
  natives/
    object/generic/implementations.js / .cjs / .d.ts
    object/proxy/ProxyHandler.js / .cjs / .d.ts
    string/generic/implementations.js / .cjs / .d.ts
    class/types.js (empty) / .d.ts
    ...
  theme/
    builders.js / implementations.js / themes.js / utils.js / types.js (empty)
  value-history/implementation.js / types.js (empty)
  html/keyboard-capture/implementation.js / types.js (empty)
```

### Exportações do package.json

O `packageJsonPlugin` auto-gera as `exports` no `package.json` baseado nos arquivos em `dist/`. Não editá-las manualmente — são sobrescritas no build.

---

## Pacote `@lotexiu/typescript`

### Módulos Principais

**`src/implementations.ts`** — funções globais de comparação e nulidade:
- `isNull(value, ...customNullValues)` — verifica nulidade com valores customizados
- `isNullOrUndefined(value)` — retorna `value == null`
- `equals(a, b, ...customNullValues)` — comparação JSON-based com suporte a nulos
- `includes(values, value)` — type-narrowing para literais em arrays

**`src/types.ts`** — tipos utilitários base:
- `TNullable<T, NoVoid>` — `T | undefined | null | void`
- `TNever<T>` — representa `null | never`
- `TNotUndefined<T>` — exclui `undefined`
- `As<T, U>` — interseção condicional type-safe
- `TTypeOfValue` — tipo do `typeof`

**`src/global.ts`** — extensões de protótipos nativos via `_Global.register()`:
- `String.prototype.toKebabCase`, `.capitalize`, `.capitalizeAll`, `.rightPad`, `.leftPad`, `.removeCharacters`, `.noAccent`, `.stringToCharCodeArray`, `.getFirstDifferentIndex`, `.getLastDifferentIndex`
- `Function.prototype.thisAsParameter()` — converte lambda `(this: T, ...args) => R` em método encadeável
- `Function.prototype.rebind(context, ...args)` — currying type-safe com re-bind de contexto

**`src/global/implementation.ts`**:
- `_Global.register(target, extension)` — registra métodos no `prototype` via `Object.defineProperty`

### `natives/object`

**`src/natives/object/generic/implementations.ts`** (`_Object`):
- `isEmptyObj(obj)` — verifica se objeto não tem chaves
- `circularReferenceHandler()` — replacer para `JSON.stringify` sem circular refs
- `addPrefixToKeys(obj, prefix)` — retorna novo objeto com chaves prefixadas e capitalizadas
- `getValueFromPath(obj, path)` — acesse `obj.a.b.c` com string `"a.b.c"`
- `setValueFromPath(obj, path, value)` — define valor em caminho pontilhado
- `removeNullFields(obj)` — remove campos nulos/undefined
- `thisAsParameter(fn)` — converte função com `this` em função normal
- `isAClassDeclaration(obj)` — verifica se é declaração `class`
- `differenceBetweenObjects(objA, objB)` — retorna campos diferentes

**`src/natives/object/proxy/ProxyHandler.ts`**:
- `proxyHandler(target, options: ProxyOptions<T>)` — cria proxy reativo com callbacks `onChanges`, `onSet`, `onGet` por propriedade
- `deleteProxy(proxy)` — remove proxy

**`src/natives/object/proxy/types.ts`**:
- `ProxyOptions<T>` — configuração de proxy com callbacks por propriedade
- `Property<T, Key>` — snapshot de mudança: `{ name, value, previousValue, state }`
- `PropertyState` — `"new" | "updated" | "deleted" | "defined"`

### `natives/class`

- `TConstructor<T>` — `new (...args) => T`
- `TClazz<T>` — construtor + Function + NewableFunction
- `TExtendClass<T, E>` — interseção de construtores
- `instanceOf(obj, constructor)` — narrowing de instância
- `Timeout` — construtor do `NodeJS.Timeout` (para instanceOf)

### `natives/function/generic`

**Tipos**: `TFunction`, `TModifyReturnType`, `TParameters`, `TReturnType`, `TInstanceType`, `TOptionalParameters`, `TLambdaToFunction`, `TRebindedFunction`

**Implementações** (`_Function`):
- `rebind(fn, context, ...initialArgs)` — cria função com contexto/args fixados, encadeável (preserva `.fn` e `.args`)

### `natives/string/generic`

`_String`:
- `toKebabCase`, `capitalize`, `capitalizeAll`, `rightPad`, `leftPad`
- `getFirstDifferentIndex`, `getLastDifferentIndex`
- `removeCharacters`, `noAccent`

### `theme/`

Sistema de temas baseado em **colorjs.io** com espaço de cor **LCH** (perceptualmente uniforme).

**`ThemeUtils`**:
- `themeSchema(mainColorKeys, baseColor, variationsBuilder, foregroundBuilder)` — define schema de tema
- `oppositeColor(color, options: TOppositeColorOptions)` — gera cor oposta/contrastante em LCH
- `applyThemeToDocument(theme)` — aplica tema como CSS custom properties
- `getCurrentTheme()` — retorna tema atual

**`TOppositeColorOptions`**: `{ h?, l?, s? }` com valores `"weak" | "medium" | "full" | "fullRange" | "middleRange" | "maxRange" | "minRange" | number`

**`DefaultThemeBuilder`** — builder pré-configurado com: `background`, `foreground`, `primary`, `accent`, + geração automática de variações (card, popover, secondary, destructive, muted, border, input, ring, charts, sidebar, error, warning, success)

**`DefaultThemes`** — temas prontos: `basic`, `synthwave`, `synthwaveNeon`, `minimalist` (com variantes `dark`/`light`)

### `value-history/`

`ValueHistory<T>` — histórico com undo/redo:
- `add(item)`, `undo()`, `redo()`, `clear()`
- `canUndo`, `canRedo`, `current`, `previous`, `next`
- Callbacks: `onBeforeRedo`, `onBeforeUndo`, `onBeforeRegister`, `onBeforeClear`

### `html/keyboard-capture/`

`KeyboardCapture` — captura global de teclado:
- `KeyboardCapture.add(listener, ...actions)` → retorna `UnListener`
- Combos de teclas: `TKeyboardAction` com `combo: TKeyboardEventCode[] | TKeyboardEventCode[][]`
- Previne teclas travadas em atalhos do browser (escuta `window.blur`)

---

## Pacote `@lotexiu/react`

### Padrão OOP de Componentes

Componentes são escritos como **classes** e convertidos para componentes React via `ReactWrapper`.

```typescript
const MeuComponente = ReactWrapper(
  class MeuComponente extends ReactUIClient() {
    // Props são passadas no construtor
    // this.props é mutável, this.originalProps é readonly

    onInitBeforeRender(): void {}  // antes do primeiro render
    onInit(): void {}              // após primeiro render
    onDestroy(): void {}           // cleanup (useEffect cleanup)
    setupHooks(): void {}          // contexto de hooks React — usar hooks AQUI
    onChanges(property: Property<this>): void {}       // qualquer prop da instância mudou
    onPropsChange(property: Property<this['props']>): void {} // props.X mudou

    abstract render(): ReactNode;
  }
)
```

### Hierarquia de Classes

```
ReactUI(extendsClass?)          → base abstrata, static ReactUIType = 'base'
  └── ReactUIClient(extendsClass?) → client component, static ReactUIType = 'client'
  └── ReactUIServer(extendsClass?) → server component, static ReactUIType = 'server'
```

Todas são **funções factory** que retornam classes abstratas (não são classes diretamente):
```typescript
class MeuComp extends ReactUIClient() { ... }
class MeuComp extends ReactUIClient(MinhaClasseBase) { ... }  // herança customizada
```

### Proxy Reativo em `ReactUI`

O construtor cria um `proxyHandler` na instância com:
- `onChanges` disparado em qualquer mudança em `this.*`
- `onPropsChange` disparado em mudanças em `this.props.*`
- `render` com `.rebind(proxy)` automático
- Objetos aninhados também são proxificados

### `ReactWrapper` — Funcionamento Interno

1. Recebe classe construtora, retorna componente funcional
2. `ReactUIType === 'client'`: usa `useState` para preservar instância, `useReducer` para forçar re-render via `dispatch`, `useEffect` para `onInit`/`onDestroy`, `useMemo` para atualizar props
3. `ReactUIType === 'server'`: cria instância e chama `render()` diretamente (sem hooks)
4. `setupHooks()` é chamado dentro do wrapper funcional → hooks React são válidos aqui
5. `ReactUIClient.updateView()` chama o `dispatch` injetado pelo wrapper

### `PropsOf<T>` — Extração de Props

```typescript
type MyProps = PropsOf<typeof MeuComponente>; // extrai o tipo Props da classe
```

---

## Erros de Build Conhecidos

Erros com importações erradas, como importart um arquivo da "dist" em vez da "src", ou importar `types.ts` em vez de `implementations.ts`. Ficar atento para previnir ou corrigir esses erros.

---

## Scripts e Comandos

```bash
# Na raiz do monorepo
pnpm build          # build todos os pacotes (ordem correta via Turborepo)
pnpm dev            # modo watch (todos os pacotes)
pnpm format         # prettier com tabs em todos os .ts/.tsx/.md
pnpm new            # turbo gen workspace (gera novo pacote via template)
pnpm mismatch       # detecta versões de dependências inconsistentes
pnpm outd           # lista dependências desatualizadas
pnpm upd            # atualiza dependências interativamente
pnpm clean          # remove node_modules e pnpm store

# Em pacote específico
cd packages/typescript && pnpm build   # build do pacote typescript
cd packages/typescript && pnpm dev     # watch mode

# Script de commit multi-repositório
./multi-commit.sh   # commita submódulos primeiro, depois o root
```

---

## Adicionando Novo Módulo Nativo em `packages/typescript`

1. Criar pasta em `src/natives/<tipo>/generic/` (ou `src/natives/<tipo>/`)
2. Criar `types.ts`, `implementations.ts`, `utils.ts` conforme padrão
3. Adicionar alias em `tsconfig.json` em `paths`
4. O `createIndexFile()` adiciona automaticamente ao `src/index.ts` no próximo build
5. O `packageJsonPlugin()` atualiza automaticamente os `exports` do `package.json`

---

## Git e Submódulos

O projeto usa submodules Git. Para sincronizar:
```bash
pnpm git-init   # git submodule update --init --recursive
pnpm git-sync   # sync remoto de submódulos + pull
./multi-commit.sh  # commit interativo (submódulos → root)
```
