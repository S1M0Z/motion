import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import ipaddr from 'ipaddr.js';
import { load } from 'cheerio';
import { DEFAULT_BRAND, type Brand } from '../spec';

export function isPublicAddress(address: string) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
export function normalizeUrl(value: string) {
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443'))
    throw new Error('Utilisez une URL HTTPS publique, sans identifiants ni port personnalisé.');
  if (/^(localhost|.*\.localhost|.*\.local)$/i.test(url.hostname)) throw new Error('Les adresses locales ne sont pas acceptées.');
  url.hash = ''; return url;
}
async function publicHtml(url: URL, redirects = 0): Promise<{ html: string; url: URL }> {
  if (redirects > 3) throw new Error('Trop de redirections.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error('Cette adresse ne correspond pas à un site public.');
  const pinned = addresses[0];
  // Pin the validated address for this connection, including every redirect.
  const response = await new Promise<{ body: string; status: number; location?: string }>((resolve, reject) => {
    const req = httpsRequest(url, {
      family: pinned.family, agent: false,
      lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
      headers: { 'User-Agent': 'MotionStudioLocal/0.1', Accept: 'text/html', 'Accept-Encoding': 'identity' },
    }, res => {
      const status = res.statusCode ?? 500;
      if ([301, 302, 303, 307, 308].includes(status)) { res.resume(); resolve({ body: '', status, location: res.headers.location }); return; }
      if (status >= 400) { res.resume(); reject(new Error(`Le site a répondu avec le statut ${status}.`)); return; }
      if (!res.headers['content-type']?.includes('text/html')) { res.resume(); reject(new Error('Cette URL ne renvoie pas une page HTML.')); return; }
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 2_000_000) req.destroy(new Error('Page trop volumineuse.')); else chunks.push(chunk); });
      res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), status }));
      res.on('error', reject);
    });
    const timeout = setTimeout(() => req.destroy(new Error('Le site ne répond pas. Vous pouvez continuer avec vos assets et votre brief.')), 10_000);
    req.on('close', () => clearTimeout(timeout)); req.on('error', reject); req.end();
  });
  if (response.location) return publicHtml(normalizeUrl(new URL(response.location, url).href), redirects + 1);
  return { html: response.body, url };
}
export async function analyzeBrand(value: string): Promise<{ brand: Brand; url: string }> {
  const { html, url } = await publicHtml(normalizeUrl(value));
  const $ = load(html);
  const name = ($('meta[property="og:site_name"]').attr('content') || $('title').text().split(/[|—–]/)[0] || url.hostname).trim().slice(0, 60);
  const description = ($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '').trim().slice(0, 500);
  const theme = $('meta[name="theme-color"]').attr('content') ?? '';
  return { url: url.href, brand: { ...DEFAULT_BRAND, name: name || url.hostname, description, accent: /^#[0-9a-fA-F]{6}$/.test(theme) ? theme : DEFAULT_BRAND.accent } };
}
