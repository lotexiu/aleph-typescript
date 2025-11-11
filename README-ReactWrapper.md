# ReactWrapper, ReactClientComponent e ReactServerComponent

Este documento explica o padrão de wrappers usado neste monorepo para integrar classes com o modelo de componentes React (client-side e server-side). Está escrito em pt-BR e referencia os arquivos de implementação:

- packages/react/src/components/implementations.tsx (ReactWrapper)
- packages/react/src/components/ReactComponent/ReactClientComponent.ts (ReactClientComponent)
- packages/react/src/components/ReactComponent/ReactServerComponent.ts (ReactServerComponent)
- packages/react/src/components/ReactComponent/ReactBaseComponent.ts (contrato/base)

## Visão geral

O objetivo do `ReactWrapper` é permitir que você escreva componentes como classes (padrão orientado a objeto, similar ao estilo Angular) e os execute no ambiente React. Há duas categorias principais:

- `ReactClientComponent` — classes que podem usar hooks e executar no cliente; o wrapper monta uma função React que injeta os hooks necessários.
- `ReactServerComponent` — classes para renderização no servidor (sem hooks de cliente).

Em ambos os casos a classe extende `ReactBaseComponent`, que provê um contrato com métodos opcionais como `onInit`, `setupHooks`, `onChanges`, `onPropsChange` e o método abstrato `render()`.

## Como funciona o `ReactWrapper` (resumo técnico)

1. `ReactWrapper` recebe a classe (construtor) e retorna um componente de função React (um wrapper funcional) que será usado pelo Next/React.
2. Dentro desse componente funcional o wrapper instancia a classe: `new ComponentClass(props)`.
3. Se a instância for uma `ReactClientComponent` (ou extendê-la), o wrapper cria um estado React local (`useState`) para forçar re-renders do componente de classe. Também usa `useEffect` conforme necessário para executar `onInit`.
4. O wrapper atribui internamente um `dispatch` (função setState) na instância de classe para que `this.updateView()` possa chamar esse dispatch e forçar a re-renderização.
5. O wrapper chama `setupHooks()` na instância — e esse método é executado no contexto de render do wrapper, logo é seguro usar hooks do React dentro dele (como `useForm`, `useEffect`, etc.).
6. O `render()` da instância é chamado e o resultado JSX é retornado pelo wrapper.

Observação: a implementação também usa um `proxy` / `proxyHandler` (em `ReactBaseComponent`) para interceptar alterações nas propriedades da instância e disparar `onChanges` / `onPropsChange` automaticamente.

## ReactBaseComponent — o contrato

Principais membros (implementados/esperados):

- constructor(props) — popula `this.props` e cria um proxy para a instância (via `proxyHandler`).
- onInit(): void — hook chamado quando o componente é inicializado.
- setupHooks(): void — hook executado no contexto do wrapper (onde hooks do React podem ser usados).
- onChanges(property: Property<this>): void — chamado quando uma propriedade da instância muda (interceptado pelo `proxyHandler`).
- onPropsChange(properties: Property<this['props']>): void — chamado quando `props` mudam.
- abstract render(): ReactNode — deve retornar o JSX do componente.

Importante: o `proxyHandler` faz a mágica de observar alterações de propriedades e chamar `onChanges`/`onPropsChange`. Isso permite que alterações em campos simples da classe (por exemplo `this.serverMessage = 'ok'`) sejam detectadas e tratadas.

## ReactClientComponent

- Estende `ReactBaseComponent` e adiciona:
  - um método `updateView()` que chama a função `dispatch` atribuída pelo `ReactWrapper`. Ou seja, quando você altera qualquer campo da classe que não seja gerenciado por hooks (ex.: `this.serverMessage`), você deve chamar `this.updateView()` para forçar re-render.

- Onde usar `setupHooks()`:
  - É aqui que você pode chamar hooks do React. Ex.: `this.form = useForm()` ou `useEffect(() => { ... }, [])`.
  - `setupHooks()` é executado dentro do componente funcional criado por `ReactWrapper`, por isso hooks são válidos aqui.

## ReactServerComponent

- Estende `ReactBaseComponent` sem adicionar suporte a hooks de cliente. É pensado para renderização no servidor onde hooks do cliente não devem ser usados.
- Use `ReactServerComponent` quando o componente deve ser renderizado apenas no servidor (sem necessidade de interações com `useState`/`useEffect`/hooks de formulário do cliente).

## Binding automático e `this` (esclarecimento)

A implementação do `ReactBaseComponent` / `proxyHandler` e do `ReactWrapper` rebinda os métodos da instância para o proxy retornado. Na prática isso significa:

