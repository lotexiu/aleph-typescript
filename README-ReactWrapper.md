# ReactWrapper, ReactUIClient() e ReactUIServer()

Este documento explica o padrão de wrappers usado neste monorepo para integrar classes com o modelo de componentes React (client-side e server-side). Está escrito em pt-BR e referencia os arquivos de implementação:

- packages/react/src/components/implementations.tsx (ReactWrapper)
- packages/react/src/components/ReactComponent/ReactUIClient().ts (ReactUIClient())
- packages/react/src/components/ReactComponent/ReactUIServer().ts (ReactUIServer())
- packages/react/src/components/ReactComponent/ReactUI().ts (contrato/base)

## Visão geral

O objetivo do `ReactWrapper` é permitir que você escreva componentes como classes (padrão orientado a objeto, similar ao estilo Angular) e os execute no ambiente React. Há duas categorias principais:

- `ReactUIClient()` — classes que podem usar hooks e executar no cliente; o wrapper monta uma função React que injeta os hooks necessários.
- `ReactUIServer()` — classes para renderização no servidor (sem hooks de cliente).

Em ambos os casos a classe extende `ReactUI()`, que provê um contrato com métodos opcionais como `onInit`, `setupHooks`, `onChanges`, `onPropsChange` e o método abstrato `render()`.

## Como funciona o `ReactWrapper` (resumo técnico)

1. `ReactWrapper` recebe a classe (construtor) e retorna um componente de função React (um wrapper funcional) que será usado pelo Next/React.
2. Dentro desse componente funcional o wrapper instancia a classe: `new ComponentClass(props)`.
3. Se a instância for uma `ReactUIClient()` (ou extendê-la), o wrapper cria um estado React local (`useState`) para forçar re-renders do componente de classe. Também usa `useEffect` conforme necessário para executar `onInit`.
4. O wrapper atribui internamente um `dispatch` (função setState) na instância de classe para que `this.updateView()` possa chamar esse dispatch e forçar a re-renderização.
5. O wrapper chama `setupHooks()` na instância — e esse método é executado no contexto de render do wrapper, logo é seguro usar hooks do React dentro dele (como `useForm`, `useEffect`, etc.).
6. O `render()` da instância é chamado e o resultado JSX é retornado pelo wrapper.

Observação: a implementação também usa um `proxy` / `proxyHandler` (em `ReactUI()`) para interceptar alterações nas propriedades da instância e disparar `onChanges` / `onPropsChange` automaticamente.

## ReactUI() — o contrato

Principais membros (implementados/esperados):

- constructor(props) — popula `this.props` (mutável) e `this.originalProps` (readonly, preserva props iniciais) e cria um proxy para a instância (via `proxyHandler`).
- onInitBeforeRender(): void — hook chamado ANTES do primeiro render (útil para inicialização síncrona antes da UI aparecer).
- onInit(): void — hook chamado quando o componente é inicializado (após primeiro render para client, imediatamente após construção para server).
- onDestroy(): void — hook chamado quando o componente é desmontado/destruído (apenas para client components via useEffect cleanup).
- setupHooks(): void — hook executado no contexto do wrapper (onde hooks do React podem ser usados).
- onChanges(property: Property<this>): void — chamado quando uma propriedade da instância muda (interceptado pelo `proxyHandler`).
- onComponentPropsChange(newProps: Partial<Props>): void — chamado quando `props` são alterados externamente pelo componente pai ou via binding. Usado para reagir a mudanças vindas de fora. O proxy de `props` é removido e recriado neste momento.
- onPropsChange(properties: Property<this['props']>): void — chamado quando há alterações internas em `this.props` ocasionadas pelo render do componente (mudanças internas).
- abstract render(): ReactNode | Promise<ReactNode> — deve retornar o JSX do componente. Pode ser async para server components.

Importante: o `proxyHandler` faz a mágica de observar alterações de propriedades e chamar `onChanges`/`onPropsChange`. Isso permite que alterações em campos simples da classe (por exemplo `this.serverMessage = 'ok'`) sejam detectadas e tratadas.

## ReactUIClient()

- Estende `ReactUI()` e adiciona:
  - um método `updateView()` que chama a função `dispatch` atribuída pelo `ReactWrapper`. Ou seja, quando você altera qualquer campo da classe que não seja gerenciado por hooks (ex.: `this.serverMessage`), você deve chamar `this.updateView()` para forçar re-render.
  - propriedade `dispatch`: injetada automaticamente pelo wrapper - não defina manualmente.
  - hook `onComponentPropsChange(newProps)`: específico para client components, chamado quando props externos mudam.

- Onde usar `setupHooks()`:
  - É aqui que você pode chamar hooks do React. Ex.: `this.form = useForm()` ou `useEffect(() => { ... }, [])`.
  - `setupHooks()` é executado dentro do componente funcional criado por `ReactWrapper`, por isso hooks são válidos aqui.

- Comportamento especial:
  - A instância é preservada entre re-renders via `useState`.
  - Se a classe do componente mudar dinamicamente (hot reload ou troca de implementação), a instância é resetada automaticamente.
  - O `onDestroy()` é chamado no cleanup do `useEffect` quando o componente desmonta.

