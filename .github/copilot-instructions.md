# AI Coding Agent Instructions - aleph-typescript Monorepo

## Arquitetura do Monorepo

Este é um monorepo Turborepo + pnpm focado em utilitários TypeScript avançados e um padrão único de React baseado em classes. Estrutura:

- **`packages/typescript`**: Biblioteca core com extensões de nativos (String, Number, Function, Object) e sistema de Proxy para observabilidade
- **`packages/react`**: Sistema `ReactWrapper` que permite escrever componentes React como classes OOP (similar ao Angular)
- **`packages/vite-utils`**: Plugins Vite customizados para build (`BetterOutDirClean`, `CopyAllSASS`, etc)
- **`packages/*-config`**: Configurações compartilhadas (ESLint, TypeScript)
- **`apps/docker-management`**: Next.js 15 app usando o padrão ReactWrapper

## Padrão ReactWrapper (CRÍTICO)

**Não use React functional components padrão neste projeto.** Em vez disso, use o `ReactWrapper`:

```tsx
export const MyComponent = ReactWrapper(
	class MyComponent extends ReactUIClient() /** Também é possivel realizar `extends ReactWrapper.Client` */ {
		form: any;
		serverMessage: string | null = null;
		lastRender: Date;

		setupHooks(): void {
			this.form = useForm({ defaultValues: { a: "" } });
		}

		onChanges(property: Property<this, keyof this>): void {
			// reagir a mudanças em campos da classe
		}

		onComponentPropsChange(newProps: Partial<typeof this.props>): void {
			// reagir a mudanças externas nos props (vindas do pai)
			// ex: sincronizar estado interno quando props mudam
		}

		onPropsChange(
			properties: Property<this["props"], keyof this["props"]>,
		): void {
			// reagir a mudanças internas em this.props ocasionadas pelo render
		}

		async onSubmit(values: any) {
			this.serverMessage = null;
			// ... await fetch
			this.serverMessage = "ok"; // Não executa onPropsChange pois foi alterado fora do contexto do render.
			this.updateView();
		}

		render() {
			this.lastRender = new Date(); // executa onPropsChange pois foi alterado dentro do render
			return (
				<form onSubmit={this.form.handleSubmit(this.onSubmit)}>
					{/* inputs */}
				</form>
			);
		}
	},
);
```

### Extendendo de uma classe customizada

Você pode passar uma classe base para `ReactUIClient()` ou `ReactUIServer()` para herdar funcionalidades adicionais:

```tsx
class FormBaseComponent {
	protected validateEmail(email: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}
}

export const MyForm = ReactWrapper(
	class MyForm extends ReactUIClient(FormBaseComponent) {
		// Agora tem acesso a validateEmail() e outras funcionalidades da classe base
		async onSubmit(values: any) {
			if (!this.validateEmail(values.email)) {
				// validação falhou
				return;
			}
			// ...
		}
		
		render() { /* ... */ }
	}
);
```

**Cadeia de herança:** `MyForm` → `ReactUIClient(FormBaseComponent)` → `ReactUI(FormBaseComponent)` → `FormBaseComponent`

**Regras obrigatórias:**

1. Hooks somente em `setupHooks()` - nunca no constructor ou render
2. Chame `this.updateView()` após mutar campos da classe (ex: `this.serverMessage = 'ok'`) - apenas em client components
3. `this.onSubmit` não precisa de `.bind(this)` - o rebind é automático via ProxyHandler
4. Use `ReactUIServer()` para componentes server-side (sem hooks de cliente)
5. `onDestroy()` só funciona em client components (não há cleanup no servidor)
6. Use `this.originalProps` se precisar dos props originais imutáveis
7. `render()` pode ser async para server components: `async render(): Promise<ReactNode>`
8. Para compartilhar lógica entre componentes, passe uma classe base: `ReactUIClient(MinhaClasseBase)`

### Lifecycle Hooks do ReactUI()

- **`onInitBeforeRender()`**: Executado ANTES do primeiro render - útil para inicialização síncrona que deve acontecer antes da UI aparecer
- **`onInit()`**: Executado quando o componente é inicializado (após primeiro render para client, imediatamente após construção para server)
- **`onDestroy()`**: Executado quando o componente desmonta (apenas para client components - chamado no cleanup do useEffect)
- **`setupHooks()`**: Onde TODOS os hooks do React devem ser chamados (useForm, useEffect, useState, etc)
- **`onChanges(property)`**: Disparado quando qualquer campo da instância muda (via ProxyHandler)
- **`onComponentPropsChange(newProps)`**: Disparado quando props são alterados externamente (pelo componente pai ou via binding) - use para sincronizar estado interno. O proxy de `this.props` é removido e recriado neste momento.
- **`onPropsChange(properties)`**: Disparado quando há alterações internas em `this.props` ocasionado pelo render
- **`render()`**: Retorna o JSX do componente (método abstrato obrigatório). Pode retornar `Promise<ReactNode>` para server components async.

