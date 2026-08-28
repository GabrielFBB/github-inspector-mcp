# GitHub Inspector MCP

Servidor MCP que da a assistentes de IA acesso de leitura a repositorios do GitHub.

O Model Context Protocol e um padrao aberto que permite a modelos de linguagem usar ferramentas externas. Este servidor expoe cinco ferramentas que qualquer cliente MCP pode chamar.

## Ferramentas

| Ferramenta | Descricao |
|---|---|
| `list_repos` | Lista os repositorios publicos de um utilizador |
| `list_issues` | Lista issues de um repositorio, com filtro por estado |
| `list_commits` | Mostra os commits mais recentes |
| `list_files` | Lista os ficheiros do repositorio, com filtro opcional |
| `read_file` | Le o conteudo de um ficheiro |

## Stack

TypeScript, Node.js, MCP SDK, Zod para validacao de argumentos.

## Instalacao

```bash
git clone https://github.com/GabrielFBB/github-inspector-mcp.git
cd github-inspector-mcp
npm install
npm run build
```

## Configuracao

O servidor funciona sem autenticacao para repositorios publicos, mas o GitHub limita a 60 pedidos por hora. Com um Personal Access Token o limite sobe para 5000.

Cria um token em Settings, Developer settings, Personal access tokens, e define a variavel:

```bash
export GITHUB_TOKEN=o_teu_token
```

## Usar com o Claude Desktop

Adiciona ao ficheiro de configuracao:

```json
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
```

Reinicia o cliente e as ferramentas ficam disponiveis.

## Notas de implementacao

Os erros da API sao traduzidos para mensagens legiveis: 404 indica repositorio inexistente, 403 com limite esgotado sugere configurar o token.

O `list_files` usa a Git Trees API com `recursive=1`, que devolve a arvore inteira num pedido em vez de percorrer diretorios.

O `read_file` recebe o conteudo em base64 e descodifica. Ficheiros acima de 1 MB nao trazem conteudo na resposta da API, e nesse caso o erro e explicito.

## Autor

Gabriel Borges
