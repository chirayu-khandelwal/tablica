export interface Tab {
  id: number;
  index: number;
  url: string;
  title: string;
  pinned: boolean;
  groupId: number;
  lastAccessed?: number;
  windowId: number;
  active?: boolean;
}

export interface TabGroup {
  id: number;
  title?: string;
  color?: string;
}

export interface SortOptions {
  sortBy: SortBy;
  reverseOrder: boolean;
  sortPinnedTabs: boolean;
}

export interface GroupOptions {
  groupFrom: 'leftToRight' | 'rightToLeft';
  preserveOrderWithinGroups: boolean;
  groupSuspendedTabs: boolean;
  excludedDomains: string[];
}

export interface Settings {
  sortBy: SortBy;
  groupFrom: 'leftToRight' | 'rightToLeft';
  preserveOrderWithinGroups: boolean;
  groupSuspendedTabs: boolean;
  sortPinnedTabs: boolean;
  reverseOrder: boolean;
  autoSort: boolean;
  tabSuspenderExtensionId: string;
  excludedDomains: string;
  theme: 'dark' | 'light';
}

export type SortBy = 'domain' | 'subdomain' | 'mainPage' | 'url' | 'title' | 'lastAccessed' | 'custom';

export interface Message {
  action: string;
  payload?: unknown;
}

export interface TabPosition {
  id: number;
  index: number;
  groupId: number;
  groupTitle?: string;
  groupColor?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  sortBy: 'domain',
  groupFrom: 'leftToRight',
  preserveOrderWithinGroups: false,
  groupSuspendedTabs: false,
  sortPinnedTabs: false,
  reverseOrder: false,
  autoSort: false,
  tabSuspenderExtensionId: 'noogafoofpebimajpfpamcfhoaifemoa',
  excludedDomains: '',
  theme: 'dark',
};
