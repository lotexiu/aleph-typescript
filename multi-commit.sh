#!/bin/bash

# --- Configuração: Detecção Dinâmica e Recursiva de Repositórios ---

echo "🔎 Buscando repositórios Git (incluindo submódulos)..."

# 1. Encontra o diretório do repositório principal (pasta .git)
MAIN_REPO_PATHS=$(find . -type d -name ".git" -exec dirname {} \; 2>/dev/null)

# 2. Encontra o diretório dos submódulos (arquivo .git)
SUBMODULE_PATHS=$(find . -type f -name ".git" -exec dirname {} \; 2>/dev/null)

# Concatena, limpa caminhos (remove './'), remove vazios e ordena/remove duplicatas.
REPOS_FOUND=$(echo -e "$MAIN_REPO_PATHS\n$SUBMODULE_PATHS" | sed 's/^\.\///' | grep -v '^$' | sort -u)

ROOT_REPO="." # O repositório onde o script está é sempre o root (pasta .)
SUB_REPOS=""

# Itera sobre os repositórios encontrados para separar o root dos sub-repositórios
for repo in $REPOS_FOUND; do
    # O repositório root é o '.', o resto são sub-repositórios
    if [ "$repo" != "." ]; then
        SUB_REPOS="$SUB_REPOS $repo"
    fi
done

# Concatena, colocando os sub-repositórios primeiro e o root por último.
# Ordem de processamento: sub-repo1 sub-repo2 ... .
REPOS_TO_COMMIT="$SUB_REPOS $ROOT_REPO"

# Verifica se algum repositório foi encontrado
if [ -z "$REPOS_TO_COMMIT" ]; then
    echo "🚨 Erro: Nenhum repositório Git (.git folder ou file) encontrado."
    exit 1
fi

echo "=== Repositórios Git Encontrados para Commit: ==="
echo "Ordem de processamento: Sub-repositórios primeiro, Root por último."
# 💡 Linha corrigida para quebrar os repositórios em linhas separadas
echo "$REPOS_TO_COMMIT" | tr ' ' '\n'

echo "================================================="

# --- Opções de Mensagem de Commit ---
echo -e "\nComo você gostaria de fornecer a mensagem de commit?"
echo "1) Digitar a mensagem diretamente no terminal (rápido, linha única)."
echo "2) Usar o editor padrão (nano/vim) (melhor para mensagens longas ou template)."
read -p "Digite 1 ou 2: " choice

COMMIT_MESSAGE=""

if [ "$choice" == "1" ]; then
    # Opção 1: Input direto no terminal
    read -p "Digite a sua mensagem de commit: " COMMIT_MESSAGE
    if [ -z "$COMMIT_MESSAGE" ]; then
        echo "🚨 Mensagem de commit não pode ser vazia. Encerrando."
        exit 1
    fi
elif [ "$choice" == "2" ]; then
    # Opção 2: Usar o editor padrão
    TEMP_FILE=$(mktemp)
    
    echo "## Por favor, insira a mensagem de commit acima desta linha." > "$TEMP_FILE"
    echo "## Linhas começando com '#' serão ignoradas." >> "$TEMP_FILE"
    
    # Abre o editor padrão (nano, vim, etc.)
    ${EDITOR:-nano} "$TEMP_FILE"
    
    # Extrai a mensagem, ignorando linhas de comentário (#) e limpando espaços
    COMMIT_MESSAGE=$(grep -v '^\#' "$TEMP_FILE" | tr '\n' ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    rm "$TEMP_FILE"
    
    if [ -z "$COMMIT_MESSAGE" ]; then
        echo "🚨 Mensagem de commit ficou vazia após editar. Encerrando."
        exit 1
    fi
else
    echo "🚨 Opção inválida. Encerrando."
    exit 1
fi # Fim do bloco if/elif/else para a escolha da mensagem.

# --- Execução do Commit ---

echo -e "\n=== Iniciando Commit Unificado ===\n"

for repo_path in $REPOS_TO_COMMIT; do
    
    # Renomeando para exibição
    if [ "$repo_path" == "." ]; then
        repo_name="Root Repository"
    else
        repo_name="$repo_path"
    fi
    
    echo "--- Processando Repositório: **$repo_name** ---"
    
    # Entra no repositório
    cd "$repo_path" || { echo "❌ Erro ao entrar em $repo_path. Pulando..."; continue; }

    # === Lógica Específica para Submódulos (sair do HEAD detached) ===
    if [ "$repo_path" != "." ]; then
        current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
        
        # Se estiver em detached HEAD (mostra o hash ou 'HEAD')
        if [ "$current_branch" = "HEAD" ] || [[ "$current_branch" =~ ^[0-9a-f]{7}$ ]]; then
            echo "⚠️ HEAD detached detectado em $repo_name."
            
            # Tenta a branch 'main'. Se falhar, tenta 'master'.
            if git checkout main 2>/dev/null; then
                echo "   -> Trocado com sucesso para a branch 'main'."
            elif git checkout master 2>/dev/null; then
                echo "   -> Trocado com sucesso para a branch 'master'."
            else
                echo "   -> Criando a branch 'temp-commit' para salvar alterações."
                git checkout -b temp-commit
            fi
        fi
    fi
    # ===============================================================

    # 1. Adiciona todas as alterações. Usamos -A (all)
    git add -A

    # 2. Verifica se houve alguma alteração (evita commits vazios)
    if git diff --cached --quiet; then
      echo "Nenhuma alteração em stage para commitar em $repo_name. Ignorando."
    else
      # 3. Executa o commit
      if git commit -m "$COMMIT_MESSAGE"; then
        echo "✅ Commit realizado com sucesso em $repo_name."
        
        # Opcional: Descomente as linhas abaixo para um push automático
        # echo "Executando git push..."
        # git push
      else
        echo "❌ Erro ao commitar em $repo_name. Verifique o problema."
      fi
    fi
    
    # === Lógica Específica para Submódulos (voltar ao estado detached) ===
    if [ "$repo_path" != "." ]; then
        # Isso garante que o repositório pai commite a NOVA REFERÊNCIA de commit.
        echo "🔄 Revertendo o submódulo para o estado de detached HEAD (novo commit ID)."
        # O 'git checkout .' volta ao estado rastreado pelo superprojeto (o novo commit ID)
        git checkout . 2>/dev/null 
    fi
    # ===================================================================
    
    # 4. Retorna ao diretório onde o script foi iniciado
    cd - > /dev/null
done

echo -e "\n=== Processo de Commit Unificado Concluído ==="