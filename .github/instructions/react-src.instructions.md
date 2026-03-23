---
applyTo: "packages/react/src/**"
---

# Instruções para `packages/react`

## Padrão OOP de Componentes

Componentes são **classes** convertidas em React via `ReactWrapper`. Nunca criar componentes funcionais diretamente dentro do pacote. Sempre usar a hierarquia `ReactUI → ReactUIClient | ReactUIServer`.

## Hierarquia de Classes (Factory Functions)

```typescript
ReactUI(extendsClass?)          // base abstrata — ReactUIType = 'base'
  ├── ReactUIClient(extendsClass?) // com hooks — ReactUIType = 'client'
  └── ReactUIServer(extendsClass?) // sem hooks — ReactUIType = 'server'
```

São **factory functions**, não classes diretas:
```typescript
// Correto
class MeuComp extends ReactUIClient() { ... }
class MeuComp extends ReactUIClient(MinhaBase) { ... }  // com base customizada

// Errado
class MeuComp extends ReactUIClient { ... }  // ReactUIClient não é uma classe
```

## Ciclo de Vida (Client)

```
constructor(props)
  → onInitBeforeRender()   ← síncrono, antes do primeiro render
  → render()               ← primeiro render
  → onInit()               ← após montagem (tipo didMount)
  → setupHooks()           ← chamado a cada render do wrapper funcional (hooks válidos aqui)
  → [re-renders via updateView() ou mudança de props]
  → onDestroy()            ← ao desmontar (cleanup)
```

## Regras de Hooks

- Hooks React (`useEffect`, `useState`, `useRef`, `useForm`, etc.) **SOMENTE** em `setupHooks()`
- `setupHooks()` é chamado dentro do componente funcional React — contexto de hooks é válido
- `render()` é síncrono para client; pode ser `async` para server

## Reatividade via Proxy

O construtor de `ReactUI` cria um proxy sobre `this`:
- Qualquer `this.propriedade = valor` dispara `onChanges(property)`
- Qualquer `this.props.x = valor` dispara `onPropsChange(property)`
- `render()` é automaticamente re-bindado ao proxy (contexto correto)

## Forçar Re-render

Para client components: `this.updateView()` chama o `dispatch` interno do `useReducer`.
Só chamar após `onInit()` (após montagem).

## Props

```typescript
this.props        // cópia mutável das props (alterável internamente)
this.originalProps  // readonly — as props originais recebidas
this.children     // extraído automaticamente de props.children
```

## Importações Corretas do `@lotexiu/typescript`

```typescript
// Correto
import { TClazz } from "@lotexiu/typescript/natives/class/types";
import { proxyHandler } from "@lotexiu/typescript/natives/object/proxy/ProxyHandler";
import { Property } from "@lotexiu/typescript/natives/object/proxy/types";
import { isNull } from "@lotexiu/typescript/implementations";

// Errado (sem /generic/ no path de class)
import { TClazz } from "@lotexiu/typescript/natives/class/generic/types";
```

## Extraindo Tipos de Props

```typescript
import type { PropsOf } from './ReactUIComponent/types';

// PropsOf infere o tipo do primeiro argumento do construtor
type MeuComponenteProps = PropsOf<typeof MeuComponente>;
```

## Indentação e Formatação

- **Tabs** (não espaços)
- Prettier com `--use-tabs`

## Proibições

- NUNCA chamar hooks fora de `setupHooks()`
- NUNCA instanciar componentes com `new` diretamente
- NUNCA usar `this.dispatch` diretamente — usar `this.updateView()`
- NUNCA criar componentes funcionais React dentro deste pacote — usar `ReactWrapper`
