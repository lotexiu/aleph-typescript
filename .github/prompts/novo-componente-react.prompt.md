---
description: Cria um novo componente React OOP seguindo o padrão ReactWrapper/ReactUIClient do projeto.
---

Crie um novo componente React para o pacote `packages/react` seguindo o padrão OOP do projeto.

## Informações do componente

- **Nome**: ${input:nome:Nome do componente (PascalCase)}
- **Tipo**: ${input:tipo:client ou server}
- **Props**: ${input:props:Descreva as props (ex: titulo: string, valor: number)}

## Estrutura do arquivo

Crie em `packages/react/src/components/${input:nome}.tsx`:

```typescript
import { ReactWrapper } from './implementations';
import { ReactUIClient } from './ReactUIComponent/ReactUIClient';
// OU: import { ReactUIServer } from './ReactUIComponent/ReactUIServer';
import type { PropsOf } from './ReactUIComponent/types';
import type { Property } from '@lotexiu/typescript/natives/object/proxy/types';
import type { ReactNode } from 'react';

interface ${input:nome}Props {
  // Defina as props aqui
}

const ${input:nome} = ReactWrapper(
  class ${input:nome} extends ReactUIClient<${input:nome}Props>() {
    // Estado interno (não use useState — use propriedades da classe)

    onInitBeforeRender(): void {
      // Inicialização síncrona antes do primeiro render
    }

    onInit(): void {
      // Após primeiro render (equivalente a useEffect com [])
    }

    onDestroy(): void {
      // Cleanup ao desmontar
    }

    setupHooks(): void {
      // Use hooks React AQUI (useEffect, useRef, useForm, etc.)
      // Exemplo: this.ref = useRef(null);
    }

    onChanges(property: Property<this>): void {
      // Chamado quando qualquer this.X muda
    }

    onPropsChange(property: Property<this['props']>): void {
      // Chamado quando this.props.X muda
    }

    render(): ReactNode {
      return (
        <div>
          {/* JSX aqui */}
        </div>
      );
    }
  }
);

export default ${input:nome};
export type ${input:nome}Props = PropsOf<typeof ${input:nome}>;
```

## Regras importantes

- **Não** usar `useState` ou `useReducer` diretamente na classe — coloque em `setupHooks()`
- Usar `this.updateView()` para forçar re-render após mudar propriedades internas
- `this.props` é mutável (cópia das props originais); `this.originalProps` é readonly
- Hooks só são válidos dentro de `setupHooks()` — não em `onInit`, `render`, etc.
- `onChanges` dispara para QUALQUER propriedade da instância, inclusive `props`
- Se o componente for `server`, omitir `setupHooks`, `onInit`, `onDestroy`, `updateView`

## Após criar

Reconstrua o pacote para atualizar o índice:
```bash
cd packages/react && pnpm build
```
