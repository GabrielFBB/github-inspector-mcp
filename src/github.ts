const BASE = "https://api.github.com";

export interface Repo {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  html_url: string;
  updated_at: string;
  private: boolean;
}

export interface Issue {
  number: number;
  title: string;
  state: string;
  user: { login: string };
  created_at: string;
  html_url: string;
  pull_request?: object;
}

export interface Commit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  html_url: string;
}

export interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-inspector-mcp",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });

  if (res.status === 404) {
    throw new Error("Não encontrado. Verifica o nome do utilizador ou do repositório.");
  }
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new Error(
        "Limite de pedidos do GitHub atingido. Define a variável GITHUB_TOKEN para aumentar o limite."
      );
    }
    throw new Error("Acesso negado pelo GitHub.");
  }
  if (!res.ok) {
    throw new Error(`Erro do GitHub (${res.status}).`);
  }

  return (await res.json()) as T;
}

export function listRepos(user: string, limit: number): Promise<Repo[]> {
  return get<Repo[]>(`/users/${user}/repos?per_page=${limit}&sort=updated`);
}

export function listIssues(owner: string, repo: string, state: string, limit: number): Promise<Issue[]> {
  return get<Issue[]>(`/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}`);
}

export function listCommits(owner: string, repo: string, limit: number): Promise<Commit[]> {
  return get<Commit[]>(`/repos/${owner}/${repo}/commits?per_page=${limit}`);
}

export async function readFile(owner: string, repo: string, path: string): Promise<string> {
  const data = await get<{ content?: string; encoding?: string; size: number; type: string }>(
    `/repos/${owner}/${repo}/contents/${path}`
  );

  if (data.type !== "file") {
    throw new Error(`"${path}" não é um ficheiro.`);
  }
  if (!data.content) {
    throw new Error(`Ficheiro demasiado grande para ler (${data.size} bytes).`);
  }

  return Buffer.from(data.content, "base64").toString("utf-8");
}

export async function listTree(owner: string, repo: string): Promise<TreeEntry[]> {
  const repoInfo = await get<{ default_branch: string }>(`/repos/${owner}/${repo}`);
  const tree = await get<{ tree: TreeEntry[]; truncated: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${repoInfo.default_branch}?recursive=1`
  );
  return tree.tree.filter((e) => e.type === "blob");
}

// ---------- escrita ----------

function requireToken(): void {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      "Esta operacao precisa de autenticacao. Define a variavel GITHUB_TOKEN com um token que tenha permissao de escrita no repositorio."
    );
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  requireToken();

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 404) {
    throw new Error(
      "Nao encontrado. Verifica o repositorio, ou se o teu token tem acesso a ele."
    );
  }
  if (res.status === 403) {
    throw new Error(
      "O GitHub recusou a operacao. O token pode nao ter permissao de escrita neste repositorio."
    );
  }
  if (res.status === 410) {
    throw new Error("As issues estao desativadas neste repositorio.");
  }
  if (res.status === 422) {
    throw new Error("Os dados enviados sao invalidos para esta operacao.");
  }
  if (!res.ok) {
    throw new Error(`Erro do GitHub (${res.status}).`);
  }

  return (await res.json()) as T;
}

export interface CreatedIssue {
  number: number;
  title: string;
  html_url: string;
  state: string;
}

export interface CreatedComment {
  id: number;
  html_url: string;
}

export function createIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[]
): Promise<CreatedIssue> {
  const payload: Record<string, unknown> = { title };
  if (body) payload.body = body;
  if (labels && labels.length > 0) payload.labels = labels;

  return post<CreatedIssue>(`/repos/${owner}/${repo}/issues`, payload);
}

export function commentOnIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<CreatedComment> {
  return post<CreatedComment>(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    { body }
  );
}

// ---------- analise ----------

export interface RepoDetail {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  license: { name: string } | null;
  topics?: string[];
}

export function getRepo(owner: string, repo: string): Promise<RepoDetail> {
  return get<RepoDetail>(`/repos/${owner}/${repo}`);
}

export function getLanguages(owner: string, repo: string): Promise<Record<string, number>> {
  return get<Record<string, number>>(`/repos/${owner}/${repo}/languages`);
}