**Propriedades especiais:**
- `this.props` - Props mutáveis (observados pelo proxy)
- `this.originalProps` - Props readonly originais (não sofrem mutações)

**Diferença importante:** `onComponentPropsChange` = mudanças externas nos props (vindas do pai); `onPropsChange` = mudanças internas em `this.props`.

Veja `README-ReactWrapper.md` para detalhes completos e `apps/docker-management/src/app/login/client/SignIn.tsx` como exemplo de referência.

## Sistema de Extensões Nativas (`packages/typescript`)

Este projeto estende protótipos nativos do JavaScript via `_Global.register`:

```typescript
// Em packages/typescript/src/global.ts
declare global {
	interface Function {
		rebind<T>(this: T, context: any): TRebindedFunction<T>;
	}
}

_Global.register(Function, {
	rebind: function (this: TFunction, context: any) {
		return _Function.rebind(this, context);
	},
});
```

**Quando adicionar extensões:**

- Declare tipos em `global.ts` (seção `declare global`)
- Implemente em `packages/typescript/src/natives/<tipo>/generic/implementations.ts`
- Registre via `_Global.register()` no final do `global.ts`
- Import `'@ts/global'` nos arquivos que usam as extensões

## ProxyHandler e Observabilidade

O `ProxyHandler` (em `packages/typescript/src/natives/object/proxy/ProxyHandler.ts`) intercepta mudanças em objetos:

```typescript
const proxy = proxyHandler(instance, {
	allProxy: false,
	onChanges: (property) => {
		/* reage a mudanças */
	},
	properties: {
		specificProp: {
			onSet: (value) => {
				/* quando specificProp muda */
			},
			onGet: (value) => {
				/* quando acessa specificProp */
			},
		},
	},
});
```

Usado em `ReactUI()` para detectar mutações e disparar lifecycle hooks (`onChanges`, `onPropsChange`).

## Comandos de Build e Dev

```bash
# Desenvolvimento (todos os pacotes)
pnpm dev  # Usa turbo dev (persistent mode)

# Build específico
pnpm turbo build --filter=@lotexiu/react

# Dev de app específico
pnpm turbo dev --filter=docker-management

# Consertar dependências desalinhadas
pnpm run fix-mismatch
```

**Importante:** Builds usam Vite com plugins customizados. Sempre verifique `vite.config.ts` nos pacotes.

## Convenções de Imports

Use path aliases definidos em `tsconfig.json`:

```typescript
// Pacotes internos
import { ReactWrapper } from "@lotexiu/react/components/implementations";
import "@ts/global"; // Carrega extensões nativas
import { Property } from "@lotexiu/typescript/natives/object/proxy/types";

// Apps Next.js
import { Button } from "@/components/ui/button";
```

## Sistema de Exports Granulares

Pacotes usam exports granulares no `package.json`:

```json
"exports": {
  "./theme/implementations": {
    "import": "./dist/theme/implementations.mjs",
    "types": "./dist/theme/implementations.d.ts"
  }
}
```

**Ao adicionar novos módulos:** Atualize `exports` no `package.json` e reconstrua o pacote.

## Padrões de Código

1. **Classes com Proxy:** Quando criar classes observáveis, sempre retorne o proxy do constructor:

   ```typescript
   constructor() {
     const proxy = proxyHandler(this, {...});
     return proxy;
   }
   ```

2. **Rebind Automático:** Métodos passados como callbacks (ex: `onSubmit`) são automaticamente rebinded via ProxyHandler - não use `.bind(this)` manual

3. **TypeScript Avançado:** Este projeto usa tipos complexos (`TConstructor`, `Property<T>`, `TRebindedFunction`) - sempre cheque os tipos em `packages/typescript/src/natives/*/generic/types.ts`

4. **Server vs Client:** Em Next.js, sempre use `"use client"` em arquivos que usam `ReactUIClient()`

## Debugging

- **"Cannot call hooks outside render"**: Mova hooks para `setupHooks()` na classe
- **"updateView não definido"**: Componente não montou ainda; chame `updateView()` apenas após mutações durante o ciclo de vida do componente (e apenas em client components)
- **Mudanças não refletem na UI**: Esqueceu de chamar `this.updateView()` após mutar campos (client components)
- **Props não atualizam**: Verifique se `onComponentPropsChange()` está sendo usado para sincronizar estado interno quando props externos mudam
- **Instância resetando inesperadamente**: O wrapper detecta mudanças na classe (via `Object.getPrototypeOf()`) e reseta automaticamente - normal durante hot reload

## Estrutura de Testes

(Atualmente sem testes configurados - use `console.log` e dev server para debug)

## Git Submodules

```bash
pnpm run git-init  # Inicializa submodules
pnpm run git-sync  # Sincroniza submodules
```

---

**Documentação adicional:**

- `README-ReactWrapper.md` - Guia completo do padrão ReactWrapper
- `packages/react/README.md` - Detalhes do pacote React
- `packages/typescript/README.md` - Utilitários TypeScript
