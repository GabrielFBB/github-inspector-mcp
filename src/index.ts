#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listRepos, listIssues, listCommits, readFile, listTree } from "./github.js";

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

const transport = new StdioServerTransport();
await server.connect(transport);
