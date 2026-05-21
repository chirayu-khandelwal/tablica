import { Tab, Settings, SortBy } from './types';
import { getSettings, getLastTabPositions, saveLastTabPositions } from './utils/storage';
import { sortTabs, groupTabsByDomain } from './utils/sorter';
import { extractRootDomain } from './utils/url-utils';

let lastTabPositions: Map<number, { index: number; groupId: number }> = new Map();
let autoSortEnabled = false;

chrome.runtime.onInstalled.addListener(async () => {
  lastTabPositions = await getLastTabPositions();
});

async function saveCurrentTabState(): Promise<void> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  lastTabPositions = new Map(
    tabs.map(tab => [tab.id!, { index: tab.index!, groupId: tab.groupId! }])
  );
  await saveLastTabPositions(lastTabPositions);
}

async function performSort(settings: Settings): Promise<{ success: boolean; message: string }> {
  try {
    await saveCurrentTabState();
    
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs.length === 0) {
      return { success: false, message: 'No tabs found' };
    }

    const sorted = sortTabs(tabs, settings.sortBy, settings.reverseOrder, settings.sortPinnedTabs);
    
    const moves: Promise<void>[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const tab = sorted[i];
      if (tab.index !== i) {
        moves.push(chrome.tabs.move(tab.id!, { index: i }));
      }
    }
    
    await Promise.all(moves);
    
    const tabCount = settings.sortPinnedTabs ? sorted.length : sorted.filter(t => !t.pinned).length;
    return { success: true, message: `Sorted ${tabCount} tab${tabCount !== 1 ? 's' : ''}` };
  } catch (error) {
    return { success: false, message: `Error: ${error}` };
  }
}

async function performGroup(settings: Settings): Promise<{ success: boolean; message: string }> {
  try {
    await saveCurrentTabState();
    
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs.length === 0) {
      return { success: false, message: 'No tabs found' };
    }

    const excludedDomains = settings.excludedDomains
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean);

    const groups = groupTabsByDomain(tabs, excludedDomains, settings.groupSuspendedTabs);
    
    if (groups.size === 0) {
      return { success: true, message: 'No groups to create' };
    }

    const groupIds: Map<string, number> = new Map();
    let position = 0;

    const sortedDomains = Array.from(groups.keys()).sort();
    if (settings.groupFrom === 'rightToLeft') {
      sortedDomains.reverse();
    }

    for (const domain of sortedDomains) {
      const domainTabs = groups.get(domain)!;
      const groupTitle = domain.length > 20 ? domain.substring(0, 17) + '...' : domain;
      
      const groupId = await chrome.tabs.group({ createProperties: { tabIds: domainTabs.map(t => t.id!) } });
      await chrome.tabGroups.update(groupId, { title: groupTitle });
      groupIds.set(domain, groupId);

      for (const tab of domainTabs) {
        const group = groups.get(extractRootDomain(tab.url).toLowerCase())!;
        const localIndex = settings.preserveOrderWithinGroups ? group.indexOf(tab) : 0;
        await chrome.tabs.move(tab.id!, { index: position + localIndex });
      }
      position += domainTabs.length;
    }

    return { success: true, message: `Created ${groupIds.size} group${groupIds.size !== 1 ? 's' : ''}` };
  } catch (error) {
    return { success: false, message: `Error: ${error}` };
  }
}

async function removeDuplicates(): Promise<{ success: boolean; message: string }> {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const seen = new Map<string, Tab>();
    const toClose: number[] = [];

    for (const tab of tabs) {
      if (tab.pinned) continue;
      if (!tab.url) continue;

      const normalizedUrl = tab.url.split('#')[0].split('?')[0];
      
      if (seen.has(normalizedUrl)) {
        toClose.push(tab.id!);
      } else {
        seen.set(normalizedUrl, tab);
      }
    }

    if (toClose.length === 0) {
      return { success: true, message: 'No duplicate tabs found' };
    }

    await chrome.tabs.remove(toClose);
    return { success: true, message: `Removed ${toClose.length} duplicate${toClose.length !== 1 ? 's' : ''}` };
  } catch (error) {
    return { success: false, message: `Error: ${error}` };
  }
}

async function undoSort(): Promise<{ success: boolean; message: string }> {
  try {
    if (lastTabPositions.size === 0) {
      return { success: false, message: 'Nothing to undo' };
    }

    const moves: Promise<void>[] = [];
    const ungroupTabs: number[] = [];

    for (const [tabId, pos] of lastTabPositions) {
      moves.push(chrome.tabs.move(tabId, { index: pos.index }));
      if (pos.groupId !== -1) {
        ungroupTabs.push(tabId);
      }
    }

    await Promise.all(moves);
    
    if (ungroupTabs.length > 0) {
      try {
        await chrome.tabs.ungroup(ungroupTabs);
      } catch {}
    }

    lastTabPositions = new Map();
    await saveLastTabPositions(lastTabPositions);

    return { success: true, message: 'Undo successful' };
  } catch (error) {
    return { success: false, message: `Error: ${error}` };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handleMessage = async () => {
    const settings = await getSettings();
    
    switch (message.action) {
      case 'SORT_TABS':
        return await performSort(settings);
      case 'GROUP_TABS':
        return await performGroup(settings);
      case 'REMOVE_DUPLICATES':
        return await removeDuplicates();
      case 'UNDO_SORT':
        return await undoSort();
      case 'GET_SETTINGS':
        return settings;
      case 'SAVE_SETTINGS':
        await chrome.storage.sync.set(message.settings);
        if (message.settings.autoSort !== undefined) {
          autoSortEnabled = message.settings.autoSort;
        }
        return { success: true };
      case 'GET_AUTO_SORT':
        return { autoSort: autoSortEnabled };
      default:
        return { success: false, message: 'Unknown action' };
    }
  };

  handleMessage().then(sendResponse);
  return true;
});

chrome.tabs.onCreated.addListener(async () => {
  if (autoSortEnabled) {
    const settings = await getSettings();
    if (settings.autoSort) {
      setTimeout(() => performSort(settings), 500);
    }
  }
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo) => {
  if (autoSortEnabled && changeInfo.url) {
    const settings = await getSettings();
    if (settings.autoSort) {
      setTimeout(() => performSort(settings), 500);
    }
  }
});
