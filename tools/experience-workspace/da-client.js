/*
 * DA (Document Authoring) API Client
 * Uses IMS token for authenticated requests to admin.da.live
 * Configurable via configure() — call from app.js with AEM_ORG values
 */

import { fetchWithToken, getToken } from './ims.js';

const DA_ADMIN = 'https://admin.da.live';
let DA_ORG = 'AEMXSC';
let DA_REPO = 'xscteamsite';
let DA_BRANCH = 'main';

export function configure({ org, repo, branch } = {}) {
  if (org) DA_ORG = org;
  if (repo) DA_REPO = repo;
  if (branch) DA_BRANCH = branch;
}

export function getOrg() { return DA_ORG; }
export function getRepo() { return DA_REPO; }
export function getBranch() { return DA_BRANCH; }

export function getBasePath() {
  return `${DA_ADMIN}/source/${DA_ORG}/${DA_REPO}`;
}

export async function listPages(path = '/') {
  const url = `${getBasePath()}${path}`;
  const resp = await fetchWithToken(url);
  if (!resp.ok) throw new Error(`DA list failed: ${resp.status}`);
  return resp.json();
}

export async function getPage(path) {
  const url = `${getBasePath()}${path}`;
  const resp = await fetchWithToken(url);
  if (!resp.ok) throw new Error(`DA get failed: ${resp.status}`);
  const contentType = resp.headers.get('content-type');
  if (contentType?.includes('text/html')) return resp.text();
  return resp.json();
}

export async function createPage(path, html) {
  const url = `${getBasePath()}${path}`;
  const blob = new Blob([html], { type: 'text/html' });
  const formData = new FormData();
  formData.append('data', blob, path.split('/').pop());

  const resp = await fetchWithToken(url, {
    method: 'PUT',
    body: formData,
  });
  if (!resp.ok) throw new Error(`DA create failed: ${resp.status}`);
  return resp;
}

export async function updatePage(path, html) {
  return createPage(path, html);
}

export async function deletePage(path) {
  const url = `${getBasePath()}${path}`;
  const resp = await fetchWithToken(url, { method: 'DELETE' });
  if (!resp.ok) throw new Error(`DA delete failed: ${resp.status}`);
  return resp;
}

export async function previewPage(path) {
  const url = `https://admin.hlx.page/preview/${DA_ORG}/${DA_REPO}/${DA_BRANCH}${path}`;
  const resp = await fetchWithToken(url, { method: 'POST' });
  return resp;
}

export async function publishPage(path) {
  const url = `https://admin.hlx.page/live/${DA_ORG}/${DA_REPO}/${DA_BRANCH}${path}`;
  const resp = await fetchWithToken(url, { method: 'POST' });
  return resp;
}

export function getPreviewUrl(path) {
  return `https://${DA_BRANCH}--${DA_REPO.toLowerCase()}--${DA_ORG.toLowerCase()}.aem.page${path}`;
}

export function getLiveUrl(path) {
  return `https://${DA_BRANCH}--${DA_REPO.toLowerCase()}--${DA_ORG.toLowerCase()}.aem.live${path}`;
}

export function isAuthenticated() {
  return !!getToken();
}
