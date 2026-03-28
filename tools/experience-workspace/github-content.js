/*
 * GitHub Content Client — AEMCoder pattern
 *
 * DA stores content in GitHub repos. We write directly to that repo
 * using the GitHub Contents API + a PAT. Same auth model as AEMCoder
 * (Claude Code uses filesystem access; we use the GitHub API equivalent).
 *
 * One credential (GitHub PAT) handles everything:
 * - Read content from DA's GitHub repo
 * - Write/update content
 * - No IMS, no DA auth, no relay bookmarklets
 */

const API = 'https://api.github.com';

/* ─── Token management ─── */

export function getGitHubToken() {
  return localStorage.getItem('ew-github-token') || '';
}

export function setGitHubToken(token) {
  localStorage.setItem('ew-github-token', token.trim());
}

export function hasGitHubToken() {
  return !!getGitHubToken();
}

/* ─── API helpers ─── */

async function ghFetch(url, opts = {}) {
  const token = getGitHubToken();
  if (!token) throw new Error('No GitHub token configured. Add it in Settings.');
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    ...opts.headers,
  };
  const resp = await fetch(url, { ...opts, headers });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${body.slice(0, 200)}`);
  }
  return resp.json();
}

/* ─── Content operations ─── */

/**
 * Read a content file from the DA content repo.
 * Returns { html, sha } where sha is needed for updates.
 */
export async function readContent(org, repo, path, branch = 'main') {
  const filePath = path.replace(/^\/+/, '');
  const htmlPath = filePath.endsWith('.html') ? filePath : `${filePath}.html`;
  const data = await ghFetch(
    `${API}/repos/${org}/${repo}/contents/${htmlPath}?ref=${branch}`,
  );
  const html = atob(data.content.replace(/\n/g, ''));
  return { html, sha: data.sha, path: htmlPath };
}

/**
 * Write/update a content file in the DA content repo.
 * If sha is provided, updates existing file. Otherwise creates new.
 * Returns { commitSha, fileSha, path }.
 */
export async function writeContent(org, repo, path, html, sha = null, branch = 'main') {
  const filePath = path.replace(/^\/+/, '');
  const htmlPath = filePath.endsWith('.html') ? filePath : `${filePath}.html`;

  // If no SHA provided, try to get it (for update)
  let currentSha = sha;
  if (!currentSha) {
    try {
      const existing = await ghFetch(
        `${API}/repos/${org}/${repo}/contents/${htmlPath}?ref=${branch}`,
      );
      currentSha = existing.sha;
    } catch {
      // File doesn't exist — will create new
    }
  }

  const body = {
    message: `Update ${htmlPath} via Experience Workspace`,
    content: btoa(unescape(encodeURIComponent(html))),
    branch,
  };
  if (currentSha) body.sha = currentSha;

  const data = await ghFetch(
    `${API}/repos/${org}/${repo}/contents/${htmlPath}`,
    { method: 'PUT', body: JSON.stringify(body) },
  );

  return {
    commitSha: data.commit?.sha,
    fileSha: data.content?.sha,
    path: htmlPath,
    htmlUrl: data.content?.html_url,
  };
}

/**
 * List content files in a directory.
 */
export async function listContent(org, repo, path = '', branch = 'main') {
  const dirPath = path.replace(/^\/+/, '').replace(/\/+$/, '');
  const url = dirPath
    ? `${API}/repos/${org}/${repo}/contents/${dirPath}?ref=${branch}`
    : `${API}/repos/${org}/${repo}/contents?ref=${branch}`;
  const data = await ghFetch(url);
  return Array.isArray(data)
    ? data.filter((f) => f.name.endsWith('.html') || f.type === 'dir')
    : [data];
}

/**
 * Trigger AEM preview via admin.hlx.page.
 * For DA-backed sites, this needs IMS auth (won't work with GitHub token).
 * Falls back gracefully — content is already written, preview will sync eventually.
 */
export async function triggerPreview(org, repo, branch, path) {
  const pagePath = path.replace(/\.html$/, '').replace(/^\/+/, '');
  const url = `https://admin.hlx.page/preview/${org}/${repo}/${branch}/${pagePath}`;
  try {
    const token = getGitHubToken();
    const resp = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `token ${token}` } : {},
    });
    return { ok: resp.ok, status: resp.status };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}
