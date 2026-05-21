const MULTI_PART_TLDS = new Set([
  'co.uk', 'co.nz', 'co.za', 'co.jp', 'com.au', 'com.br', 'com.mx',
  'co.in', 'co.kr', 'co.id', 'co.th', 'com.tw', 'com.hk', 'com.sg',
  'org.uk', 'org.au', 'org.nz', 'ac.uk', 'gov.uk', 'net.au',
  'co.ie', 'co.il', 'co.ke', 'co.zm', 'com.cn', 'com.my',
  'com.vn', 'com.pk', 'com.bd', 'com.eg', 'co.bw', 'co.tz',
  'co.ug', 'co.gh', 'co.rw',
]);

const SECOND_LEVEL_TLDS = new Set([
  'in', 'au', 'nz', 'za', 'jp', 'kr', 'id', 'th', 'tw', 'hk', 'sg',
  'uk', 'ie', 'il', 'ke', 'tz', 'ug', 'gh', 'rw', 'zm', 'pk', 'bd', 'eg', 'cn', 'my', 'vn', 'bw',
  'us', 'ca', 'br', 'mx', 'ar', 'cl', 'co', 'pe',
  'de', 'fr', 'it', 'es', 'nl', 'be', 'at', 'ch', 'pl', 'se', 'no', 'dk', 'fi',
  'ru', 'ua', 'cz', 'hu', 'ro', 'gr', 'ph', 'ae', 'sa', 'qa', 'ng',
  'si', 'to', 'ai', 'io', 'sh', 'ly', 'go', 'uz', 'ong',
]);

const SYSTEM_PROTOCOLS = ['chrome:', 'brave:', 'edge:', 'about:', 'file:', 'safari:'];

const SUSPENDED_PATTERNS = [
  /^chrome[-+]extension:\/\/[^/]+\/html\/suspended.html#uri=(.+)$/,
  /^chrome[-+]extension:\/\/[^/]+\/html\/saved.html#url=(.+)$/,
];

export function isSystemUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return SYSTEM_PROTOCOLS.some(p => lower.startsWith(p));
}

export function extractRootDomain(url: string): string {
  if (isSystemUrl(url)) {
    const parts = url.split('/');
    return parts[2] || url;
  }
  
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return url;
    
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    
    const hostParts = hostname.split('.');
    const lastPart = hostParts[hostParts.length - 1];
    
    if (hostParts.length < 2) return hostParts[0] || url;
    
    const lastTwo = hostParts.slice(-2).join('.');
    if (MULTI_PART_TLDS.has(lastTwo)) {
      return hostParts.slice(-3).join('.');
    }
    
    if (SECOND_LEVEL_TLDS.has(lastPart)) {
      return hostParts.slice(-3).join('.');
    }
    
    return hostParts.slice(-2).join('.');
  } catch {
    return url;
  }
}

export function extractSubdomain(url: string): string {
  if (isSystemUrl(url)) return '';
  
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return '';
    
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    
    const parts = hostname.split('.');
    if (parts.length < 3) return '';
    return parts.slice(0, -2).join('.');
  } catch {
    return '';
  }
}

export function extractDomainWithSubdomain(url: string): string {
  const root = extractRootDomain(url);
  const subdomain = extractSubdomain(url);
  return subdomain ? `${subdomain}.${root}` : root;
}

export function extractMainPage(url: string): string {
  if (isSystemUrl(url)) return url;
  
  try {
    const parsed = new URL(url);
    if (!parsed.pathname || parsed.pathname === '/') return parsed.hostname;
    const segments = parsed.pathname.split('/').filter(Boolean);
    return `${parsed.hostname}/${segments[0]}`;
  } catch {
    return url;
  }
}

export function getOriginalUrl(suspendedUrl: string): string | null {
  for (const pattern of SUSPENDED_PATTERNS) {
    const match = suspendedUrl.match(pattern);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }
  return null;
}

export function isSuspendedUrl(url: string): boolean {
  return SUSPENDED_PATTERNS.some(pattern => pattern.test(url));
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.replace(/^www\./i, '');
    return parsed.href;
  } catch {
    return url;
  }
}

export function getUrlPriority(url: string): number {
  const lower = url.toLowerCase();
  if (lower.startsWith('chrome:') || lower.startsWith('about:')) return 1;
  if (lower.startsWith('file:')) return 2;
  if (lower.startsWith('view-source:')) return 3;
  if (lower.startsWith('http:')) return 4;
  if (lower.startsWith('https:')) return 5;
  if (lower.startsWith('ftp:')) return 6;
  return 10;
}
