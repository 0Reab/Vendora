// Vendora SPA api client. access token kept in localStorage (also mirrored to
// a cookie by the server for mobile parity), org + vendor context in headers.
const LS_T = 'vd_access';
export const LS_ORG = 'vd_org';
export const LS_VENDOR = 'vd_vendor';
export const LS_GUEST = 'vd_guest_seen';

export function getToken() { return localStorage.getItem(LS_T) || ''; }
export function setToken(t: string) { t ? localStorage.setItem(LS_T, t) : localStorage.removeItem(LS_T); }

export async function api(path: string, opts: { method?: string; body?: any; form?: FormData } = {}) {
  const headers: Record<string, string> = {};
  const tok = getToken();
  if (tok) headers.authorization = 'Bearer ' + tok;
  const org = localStorage.getItem(LS_ORG);
  if (org) headers['x-organization-id'] = org;
  const ven = localStorage.getItem(LS_VENDOR);
  if (ven) headers['x-vendor-id'] = ven;
  let body: any = undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(opts.body); }
  const res = await fetch('/api' + path, { method: opts.method || (opts.body !== undefined || opts.form ? 'POST' : 'GET'), headers, body, credentials: 'include' });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok && data?.error) { const e: any = new Error(data.error); e.status = res.status; e.data = data; throw e; }
  return data;
}

export const money = (cents: number | null | undefined) =>
  (cents === null || cents === undefined) ? '' : '$' + ((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });

export function refreshMe(): Promise<any> {
  return api('/auth/refresh', { body: { refreshToken: localStorage.getItem('vd_refresh') || '' } })
    .catch(() => null);
}
