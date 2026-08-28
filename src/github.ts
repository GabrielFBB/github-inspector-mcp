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
