#!/bin/bash

# --- Configuração: Detecção Dinâmica e Recursiva de Repositórios ---

# Encontra todos os diretórios que contêm a subpasta ".git" em qualquer profundidade,
# e extrai o caminho do repositório.
# -type d -name ".git": Encontra apenas diretórios chamados ".git".
# sed 's/\/.git//': Remove a parte "/.git" do caminho.
# sed 's/.\///': Remove o "./" inicial que o find adiciona.
REPOS_FOUND=$(find . -type d -name ".git" | sed 's/\/.git//' | sed 's/.\///' | grep -v '^$')

# Variável para armazenar o repositório raiz
ROOT_REPO=""
# Variável para armazenar os sub-repositórios
SUB_REPOS=""

# Itera sobre os repositórios encontrados para separar o root dos sub-repositórios
for repo in $REPOS_FOUND; do
    if [ "$repo" == "." ]; then
        ROOT_REPO="$repo"
    else
        SUB_REPOS="$SUB_REPOS $repo"
    fi
done

# Concatena os repositórios, colocando os sub-repositórios primeiro e o root por último.
# A ordem será: sub-repo1 sub-repo2 ... .
REPOS_TO_COMMIT="$SUB_REPOS $ROOT_REPO"

# Verifica se algum repositório foi encontrado
# Se o SUB_REPOS estiver vazio E o ROOT_REPO estiver vazio, então nenhum foi encontrado.
if [ -z "$SUB_REPOS" ] && [ -z "$ROOT_REPO" ]; then
    echo "🚨 Erro: Nenhum repositório Git (.git folder) encontrado em subdiretórios."
    exit 1
fi

echo "=== Repositórios Git Encontrados para Commit: ==="
echo "Ordem de processamento: Sub-repositórios primeiro, Root por último."
echo "$REPOS_TO_COMMIT"
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
fi

# --- Execução do Commit ---

echo -e "\n=== Iniciando Commit Unificado ===\n"

for repo_path in $REPOS_TO_COMMIT; do
    
    # Repositório que está no root (o próprio diretório onde o script é executado)
    if [ "$repo_path" == "." ]; then
        repo_name="Root Repository"
    else
        repo_name="$repo_path"
    fi
    
    echo "--- Processando Repositório: **$repo_name** ---"
    
    cd "$repo_path" || { echo "Erro ao entrar em $repo_path. Pulando..."; continue; }

    # 1. Adiciona todas as alterações
    git add .

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
    
    # 4. Retorna ao diretório onde o script foi iniciado
    cd - > /dev/null # 'cd -' volta para o diretório anterior (com > /dev/null para evitar output)
done

echo -e "\n=== Processo de Commit Unificado Concluído ==="