### Extendendo de uma classe customizada

Você pode passar uma classe base para `ReactUIClient()` para herdar funcionalidades adicionais:

```typescript
class MinhaClasseBase {
	protected logger(msg: string) {
		console.log(`[${this.constructor.name}]`, msg);
	}
}

const MeuComponente = ReactWrapper(
	class MeuComponente extends ReactUIClient(MinhaClasseBase) {
		// Agora tem acesso ao método logger()
		onInit() {
			this.logger("Componente inicializado!");
		}

		render() {
			return <div>Olá Mundo</div>;
		}
	}
);
```

Isso permite compartilhar lógica comum entre múltiplos componentes sem repetição de código.

## ReactUIServer()

- Estende `ReactUI()` sem adicionar suporte a hooks de cliente. É pensado para renderização no servidor onde hooks do cliente não devem ser usados.
- Use `ReactUIServer()` quando o componente deve ser renderizado apenas no servidor (sem necessidade de interações com `useState`/`useEffect`/hooks de formulário do cliente).
- Comportamento especial:
  - O método `render()` pode retornar `Promise<ReactNode>` para suportar operações async (ex: fetch de dados no servidor).
  - O wrapper renderiza o resultado como `<Comp></Comp>` envolvido em um fragment para garantir compatibilidade.
  - `onInit()` e `onInitBeforeRender()` são chamados imediatamente após a construção (não há conceito de "mounting" no servidor).
  - `onDestroy()` não é chamado (sem cleanup no servidor).

### Extendendo de uma classe customizada

Assim como `ReactUIClient()`, você pode passar uma classe base para `ReactUIServer()`:

```typescript
class BaseServerComponent {
	protected async fetchData(endpoint: string) {
		const res = await fetch(`https://api.example.com/${endpoint}`);
		return res.json();
	}
}

