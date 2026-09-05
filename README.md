# GitHub Inspector MCP

Servidor MCP que dá a assistentes de IA acesso a repositórios do GitHub — leitura, escrita e análise.

O Model Context Protocol é um padrão aberto que permite a modelos de linguagem usarem ferramentas externas. Escreves o servidor uma vez e qualquer cliente MCP consegue usá-lo, em vez de uma integração por cada assistente.

## Ferramentas

### Leitura

| Ferramenta | Descrição |
|---|---|
| `list_repos` | Lista os repositórios públicos de um utilizador |
| `list_issues` | Lista issues de um repositório, com filtro por estado |
| `list_commits` | Mostra os commits mais recentes |
| `list_files` | Lista os ficheiros do repositório, com filtro opcional |
| `read_file` | Lê o conteúdo de um ficheiro |

### Escrita

Precisam de `GITHUB_TOKEN` com permissão de escrita no repositório.

| Ferramenta | Descrição |
|---|---|
| `create_issue` | Cria uma issue com título, corpo e etiquetas |
| `comment_on_issue` | Adiciona um comentário a uma issue existente |

### Análise

| Ferramenta | Descrição |
|---|---|
| `analyze_repo` | Retrato completo do repositório numa só resposta |

O `analyze_repo` é diferente das outras: não mapeia um endpoint da API. Faz quatro chamadas em paralelo — metadados, linguagens, commits e issues — e compõe um resumo com distribuição de linguagens em percentagem, janela de atividade e contribuidores recentes.

## Exemplo

O servidor comunica por JSON-RPC sobre stdio. Depois do handshake, uma chamada a `analyze_repo`:

    printf '%s\n%s\n' \
     '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"teste","version":"1"}}}' \
     '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"analyze_repo","arguments":{"owner":"GabrielFBB","repo":"sisyphus-tracker"}}}' \
     | node build/index.js

Devolve:

    GabrielFBB/sisyphus-tracker
    App fullstack de desenvolvimento pessoal — hábitos, treinos e biblioteca de leituras.

    1 estrela, 0 forks, 0 issues abertas
    Criado em 2026-08-13, atualizado em 2026-08-29
    Topicos: django, docker, jwt, nextjs, postgresql, react, typescript

    Linguagens: TypeScript 75%, Python 24%

    Atividade: 30 commits entre 2026-08-26 e 2026-08-29
    Contribuidores recentes: GabrielFBB (30)

Na prática um cliente MCP faz isto automaticamente. O exemplo acima serve para testar sem cliente nenhum.

## Stack

TypeScript, Node.js, MCP SDK, Zod para validação de argumentos.

## Instalação

    git clone https://github.com/GabrielFBB/github-inspector-mcp.git
    cd github-inspector-mcp
    npm install
    npm run build

## Configuração

As ferramentas de leitura funcionam sem autenticação para repositórios públicos, mas o GitHub limita a 60 pedidos por hora. Com um Personal Access Token o limite sobe para 5000, e ganhas acesso a repositórios privados.

As ferramentas de escrita exigem token com permissão no repositório em causa.

Cria um token em Settings, Developer settings, Personal access tokens, e define a variável:

    export GITHUB_TOKEN=o_teu_token

## Usar com o Claude Desktop

Adiciona ao ficheiro de configuração:

    {
      "mcpServers": {
        "github-inspector": {
          "command": "node",
          "args": ["/caminho/absoluto/para/github-inspector-mcp/build/index.js"],
          "env": {
            "GITHUB_TOKEN": "o_teu_token"
          }
        }
      }
    }

Reinicia o cliente e as ferramentas ficam disponíveis.

## Notas de implementação

**Separação de camadas.** O `src/github.ts` trata da API do GitHub e não sabe nada de MCP. O `src/index.ts` trata do protocolo e não sabe nada de HTTP. Trocar um não obriga a mexer no outro.

**Schemas gerados pelo Zod.** Os argumentos de cada ferramenta são declarados com Zod, que gera automaticamente o JSON Schema que o cliente recebe — tipos, mínimos, máximos e valores por defeito — e valida em tempo de execução antes de o código correr.

**Erros traduzidos.** Um 404 sugere verificar o nome do repositório; um 403 com limite esgotado sugere configurar o token; um 403 numa operação de escrita sugere que faltam permissões. As mensagens dizem o que fazer, não só o que falhou.

**Git Trees API.** O `list_files` usa `recursive=1`, que devolve a árvore inteira num pedido em vez de percorrer diretório a diretório.

**Chamadas em paralelo.** O `analyze_repo` usa `Promise.all` para as quatro chamadas, com fallback individual: se as linguagens falharem, o resto do relatório sai na mesma.

**Ficheiros grandes.** A API não devolve conteúdo acima de 1 MB. Nesse caso o `read_file` explica porquê em vez de devolver vazio.

## Autor

Gabriel Borges — [github.com/GabrielFBB](https://github.com/GabrielFBB)
