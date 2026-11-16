export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || (body?.errors ? 'Please fix the highlighted fields' : `Request failed (${status})`));
    this.status = status;
    // field errors from the server validator, shaped { field: message }
    this.errors = body?.errors || null;
  }
}

export function loginUrl() {
  const next = location.pathname + location.search;
  return `/login.html?next=${encodeURIComponent(next)}`;
}

// only follow paths on this site, so a crafted login link can't send someone to another site after they sign in
export function nextPath() {
  const next = new URLSearchParams(location.search).get('next') || '/';
  // compare parsed origins because string checks miss tricks like "/\t/evil.com", which browsers read as "//evil.com"
  const url = new URL(next, location.origin);
  return url.origin === location.origin ? url.pathname + url.search + url.hash : '/';
}

// every call to the backend goes through here so headers, cookies and error parsing live in one place
export async function api(path, { method = 'GET', body, redirectOn401 = true } = {}) {
  const options = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    throw new ApiError(0, { error: 'Could not reach the server. Check your connection and try again.' });
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (res.ok) {
    return data;
  }

  // login and register pass redirectOn401: false because a wrong password there is also a 401
  if (res.status === 401 && redirectOn401) {
    location.href = loginUrl();
  }
  throw new ApiError(res.status, data);
}