const MeuServerComponent = ReactWrapper(
	class MeuServerComponent extends ReactUIServer(BaseServerComponent) {
		async render() {
			const data = await this.fetchData("users");
			return <div>{JSON.stringify(data)}</div>;
		}
	}
);
```

## Binding automático e `this` (esclarecimento)

A implementação do `ReactUI()` / `proxyHandler` e do `ReactWrapper` rebinda os métodos da instância para o proxy retornado. Na prática isso significa:

- Você não precisa fazer `this.onSubmit = this.onSubmit.bind(this)` nem usar `.bind(this)` em chamadas como `onSubmit={this.onSubmit}`.
- Ao usar `form.handleSubmit(this.onSubmit)` dentro do `render()`, o `this` dentro de `onSubmit` já estará no contexto correto (rebind automático), então não há necessidade de `bind` manual.
- Isso apenas se aplica dentro do método `render()` ou quando métodos são chamados diretamente pela árvore React ou ações externas.

Exemplo de uso (classe):

```tsx
export const SignIn = ReactWrapper(
	class SignIn extends ReactUIClient() {
		form: any;
		serverMessage: string | null = null;

		setupHooks(): void {
			// useForm é seguro aqui
			this.form = useForm({ defaultValues: { email: "", password: "" } });
		}

		async onSubmit(values: any) {
			// `this` já aponta para a instância proxy — não é preciso bind
			this.serverMessage = "enviando...";
			// ...chamada ao servidor
			this.updateView(); // força re-render para mostrar serverMessage
		}

		render() {
			return (
				<form onSubmit={this.form.handleSubmit(this.onSubmit)}>
					{/* controles */}
				</form>
			);
		}
	},
);
```

Observe que `handleSubmit(this.onSubmit)` funciona sem `bind`.

## onChanges, onComponentPropsChange e onPropsChange

- `onChanges(property)` é chamado automaticamente quando uma propriedade da instância (qualquer campo) muda — graças ao `proxyHandler` usado em `ReactUI()`.
- `onComponentPropsChange(newProps)` é chamado quando há mudanças em `props` vindas externamente (do componente pai ou via binding). Use este método para reagir a alterações externas nos props e sincronizar estado interno se necessário. **Importante:** quando este hook é disparado, o proxy de `this.props` é removido (via `deleteProxy()`) e um novo objeto props é criado.
- `onPropsChange(properties)` é chamado quando há alterações internas em `this.props` ocasionadas durante o render do componente (mudanças internas no objeto props).

**Diferença chave:** `onComponentPropsChange` = mudanças externas (pai atualizou props); `onPropsChange` = mudanças internas (alterações em `this.props` dentro do componente na função `render`).

**Acesso aos props originais:** use `this.originalProps` (readonly) se precisar dos valores iniciais sem mutações.

Dica: se dentro de `onChanges` ou `onComponentPropsChange` você faz mutações que devem refletir na UI, chame `this.updateView()` (ou tenha certeza que as alterações ocorreram dentro de valores que já acionam re-render, por exemplo hooks).

## Contrato simples (2–4 bullets)

- Inputs: `props` passados pelo wrapper (qualquer shape), hooks chamados dentro de `setupHooks()`.
- Outputs: JSX retornado por `render()`; o componente pode chamar `this.updateView()` para disparar re-renders.
- Erro/limite: Não chame hooks diretamente em `constructor()` ou em `render()`; use `setupHooks()` para quaisquer hooks. Para server-only logic use `ReactUIServer()`.

## Edge cases / pontos importantes

- Hooks somente em `setupHooks()` (ou dentro do contexto do wrapper). Evite chamar hooks em métodos arbitrários da classe ou no constructor.
- Quando alterar campos da classe que não são controlados por hooks, chame `this.updateView()` para atualizar a UI (apenas em client components).
- `render()` precisa ser uma função pura para client components (retornar JSX). Efeitos colaterais devem ir para `setupHooks()` / `onInit()`.
- `render()` pode ser async para server components (`async render(): Promise<ReactNode>`).
- `onPropsChange` será chamado pelo proxy quando `props` mudarem; trate reatribuições de `this.props` com cuidado e prefira usar `this.originalProps` se precisar do valor inicial.
- Se a classe do componente mudar (ex: hot reload), o wrapper detecta via `Object.getPrototypeOf()` e reseta a instância automaticamente.
- `onInitBeforeRender()` é executado antes de qualquer render, útil para inicialização que deve acontecer antes da UI aparecer.
- `onDestroy()` só funciona em client components - não há cleanup em server components.

## Boas práticas

- Manter a lógica de UI/estado local do formulário em `useForm` (chamado em `setupHooks`) e usar os controllers; assim você não precisa manipular valores como `this.email` manualmente.
- Use `onChanges` para debug ou sincronizações internas quando campos da classe mudarem.
- Use `this.updateView()` apenas quando necessário (evite chamadas redundantes).
- Ao criar classes base para herança, defina métodos como `protected` ou `private` quando apropriado para evitar poluir a API pública do componente.
- Classes base são úteis para compartilhar: validações, formatações, logging, fetch de dados, ou qualquer lógica que não depende diretamente do React.

## Exemplo completo (esqueleto)

```tsx
export const MyComponent = ReactWrapper(
	class MyComponent extends ReactUIClient() {
		form: any;
		serverMessage: string | null = null;
		lastRender: Date;

		onInitBeforeRender(): void {
			// executado antes do primeiro render - útil para setup síncrono
		}

		onInit(): void {
			// executado após o primeiro render (client) ou após construção (server)
		}

		onDestroy(): void {
			// cleanup quando o componente desmonta (apenas client)
		}

		setupHooks(): void {
			this.form = useForm({ defaultValues: { a: "" } });
		}

		onChanges(property: Property<this, keyof this>): void {
			// reagir a mudanças em campos da classe
		}

		onComponentPropsChange(newProps: Partial<typeof this.props>): void {
			// reagir a mudanças externas nos props (vindas do pai)
			// ex: sincronizar estado interno quando props mudam
			// neste momento o proxy de this.props é removido e recriado
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
			// use this.originalProps para acessar props imutáveis originais
			return (
				<form onSubmit={this.form.handleSubmit(this.onSubmit)}>
					{/* inputs */}
				</form>
			);
		}
	},
);
```

## Exemplo com herança de classe customizada

```tsx
// Classe base com funcionalidades compartilhadas
class FormBaseComponent {
	protected validateEmail(email: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	protected showError(message: string): void {
		toast.error(message);
	}
}

// Componente que herda funcionalidades da classe base
export const SignInForm = ReactWrapper(
	class SignInForm extends ReactUIClient(FormBaseComponent) {
		form: any;

		setupHooks(): void {
			this.form = useForm({ defaultValues: { email: "", password: "" } });
		}

		async onSubmit(values: { email: string; password: string }) {
			// Usa método herdado da classe base
			if (!this.validateEmail(values.email)) {
				this.showError("Email inválido!");
				return;
			}

			// lógica de submit...
		}

		render() {
			return (
				<form onSubmit={this.form.handleSubmit(this.onSubmit)}>
					{/* campos do formulário */}
				</form>
			);
		}
	},
);
```

Note que a cadeia de herança é: `SignInForm` → `ReactUIClient(FormBaseComponent)` → `ReactUI(FormBaseComponent)` → `FormBaseComponent`.

## Referências dentro do repositório

- packages/react/src/components/implementations.tsx — implementação do `ReactWrapper`.
- packages/react/src/components/ReactComponent/ReactUI().ts — cria o proxy e define hooks/lifecycles.
- packages/react/src/components/ReactComponent/ReactUIClient().ts — `updateView()`.
- packages/react/src/components/ReactComponent/ReactUIServer().ts — server-side base.

---

Se quiser, eu posso:

- mover este arquivo para outro local (por exemplo `docs/` na raiz) ou transformá-lo em um README.md automático no pacote `packages/react`.
- adicionar exemplos de código mais detalhados ou testes que mostrem o rebind e o `onChanges` sendo disparados.
- gerar um diagrama simples do fluxo (instanciação -> setupHooks -> render -> updateView).

Quer que eu salve este arquivo também em `docs/REACT_WRAPPER.md` ou mantenha em `packages/react/README-ReactWrapper.md`?
