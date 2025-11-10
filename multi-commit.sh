#!/bin/bash

# --- Configuração ---
# O comando 'find' localiza todos os diretórios com uma subpasta '.git'
# e usa 'sed' para remover a parte '/.git' do nome.
REPOS_TO_COMMIT=$(find . -maxdepth 2 -type d -name ".git" | sed 's/\/.git//' | sed 's/.\///' | grep -v '^$')

# Verifica se algum repositório foi encontrado
if [ -z "$REPOS_TO_COMMIT" ]; then
    echo "🚨 Erro: Nenhum repositório Git (.git folder) encontrado nos subdiretórios imediatos."
    exit 1
fi

echo "=== Repositórios Git Encontrados para Commit: ==="
echo "$REPOS_TO_COMMIT"
echo "================================================="

# --- Opções de Mensagem de Commit ---
# 1. Pergunta ao usuário como ele deseja commitar
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
    # Cria um arquivo temporário com o template de commit
    TEMP_FILE=$(mktemp)
    
    # Adiciona um template de mensagem
    echo "## Por favor, insira a mensagem de commit acima desta linha." > "$TEMP_FILE"
    echo "## Linhas começando com '#' serão ignoradas." >> "$TEMP_FILE"
    
    # Abre o editor padrão (nano, vim, etc.)
    # Usa o $EDITOR se estiver definido, senão usa 'nano' como fallback
    ${EDITOR:-nano} "$TEMP_FILE"
    
    # Extrai a mensagem, ignorando linhas de comentário (#)
    COMMIT_MESSAGE=$(grep -v '^\#' "$TEMP_FILE" | tr '\n' ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Remove o arquivo temporário
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
    echo "--- Processando Repositório: **$repo_path** ---"
    
    cd "$repo_path" || { echo "Erro ao entrar em $repo_path. Pulando..."; continue; }

    # 1. Adiciona todas as alterações
    git add .

    # 2. Verifica se houve alguma alteração (evita commits vazios)
    if git diff --cached --quiet; then
      echo "Nenhuma alteração em stage para commitar em $repo_path. Ignorando."
    else
      # 3. Executa o commit
      if git commit -m "$COMMIT_MESSAGE"; then
        echo "✅ Commit realizado com sucesso em $repo_path."
        
        # Opcional: Descomente as linhas abaixo para um push automático
        # echo "Executando git push..."
        # git push
      else
        echo "❌ Erro ao commitar em $repo_path. Verifique o problema."
      fi
    fi
    
    # 4. Retorna ao diretório onde o script foi iniciado
    cd ..
done

echo -e "\n=== Processo de Commit Unificado Concluído ==="