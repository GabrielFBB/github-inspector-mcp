#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  listRepos,
  listIssues,
  listCommits,
  readFile,
  listTree,
  createIssue,
  commentOnIssue,
  getRepo,
  getLanguages,
} from "./github.js";

const server = new McpServer({
  name: "github-inspector",
  version: "1.0.0",
});

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function fail(err: unknown) {
  const msg = err instanceof Error ? err.message : "Erro desconhecido.";
  return { content: [{ type: "text" as const, text: msg }], isError: true };
}

server.tool(
  "list_repos",
  "Lista os repositorios publicos de um utilizador do GitHub, do mais recente para o mais antigo.",
  {
    user: z.string().describe("Nome de utilizador do GitHub"),
    limit: z.number().min(1).max(50).default(10).describe("Quantos repositorios devolver"),
  },
  async ({ user, limit }) => {
    try {
      const repos = await listRepos(user, limit);
      if (repos.length === 0) return text(`${user} nao tem repositorios publicos.`);

      const lines = repos.map((r) => {
        const lang = r.language ? ` [${r.language}]` : "";
        const stars = r.stargazers_count > 0 ? ` ${r.stargazers_count} estrelas` : "";
        const desc = r.description ? `\n  ${r.description}` : "";
        return `${r.name}${lang}${stars}${desc}\n  ${r.html_url}`;
      });

      return text(`${repos.length} repositorios de ${user}:\n\n${lines.join("\n\n")}`);
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "list_issues",
  "Lista as issues de um repositorio. Pull requests sao excluidos.",
  {
    owner: z.string().describe("Dono do repositorio"),
    repo: z.string().describe("Nome do repositorio"),
    state: z.enum(["open", "closed", "all"]).default("open").describe("Estado das issues"),
    limit: z.number().min(1).max(50).default(10),
  },
  async ({ owner, repo, state, limit }) => {
    try {
      const all = await listIssues(owner, repo, state, limit);
      const issues = all.filter((i) => !i.pull_request);
      if (issues.length === 0) return text(`Sem issues ${state === "open" ? "abertas" : ""} em ${owner}/${repo}.`);

      const lines = issues.map(
        (i) => `#${i.number} ${i.title}\n  ${i.state} - aberta por ${i.user.login}\n  ${i.html_url}`
      );

      return text(`${issues.length} issues em ${owner}/${repo}:\n\n${lines.join("\n\n")}`);
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "list_commits",
  "Mostra os commits mais recentes de um repositorio.",
  {
    owner: z.string(),
    repo: z.string(),
    limit: z.number().min(1).max(50).default(10),
  },
  async ({ owner, repo, limit }) => {
    try {
      const commits = await listCommits(owner, repo, limit);
      if (commits.length === 0) return text(`Sem commits em ${owner}/${repo}.`);

      const lines = commits.map((c) => {
        const title = c.commit.message.split("\n")[0];
        const date = c.commit.author.date.split("T")[0];
        return `${c.sha.slice(0, 7)} ${title}\n  ${c.commit.author.name} em ${date}`;
      });

      return text(`Ultimos commits de ${owner}/${repo}:\n\n${lines.join("\n\n")}`);
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "read_file",
  "Le o conteudo de um ficheiro de um repositorio.",
  {
    owner: z.string(),
    repo: z.string(),
    path: z.string().describe("Caminho do ficheiro, por exemplo src/index.ts"),
  },
  async ({ owner, repo, path }) => {
    try {
      const content = await readFile(owner, repo, path);
      return text(`${owner}/${repo}/${path}\n\n${content}`);
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "list_files",
  "Lista todos os ficheiros de um repositorio, para saber o que existe antes de ler.",
  {
    owner: z.string(),
    repo: z.string(),
    filter: z.string().optional().describe("Filtra por texto no caminho, por exemplo .ts ou src/"),
  },
  async ({ owner, repo, filter }) => {
    try {
      let files = await listTree(owner, repo);
      if (filter) files = files.filter((f) => f.path.includes(filter));
      if (files.length === 0) return text("Nenhum ficheiro corresponde ao filtro.");

      const shown = files.slice(0, 200).map((f) => f.path);
      const extra = files.length > 200 ? `\n\n... e mais ${files.length - 200} ficheiros.` : "";

      return text(`${files.length} ficheiros em ${owner}/${repo}:\n\n${shown.join("\n")}${extra}`);
    } catch (err) {
      return fail(err);
    }
  }
);


server.tool(
  "create_issue",
  "Cria uma nova issue num repositorio. Precisa de GITHUB_TOKEN com permissao de escrita. Confirma com o utilizador antes de usar.",
  {
    owner: z.string().describe("Dono do repositorio"),
    repo: z.string().describe("Nome do repositorio"),
    title: z.string().min(1).max(256).describe("Titulo da issue"),
    body: z.string().max(65536).optional().describe("Corpo da issue em markdown"),
    labels: z.array(z.string()).max(10).optional().describe("Etiquetas a aplicar"),
  },
  async ({ owner, repo, title, body, labels }) => {
    try {
      const issue = await createIssue(owner, repo, title, body, labels);
      return text(
        `Issue criada em ${owner}/${repo}:\n\n#${issue.number} ${issue.title}\n${issue.html_url}`
      );
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "comment_on_issue",
  "Adiciona um comentario a uma issue existente. Precisa de GITHUB_TOKEN com permissao de escrita.",
  {
    owner: z.string(),
    repo: z.string(),
    issue_number: z.number().int().positive().describe("Numero da issue"),
    body: z.string().min(1).max(65536).describe("Texto do comentario em markdown"),
  },
  async ({ owner, repo, issue_number, body }) => {
    try {
      const comment = await commentOnIssue(owner, repo, issue_number, body);
      return text(`Comentario adicionado a #${issue_number}:\n${comment.html_url}`);
    } catch (err) {
      return fail(err);
    }
  }
);

server.tool(
  "analyze_repo",
  "Faz um retrato completo de um repositorio: metadados, linguagens, atividade recente e issues abertas. Combina varias chamadas a API numa so resposta.",
  {
    owner: z.string(),
    repo: z.string(),
  },
  async ({ owner, repo }) => {
    try {
      // as quatro chamadas correm em paralelo em vez de em sequencia
      const [info, languages, commits, issues] = await Promise.all([
        getRepo(owner, repo),
        getLanguages(owner, repo).catch(() => ({})),
        listCommits(owner, repo, 30).catch(() => []),
        listIssues(owner, repo, "open", 10).catch(() => []),
      ]);

      const lines: string[] = [];

      lines.push(`${info.full_name}`);
      if (info.description) lines.push(info.description);
      lines.push("");

      const plural = (n: number, singular: string, plural: string) =>
        `${n} ${n === 1 ? singular : plural}`;

      lines.push(
        [
          plural(info.stargazers_count, "estrela", "estrelas"),
          plural(info.forks_count, "fork", "forks"),
          plural(info.open_issues_count, "issue aberta", "issues abertas"),
        ].join(", ")
      );
      lines.push(`Criado em ${info.created_at.slice(0, 10)}, atualizado em ${info.updated_at.slice(0, 10)}`);
      if (info.license) lines.push(`Licenca: ${info.license.name}`);
      if (info.topics && info.topics.length > 0) {
        lines.push(`Topicos: ${info.topics.join(", ")}`);
      }
      lines.push("");

      // linguagens vem em bytes; convertemos para percentagem
      const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);
      if (totalBytes > 0) {
        const breakdown = Object.entries(languages)
          .sort((a, b) => b[1] - a[1])
          .map(([lang, bytes]) => ({
            lang,
            pct: Math.round((bytes / totalBytes) * 100),
          }))
          .filter((l) => l.pct >= 1)
          .slice(0, 6)
          .map((l) => `${l.lang} ${l.pct}%`)
          .join(", ");
        lines.push(`Linguagens: ${breakdown}`);
        lines.push("");
      }

      if (commits.length > 0) {
        const dates = commits.map((c) => c.commit.author.date.slice(0, 10));
        const newest = dates[0];
        const oldest = dates[dates.length - 1];
        lines.push(
          `Atividade: ${commits.length} commits entre ${oldest} e ${newest}`
        );

        const authors = new Map<string, number>();
        for (const c of commits) {
          const name = c.commit.author.name;
          authors.set(name, (authors.get(name) ?? 0) + 1);
        }
        const topAuthors = [...authors.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, count]) => `${name} (${count})`)
          .join(", ");
        lines.push(`Contribuidores recentes: ${topAuthors}`);
        lines.push("");
      } else {
        lines.push("Sem commits recentes acessiveis.");
        lines.push("");
      }

      const realIssues = issues.filter((i) => !i.pull_request);
      if (realIssues.length > 0) {
        lines.push("Issues abertas:");
        for (const i of realIssues.slice(0, 5)) {
          lines.push(`  #${i.number} ${i.title}`);
        }
        lines.push("");
      }

      lines.push(info.html_url);

      return text(lines.join("\n"));
    } catch (err) {
      return fail(err);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
