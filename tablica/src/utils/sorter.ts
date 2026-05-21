import { Tab } from '../types';
import {
  isSystemUrl,
  extractRootDomain,
  extractDomainWithSubdomain,
  extractMainPage,
  normalizeUrl,
  isSuspendedUrl,
  getOriginalUrl,
} from './url-utils';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function getSortableUrl(url: string): string {
  if (isSuspendedUrl(url)) {
    const original = getOriginalUrl(url);
    if (original) url = original;
  }
  return normalizeUrl(url);
}

function getSortKey(tab: Tab, sortBy: string): { primary: string; secondary: string } {
  const url = getSortableUrl(tab.url);
  
  switch (sortBy) {
    case 'domain':
      return { primary: extractRootDomain(url).toLowerCase(), secondary: tab.title.toLowerCase() };
    
    case 'subdomain':
      return { primary: extractDomainWithSubdomain(url).toLowerCase(), secondary: tab.title.toLowerCase() };
    
    case 'mainPage':
      return { primary: extractMainPage(url).toLowerCase(), secondary: tab.title.toLowerCase() };
    
    case 'url':
      return { primary: url.toLowerCase(), secondary: '' };
    
    case 'title':
      return { primary: tab.title.toLowerCase(), secondary: '' };
    
    case 'lastAccessed':
      return { primary: String(tab.lastAccessed || 0).padStart(20, '0'), secondary: '' };
    
    default:
      return { primary: String(tab.index).padStart(10, '0'), secondary: '' };
  }
}

export function sortTabs(tabs: Tab[], sortBy: string, reverse: boolean, sortPinned: boolean): Tab[] {
  const pinned: Tab[] = [];
  const system: Tab[] = [];
  const normal: Tab[] = [];
  
  for (const tab of tabs) {
    if (tab.pinned) {
      if (sortPinned) normal.push(tab);
      else pinned.push(tab);
    } else if (isSystemUrl(tab.url)) {
      system.push(tab);
    } else {
      normal.push(tab);
    }
  }
  
  const sortTabsInternal = (tabList: Tab[]): Tab[] => {
    if (tabList.length <= 1) return tabList;
    
    return [...tabList]
      .map(tab => ({ tab, key: getSortKey(tab, sortBy) }))
      .sort((a, b) => {
        const cmp = collator.compare(a.key.primary, b.key.primary);
        if (cmp !== 0) return cmp;
        if (a.key.secondary && b.key.secondary) {
          const cmp2 = collator.compare(a.key.secondary, b.key.secondary);
          if (cmp2 !== 0) return cmp2;
        }
        return a.tab.index - b.tab.index;
      })
      .map(item => item.tab);
  };
  
  const sortedSystem = sortTabsInternal(system);
  const sortedNormal = sortTabsInternal(normal);
  
  let result = [...sortedSystem, ...sortedNormal];
  
  if (reverse) result.reverse();
  
  return [...pinned, ...result];
}

export function groupTabsByDomain(
  tabs: Tab[],
  excludedDomains: string[],
  groupSuspended: boolean
): Map<string, Tab[]> {
  const excluded = new Set(excludedDomains.map(d => d.toLowerCase()));
  const groups = new Map<string, Tab[]>();
  
  for (const tab of tabs) {
    if (tab.pinned) continue;
    if (!groupSuspended && tab.url.startsWith('chrome-extension://')) continue;
    
    const url = getSortableUrl(tab.url);
    const domain = extractRootDomain(url).toLowerCase();
    
    if ([...excluded].some(d => domain.includes(d))) continue;
    
    const existing = groups.get(domain);
    if (existing) {
      existing.push(tab);
    } else {
      groups.set(domain, [tab]);
    }
  }
  
  return groups;
}