- Você não precisa fazer `this.onSubmit = this.onSubmit.bind(this)` nem usar `.bind(this)` em chamadas como `onSubmit={this.onSubmit}`.
- Ao usar `form.handleSubmit(this.onSubmit)` dentro do `render()`, o `this` dentro de `onSubmit` já estará no contexto correto (rebind automático), então não há necessidade de `bind` manual.
- Isso apenas se aplica dentro do método `render()` ou quando métodos são chamados diretamente pela árvore React ou ações externas.

Exemplo de uso (classe):

```tsx
export const SignIn = ReactWrapper(
  class SignIn extends ReactClientComponent {
    form: any;
    serverMessage: string | null = null;

    setupHooks(): void {
      // useForm é seguro aqui
      this.form = useForm({ defaultValues: { email: '', password: '' } });
    }

    async onSubmit(values: any) {
      // `this` já aponta para a instância proxy — não é preciso bind
      this.serverMessage = 'enviando...';
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
  }
);
```

Observe que `handleSubmit(this.onSubmit)` funciona sem `bind`.

## onChanges e onPropsChange

- `onChanges(property)` é chamado automaticamente quando uma propriedade da instância (qualquer campo) muda — graças ao `proxyHandler` usado em `ReactBaseComponent`.
- `onPropsChange(properties)` é chamado quando há mudanças em `this.props` (normalmente vindas do wrapper se a árvore React pai fornecer novos props).

Dica: se dentro de `onChanges` você faz mutações que devem refletir na UI, chame `this.updateView()` (ou tenha certeza que as alterações ocorreram dentro de valores que já acionam re-render, por exemplo hooks).

## Contrato simples (2–4 bullets)

- Inputs: `props` passados pelo wrapper (qualquer shape), hooks chamados dentro de `setupHooks()`.
- Outputs: JSX retornado por `render()`; o componente pode chamar `this.updateView()` para disparar re-renders.
- Erro/limite: Não chame hooks diretamente em `constructor()` ou em `render()`; use `setupHooks()` para quaisquer hooks. Para server-only logic use `ReactServerComponent`.

## Edge cases / pontos importantes

- Hooks somente em `setupHooks()` (ou dentro do contexto do wrapper). Evite chamar hooks em métodos arbitrários da classe ou no constructor.
- Quando alterar campos da classe que não são controlados por hooks, chame `this.updateView()` para atualizar a UI.
- `render()` precisa ser uma função pura (retornar JSX). Efeitos colaterais devem ir para `setupHooks()` / `onInit()`.
- `onPropsChange` será chamado pelo proxy quando `props` mudarem; trate reatribuições de `this.props` com cuidado e prefira usar `this.originalProps` se precisar do valor inicial.

## Boas práticas

- Manter a lógica de UI/estado local do formulário em `useForm` (chamado em `setupHooks`) e usar os controllers; assim você não precisa manipular valores como `this.email` manualmente.
- Use `onChanges` para debug ou sincronizações internas quando campos da classe mudarem.
- Use `this.updateView()` apenas quando necessário (evite chamadas redundantes).

## Exemplo completo (esqueleto)

```tsx
export const MyComponent = ReactWrapper(
  class MyComponent extends ReactClientComponent {
    form: any;
    serverMessage: string | null = null;

    setupHooks(): void {
      this.form = useForm({ defaultValues: { a: '' } });
    }

    onChanges(property: Property<this, keyof this>): void {
      // reagir a mudanças em campos da classe
    }

    onPropsChange(properties: Property<this["props"], keyof this["props"]>): void {
      // reagir a mudanças em props
    }

    async onSubmit(values: any) {
      this.serverMessage = null;
      // ... await fetch
      this.serverMessage = 'ok';
      this.updateView();
    }

    render() {
      return (
        <form onSubmit={this.form.handleSubmit(this.onSubmit)}>
          {/* inputs */}
        </form>
      );
    }
  }
);
```

## Referências dentro do repositório

- packages/react/src/components/implementations.tsx — implementação do `ReactWrapper`.
- packages/react/src/components/ReactComponent/ReactBaseComponent.ts — cria o proxy e define hooks/lifecycles.
- packages/react/src/components/ReactComponent/ReactClientComponent.ts — `updateView()`.
- packages/react/src/components/ReactComponent/ReactServerComponent.ts — server-side base.

---

Se quiser, eu posso:
- mover este arquivo para outro local (por exemplo `docs/` na raiz) ou transformá-lo em um README.md automático no pacote `packages/react`.
- adicionar exemplos de código mais detalhados ou testes que mostrem o rebind e o `onChanges` sendo disparados.
- gerar um diagrama simples do fluxo (instanciação -> setupHooks -> render -> updateView).

Quer que eu salve este arquivo também em `docs/REACT_WRAPPER.md` ou mantenha em `packages/react/README-ReactWrapper.md`? 