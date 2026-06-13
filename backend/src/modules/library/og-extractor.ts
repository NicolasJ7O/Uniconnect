import type { OGPreview } from './decorators/recurso-academico.interface.js';

const OG_FETCH_TIMEOUT_MS = 4000;

function isSafeHttpUrl(candidate: string): boolean {
  try {
    const parsedUrl = new URL(candidate);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return false;
    }

    if (hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }

    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      const octets = hostname.split('.').map((value) => Number(value));
      const [first, second] = octets;
      if (first === 10) return false;
      if (first === 127) return false;
      if (first === 169 && second === 254) return false;
      if (first === 192 && second === 168) return false;
      if (first === 172 && second >= 16 && second <= 31) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts Open Graph metadata from an external URL using native fetch.
 * Uses a basic regex parser to avoid heavy HTML dependencies.
 * Returns null on any error, timeout, or non-HTML response.
 *
 * This function is designed to be called ASYNCHRONOUSLY (fire-and-forget)
 * after the resource has been persisted, so it never blocks the publish flow.
 */
export async function extractOpenGraph(url: string): Promise<OGPreview | null> {
  try {
    if (!isSafeHttpUrl(url)) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OG_FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: {
        'User-Agent': 'UniConnect-OG-Bot/1.0',
        Accept: 'text/html',
      },
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.includes('text/html')) {
      return null;
    }

    // Read only the first 50 KB to avoid loading huge pages
    const reader = response.body?.getReader();
    if (!reader) return null;

    let html = '';
    let bytesRead = 0;
    const MAX_BYTES = 50_000;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      bytesRead += value.byteLength;
      if (bytesRead >= MAX_BYTES) {
        reader.cancel();
        break;
      }
    }

    return parseOGTags(html);
  } catch {
    // Silently swallow all errors – OG extraction is best-effort
    return null;
  }
}

function parseOGTags(html: string): OGPreview {
  const getOGTag = (property: string): string | null => {
    // Match both property and name attributes
    const regex = new RegExp(
      `<meta[^>]+(?:property|name)=["']og:${property}["'][^>]*content=["']([^"']+)["']`,
      'i',
    );
    const altRegex = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:${property}["']`,
      'i',
    );
    return (regex.exec(html)?.[1] ?? altRegex.exec(html)?.[1]) || null;
  };

  return {
    ogTitle: getOGTag('title'),
    ogDescription: getOGTag('description'),
    ogImage: getOGTag('image'),
    ogSiteName: getOGTag('site_name'),
  };
}
