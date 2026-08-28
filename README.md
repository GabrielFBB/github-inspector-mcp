# GitHub Inspector MCP

Servidor MCP que dá a assistentes de IA acesso de leitura a repositórios do GitHub.

O Model Context Protocol e um padrao aberto que permite a modelos de linguagem usarem ferramentas externas. Este servidor expõe cinco ferramentas que qualquer cliente MCP pode chamar.

## Ferramentas

| Ferramenta | Descrição |
|---|---|
| `list_repos` | Lista os repositórios públicos de um utilizador |
| `list_issues` | Lista issues de um repositório, com filtro por estado |
| `list_commits` | Mostra os commits mais recentes |
| `list_files` | Lista os ficheiros do repositório, com filtro opcional |
| `read_file` | Lê o conteúdo de um ficheiro |

## Exemplo

O servidor comunica por JSON-RPC sobre stdio. Depois do handshake, uma chamada a `list_repos`:

```bash
printf '%s\n%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"teste","version":"1"}}}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_repos","arguments":{"user":"GabrielFBB","limit":3}}}' \
 | node build/index.js
```

Devolve:

```
3 repositorios de GabrielFBB:

github-inspector-mcp [TypeScript]
  Servidor MCP que da acesso de leitura a repositórios do GitHub
  https://github.com/GabrielFBB/github-inspector-mcp

sisyphus-tracker [TypeScript]
  App fullstack de desenvolvimento pessoal
  https://github.com/GabrielFBB/sisyphus-tracker
```


Na prática um cliente MCP faz isto automaticamente. O exemplo acima serve para testar sem cliente nenhum.

## Stack

TypeScript, Node.js, MCP SDK, Zod para validação de argumentos.

## Instalação

```bash
git clone https://github.com/GabrielFBB/github-inspector-mcp.git
cd github-inspector-mcp
npm install
npm run build
```

## Configuração

O servidor funciona sem autenticação para repositorios publicos, mas o GitHub limita a 60 pedidos por hora. Com um Personal Access Token o limite sobe para 5000.

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

Reinicia o cliente e as ferramentas ficam disponíveis.

## Notas de implementação

Os erros da API são traduzidos para mensagens legíveis: 404 indica repositório inexistente, 403 com limite esgotado sugere configurar o token.

O `list_files` usa a Git Trees API com `recursive=1`, que devolve a árvore inteira num pedido em vez de percorrer diretórios.

O `read_file` recebe o conteúdo em base64 e descodifica. Ficheiros acima de 1 MB não trazem conteúdo na resposta da API, e nesse caso o erro é explícito.

## Autor

Gabriel Borges
