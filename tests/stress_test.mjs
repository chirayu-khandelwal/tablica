/**
 * Tablica ULTIMATE Stress Test Suite v3
 * 
 * Tests up to 10,000 tabs with batched moves, sort locks, and group re-binding.
 * Run: node tests/stress_test.mjs
 */

// ─── Chrome API Mock ────────────────────────────────────────────────────────

let mockTabs = [];
let mockGroups = [];
let nextGroupId = 100;
let apiCallCount = { move: 0, groupMove: 0, group: 0 };

const chrome = {
  windows: {
    getLastFocused: async () => ({ id: 1 }),
    getAll: async () => [{ id: 1 }],
    create: async () => ({ id: 2 }),
  },
  storage: { sync: { get: async () => ({}), set: async () => {} } },
  tabs: {
    query: async (opts) => {
      return mockTabs.filter(t => {
        if (opts.windowId !== undefined && t.windowId !== opts.windowId) return false;
        if (opts.pinned !== undefined && t.pinned !== opts.pinned) return false;
        if (opts.groupId !== undefined && t.groupId !== opts.groupId) return false;
        if (opts.active !== undefined && t.active !== opts.active) return false;
        return true;
      });
    },
    move: async (tabIds, { index }) => {
      apiCallCount.move++;
      const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
      const tabsToMove = [];
      for (const id of ids) {
        const idx = mockTabs.findIndex(t => t.id === id);
        if (idx === -1) throw new Error(`Tab ${id} not found`);
        tabsToMove.push(mockTabs.splice(idx, 1)[0]);
      }
      const insertAt = Math.min(index, mockTabs.length);
      mockTabs.splice(insertAt, 0, ...tabsToMove);
      mockTabs.forEach((t, i) => t.index = i);
    },
    group: async (opts) => {
      apiCallCount.group++;
      const ids = opts.tabIds;
      let gid = opts.groupId;
      if (!gid || gid <= 0) {
        gid = nextGroupId++;
        mockGroups.push({ id: gid, title: '', collapsed: false, windowId: 1 });
      }
      for (const id of ids) {
        const tab = mockTabs.find(t => t.id === id);
        if (tab) tab.groupId = gid;
      }
      return gid;
    },
    ungroup: async (tabId) => {
      const tab = mockTabs.find(t => t.id === tabId);
      if (tab) tab.groupId = -1;
    },
    update: async (tabId, props) => {
      const tab = mockTabs.find(t => t.id === tabId);
      if (tab) Object.assign(tab, props);
    },
    reload: async () => {},
    duplicate: async () => {},
    remove: async (ids) => {
      const idArr = Array.isArray(ids) ? ids : [ids];
      mockTabs = mockTabs.filter(t => !idArr.includes(t.id));
      mockTabs.forEach((t, i) => t.index = i);
    },
  },
  tabGroups: {
    query: async (opts) => mockGroups.filter(g => g.windowId === opts.windowId),
    update: async (gid, props) => {
      const g = mockGroups.find(g => g.id === gid);
      if (g) Object.assign(g, props);
    },
    move: async (groupId, { index }) => {
      apiCallCount.groupMove++;
      const groupTabs = mockTabs.filter(t => t.groupId === groupId);
      if (groupTabs.length === 0) return;
      mockTabs = mockTabs.filter(t => t.groupId !== groupId);
      const insertAt = Math.min(index, mockTabs.length);
      mockTabs.splice(insertAt, 0, ...groupTabs);
      mockTabs.forEach((t, i) => t.index = i);
    },
  },
  runtime: {
    onMessage: { addListener: () => {} },
    onInstalled: { addListener: () => {} },
  },
};

globalThis.chrome = chrome;

// ─── Inline Utils ───────────────────────────────────────────────────────────

function getRealUrl(tab) {
  const url = tab.pendingUrl || tab.url;
  if (url && url.startsWith('chrome-extension://') && url.includes('#')) {
    try {
      const decoded = decodeURIComponent(url.split('#')[1]);
      return decoded.startsWith('http') ? decoded : url;
    } catch { return url; }
  }
  return url || '';
}
function getDomain(tab) {
  try { return new URL(getRealUrl(tab)).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function getSubdomain(tab) {
  try { return new URL(getRealUrl(tab)).hostname; } catch { return ''; }
}

const DEFAULT_SETTINGS = {
  sortBy: 'domain', sortPinned: false, reverse: false,
  autoSort: false, groupBy: 'domain', excludeDomains: [],
  suspenderId: 'noogafoofpebimajpfpamcfhoaifemoa'
};
let testSettings = { ...DEFAULT_SETTINGS };
async function getSettings() { return { ...DEFAULT_SETTINGS, ...testSettings }; }

// ─── Inline Sort Logic (mirrors production sort.js EXACTLY) ─────────────────

let _sortRunning = false;
const BATCH_SIZE = 50;

function getUrlTypePriority(url) {
  if (!url) return 99;
  if (url.startsWith('brave://')) return 0;
  if (url.startsWith('chrome://')) return 1;
  if (url.startsWith('chrome-extension://')) return 2;
  if (url.startsWith('file://')) return 3;
  return 5;
}

function compareByUrlComponents(urlA, urlB) {
  const keyA = urlA.hostname.replace(/^www\./i, '') + urlA.pathname + urlA.search + urlA.hash;
  const keyB = urlB.hostname.replace(/^www\./i, '') + urlB.pathname + urlB.search + urlB.hash;
  return keyA.localeCompare(keyB);
}

function buildComparator(settings) {
  return function compareTabs(a, b) {
    if (!settings.sortPinned && (a.pinned || b.pinned)) return 0;
    const pA = getUrlTypePriority(a.url), pB = getUrlTypePriority(b.url);
    if (pA !== pB) return settings.reverse ? pB - pA : pA - pB;
    const blA = !a.url || a.url === 'about:blank' || a.url === 'chrome://newtab/' || a.url === 'brave://newtab/';
    const blB = !b.url || b.url === 'about:blank' || b.url === 'chrome://newtab/' || b.url === 'brave://newtab/';
    if (blA && !blB) return -1;
    if (!blA && blB) return 1;
    let cmp = 0;
    switch (settings.sortBy) {
      case 'title': cmp = (a.title||'').toLowerCase().localeCompare((b.title||'').toLowerCase()); break;
      case 'lastAccess': cmp = (b.lastAccessed||0) - (a.lastAccessed||0); break;
      case 'subdomain': {
        cmp = getSubdomain(a).localeCompare(getSubdomain(b));
        if (cmp===0) try { cmp = compareByUrlComponents(new URL(getRealUrl(a)), new URL(getRealUrl(b))); } catch {}
        break;
      }
      case 'url': try { cmp = compareByUrlComponents(new URL(getRealUrl(a)), new URL(getRealUrl(b))); } catch {} break;
      case 'domain': default: {
        cmp = getDomain(a).toLowerCase().localeCompare(getDomain(b).toLowerCase());
        if (cmp===0) try { cmp = compareByUrlComponents(new URL(getRealUrl(a)), new URL(getRealUrl(b))); } catch {}
        break;
      }
    }
    return settings.reverse ? -cmp : cmp;
  };
}

async function batchMove(tabIds, startIndex) {
  if (tabIds.length <= BATCH_SIZE) {
    await chrome.tabs.move(tabIds, { index: startIndex });
    return;
  }
  for (let i = 0; i < tabIds.length; i += BATCH_SIZE) {
    const chunk = tabIds.slice(i, i + BATCH_SIZE);
    await chrome.tabs.move(chunk, { index: startIndex + i });
  }
}

async function sortAndMoveTabs(tabs, groupId, startIndex, compareFn) {
  if (tabs.length === 0) return;
  tabs.sort(compareFn);
  const tabIds = tabs.map(t => t.id);
  await batchMove(tabIds, startIndex);
  if (groupId > -1) {
    for (let i = 0; i < tabIds.length; i += BATCH_SIZE) {
      const chunk = tabIds.slice(i, i + BATCH_SIZE);
      try { await chrome.tabs.group({ groupId, tabIds: chunk }); } catch {}
    }
  }
}

async function performSort() {
  if (_sortRunning) return;
  _sortRunning = true;
  try {
    const win = await chrome.windows.getLastFocused();
    if (!win) return;
    const settings = await getSettings();
    const compareFn = buildComparator(settings);

    const pinnedTabs = await chrome.tabs.query({ windowId: win.id, pinned: true });
    let groupOffset = pinnedTabs.length;
    if (pinnedTabs.length > 1 && settings.sortPinned) {
      pinnedTabs.sort(compareFn);
      for (let i = 0; i < pinnedTabs.length; i++) {
        try { await chrome.tabs.move(pinnedTabs[i].id, { index: i }); } catch {}
      }
    }

    let tabGroups = [];
    try { tabGroups = await chrome.tabGroups.query({ windowId: win.id }); } catch {}
    tabGroups.sort((a, b) => {
      const tA = (a.title||'').toLowerCase(), tB = (b.title||'').toLowerCase();
      return settings.reverse ? tB.localeCompare(tA) : tA.localeCompare(tB);
    });

    for (const group of tabGroups) {
      try { await chrome.tabGroups.move(group.id, { index: groupOffset }); } catch { continue; }
      let groupTabs;
      try { groupTabs = await chrome.tabs.query({ windowId: win.id, groupId: group.id }); } catch { continue; }
      if (groupTabs.length === 0) continue;
      groupOffset += groupTabs.length;
      await sortAndMoveTabs(groupTabs, group.id, groupTabs[0]?.index ?? (groupOffset - groupTabs.length), compareFn);
    }

    const ungroupedTabs = await chrome.tabs.query({ windowId: win.id, pinned: false, groupId: -1 });
    if (ungroupedTabs.length > 0) {
      await sortAndMoveTabs(ungroupedTabs, -1, groupOffset, compareFn);
    }
  } finally { _sortRunning = false; }
}

// ─── Inline Group Logic ────────────────────────────────────────────────────

async function performGroup() {
  const win = await chrome.windows.getLastFocused();
  if (!win) return;
  const tabs = await chrome.tabs.query({ windowId: win.id, pinned: false });
  const settings = await getSettings();
  const groups = {};
  tabs.forEach(t => {
    const key = settings.groupBy === 'subdomain' ? getSubdomain(t) : getDomain(t);
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  for (const [key, domainTabs] of Object.entries(groups)) {
    if (domainTabs.length < 2) continue;
    if (settings.excludeDomains.some(d => key.endsWith(d))) continue;
    const existing = domainTabs.find(t => t.groupId > 0);
    const ids = domainTabs.map(t => t.id);
    try {
      const opts = { tabIds: ids };
      if (existing) opts.groupId = existing.groupId;
      const gid = await chrome.tabs.group(opts);
      if (!existing) await chrome.tabGroups.update(gid, { title: key, collapsed: false });
    } catch {}
  }
}

// ─── Test Helpers ───────────────────────────────────────────────────────────

let testNum = 0, passed = 0, failed = 0;
const failures = [];

function makeTab(id, url, title, opts = {}) {
  return {
    id, url, title: title || url, index: opts.index ?? 0,
    pinned: opts.pinned ?? false, groupId: opts.groupId ?? -1,
    active: opts.active ?? false, windowId: 1,
    lastAccessed: opts.lastAccessed ?? Date.now(),
  };
}

function resetState() {
  mockTabs = []; mockGroups = []; nextGroupId = 100; _sortRunning = false;
  testSettings = { ...DEFAULT_SETTINGS };
  apiCallCount = { move: 0, groupMove: 0, group: 0 };
}

function assert(c, m) { if (!c) throw new Error(`Assertion failed: ${m}`); }

async function runTest(name, fn) {
  testNum++; resetState();
  const start = performance.now();
  try { await fn(); passed++; const ms = (performance.now() - start).toFixed(0); console.log(`  ✅ #${testNum} ${name} (${ms}ms)`); }
  catch (e) { failed++; failures.push({ num: testNum, name, error: e.message }); console.log(`  ❌ #${testNum} ${name}\n     → ${e.message}`); }
}

function assertGroupContiguous(gid) {
  const idx = mockTabs.map((t, i) => t.groupId === gid ? i : -1).filter(i => i >= 0);
  if (idx.length < 2) return;
  for (let i = 1; i < idx.length; i++) assert(idx[i] === idx[i-1]+1, `Group ${gid} NOT contiguous! [${idx}]`);
}
function assertAllGroupsContiguous() {
  const gids = [...new Set(mockTabs.filter(t => t.groupId > 0).map(t => t.groupId))];
  for (const g of gids) assertGroupContiguous(g);
}
function assertDomainOrder() {
  for (let i = 1; i < mockTabs.length; i++) {
    if (mockTabs[i].pinned || mockTabs[i-1].pinned) continue;
    if (mockTabs[i].groupId > 0 || mockTabs[i-1].groupId > 0) continue;
    const a = getDomain(mockTabs[i-1]), b = getDomain(mockTabs[i]);
    if (!a || !b) continue;
    assert(a.localeCompare(b) <= 0, `Not sorted at ${i}: ${a} > ${b}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║   TABLICA ULTIMATE STRESS TEST v3 — up to 10,000 tabs        ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

// ━━━ 1: Basic Sorting ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('━━━ 1: Basic Sorting ━━━');

await runTest('Sort 5 tabs by domain', async () => {
  mockTabs = [
    makeTab(1,'https://zebra.com/p','Zebra',{index:0}),makeTab(2,'https://apple.com/p','Apple',{index:1}),
    makeTab(3,'https://mango.com/p','Mango',{index:2}),makeTab(4,'https://banana.com/p','Banana',{index:3}),
    makeTab(5,'https://cherry.com/p','Cherry',{index:4}),
  ];
  await performSort();
  assert(getDomain(mockTabs[0])==='apple.com');
  assert(getDomain(mockTabs[4])==='zebra.com');
});

await runTest('Sort by title', async () => {
  testSettings.sortBy = 'title';
  mockTabs = [makeTab(1,'https://a.com','Zebra',{index:0}),makeTab(2,'https://b.com','Apple',{index:1}),makeTab(3,'https://c.com','Mango',{index:2})];
  await performSort();
  assert(mockTabs[0].title === 'Apple');
  assert(mockTabs[2].title === 'Zebra');
});

await runTest('Sort by URL', async () => {
  testSettings.sortBy = 'url';
  mockTabs = [makeTab(1,'https://z.com/z','Z',{index:0}),makeTab(2,'https://a.com/a','A',{index:1})];
  await performSort();
  assert(mockTabs[0].url === 'https://a.com/a');
});

await runTest('Reverse order', async () => {
  testSettings.reverse = true;
  mockTabs = [makeTab(1,'https://apple.com','A',{index:0}),makeTab(2,'https://banana.com','B',{index:1}),makeTab(3,'https://cherry.com','C',{index:2})];
  await performSort();
  assert(getDomain(mockTabs[0])==='cherry.com');
});

await runTest('lastAccess sort (newest first)', async () => {
  testSettings.sortBy = 'lastAccess';
  const now = Date.now();
  mockTabs = [makeTab(1,'https://old.com','Old',{index:0,lastAccessed:now-10000}),makeTab(2,'https://new.com','New',{index:1,lastAccessed:now}),makeTab(3,'https://mid.com','Mid',{index:2,lastAccessed:now-5000})];
  await performSort();
  assert(mockTabs[0].url==='https://new.com');
  assert(mockTabs[2].url==='https://old.com');
});

await runTest('System tabs (chrome://) sort first', async () => {
  mockTabs = [makeTab(1,'https://zebra.com','Z',{index:0}),makeTab(2,'chrome://settings','S',{index:1}),makeTab(3,'https://apple.com','A',{index:2})];
  await performSort();
  assert(mockTabs[0].url.startsWith('chrome://'), `First: ${mockTabs[0].url}`);
});

await runTest('brave:// tabs sort before chrome://', async () => {
  mockTabs = [makeTab(1,'chrome://settings','CS',{index:0}),makeTab(2,'brave://settings','BS',{index:1}),makeTab(3,'https://z.com','Z',{index:2})];
  await performSort();
  assert(mockTabs[0].url.startsWith('brave://'));
  assert(mockTabs[1].url.startsWith('chrome://'));
});

// ━━━ 2: Pinned ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n━━━ 2: Pinned Tab Handling ━━━');

await runTest('Pinned before unpinned', async () => {
  mockTabs = [makeTab(1,'https://z.com','Z',{index:0,pinned:true}),makeTab(2,'https://a.com','A',{index:1,pinned:true}),makeTab(3,'https://b.com','B',{index:2})];
  await performSort();
  assert(mockTabs[0].pinned && mockTabs[1].pinned && !mockTabs[2].pinned);
});

await runTest('sortPinned=true sorts them', async () => {
  testSettings.sortPinned = true;
  mockTabs = [makeTab(1,'https://zebra.com','Z',{index:0,pinned:true}),makeTab(2,'https://apple.com','A',{index:1,pinned:true})];
  await performSort();
  assert(getDomain(mockTabs[0])==='apple.com');
});

await runTest('sortPinned=false leaves them', async () => {
  mockTabs = [makeTab(1,'https://zebra.com','Z',{index:0,pinned:true}),makeTab(2,'https://apple.com','A',{index:1,pinned:true})];
  await performSort();
  assert(mockTabs[0].id === 1);
});

// ━━━ 3: Group Preservation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n━━━ 3: Group Preservation ━━━');

await runTest('Grouped tabs contiguous after sort', async () => {
  mockGroups = [{id:50,title:'github.com',windowId:1}];
  mockTabs = [makeTab(1,'https://zebra.com','Z',{index:0}),makeTab(2,'https://github.com/a','GH',{index:1,groupId:50}),makeTab(3,'https://apple.com','A',{index:2}),makeTab(4,'https://github.com/z','GH2',{index:3,groupId:50}),makeTab(5,'https://banana.com','B',{index:4})];
  await performSort();
  assertGroupContiguous(50);
});

await runTest('Multiple groups stay contiguous', async () => {
  mockGroups = [{id:50,title:'github.com',windowId:1},{id:51,title:'google.com',windowId:1}];
  mockTabs = [makeTab(1,'https://google.com/s','GS',{index:0,groupId:51}),makeTab(2,'https://zebra.com','Z',{index:1}),makeTab(3,'https://github.com/a','GH',{index:2,groupId:50}),makeTab(4,'https://google.com/m','GM',{index:3,groupId:51}),makeTab(5,'https://apple.com','A',{index:4}),makeTab(6,'https://github.com/z','GH2',{index:5,groupId:50})];
  await performSort();
  assertGroupContiguous(50);
  assertGroupContiguous(51);
});

await runTest('Internal group sort works', async () => {
  mockGroups = [{id:50,title:'github.com',windowId:1}];
  mockTabs = [makeTab(1,'https://github.com/zzz','Z',{index:0,groupId:50}),makeTab(2,'https://github.com/aaa','A',{index:1,groupId:50}),makeTab(3,'https://github.com/mmm','M',{index:2,groupId:50})];
  await performSort();
  assertGroupContiguous(50);
  const g = mockTabs.filter(t=>t.groupId===50);
  assert(g[0].url.includes('/aaa'));
  assert(g[2].url.includes('/zzz'));
});

await runTest('groupId preserved after move', async () => {
  mockGroups = [{id:50,title:'github.com',windowId:1}];
  mockTabs = [makeTab(1,'https://zebra.com','Z',{index:0}),makeTab(2,'https://github.com/a','GH',{index:1,groupId:50}),makeTab(3,'https://github.com/b','GH2',{index:2,groupId:50})];
  await performSort();
  assert(mockTabs.find(t=>t.id===2).groupId===50);
  assert(mockTabs.find(t=>t.id===3).groupId===50);
});

await runTest('Groups sorted alphabetically by title', async () => {
  mockGroups = [{id:50,title:'zebra',windowId:1},{id:51,title:'apple',windowId:1}];
  mockTabs = [makeTab(1,'https://z.com/a','ZA',{index:0,groupId:50}),makeTab(2,'https://z.com/b','ZB',{index:1,groupId:50}),makeTab(3,'https://a.com/a','AA',{index:2,groupId:51}),makeTab(4,'https://a.com/b','AB',{index:3,groupId:51})];
  await performSort();
  assert(mockTabs.findIndex(t=>t.groupId===51) < mockTabs.findIndex(t=>t.groupId===50));
});

// ━━━ 4: Grouping ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n━━━ 4: Grouping Logic ━━━');

await runTest('Groups same domain', async () => {
  mockTabs = [makeTab(1,'https://github.com/a','A',{index:0}),makeTab(2,'https://google.com/s','B',{index:1}),makeTab(3,'https://github.com/b','C',{index:2}),makeTab(4,'https://solo.com','D',{index:3})];
  await performGroup();
  assert(mockTabs.find(t=>t.id===1).groupId > 0);
  assert(mockTabs.find(t=>t.id===1).groupId === mockTabs.find(t=>t.id===3).groupId);
  assert(mockTabs.find(t=>t.id===4).groupId === -1);
});

await runTest('Appends to existing group', async () => {
  mockGroups = [{id:50,title:'github.com',windowId:1}];
  mockTabs = [makeTab(1,'https://github.com/a','A',{index:0,groupId:50}),makeTab(2,'https://github.com/b','B',{index:1,groupId:50}),makeTab(3,'https://github.com/c','C',{index:2})];
  await performGroup();
  assert(mockTabs.find(t=>t.id===3).groupId===50);
});

await runTest('Excluded domains not grouped', async () => {
  testSettings.excludeDomains = ['google.com'];
  mockTabs = [makeTab(1,'https://google.com/a','A',{index:0}),makeTab(2,'https://google.com/b','B',{index:1}),makeTab(3,'https://github.com/a','C',{index:2}),makeTab(4,'https://github.com/b','D',{index:3})];
  await performGroup();
  assert(mockTabs.find(t=>t.id===1).groupId === -1);
  assert(mockTabs.find(t=>t.id===3).groupId > 0);
});

// ━━━ 5: Combined ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n━━━ 5: Sort + Group Combined ━━━');

await runTest('Group→Sort preserves groups', async () => {
  mockTabs = [makeTab(1,'https://zebra.com/a','ZA',{index:0}),makeTab(2,'https://github.com/z','GHZ',{index:1}),makeTab(3,'https://apple.com/a','AA',{index:2}),makeTab(4,'https://github.com/a','GHA',{index:3}),makeTab(5,'https://apple.com/b','AB',{index:4})];
  await performGroup();
  await performSort();
  assertAllGroupsContiguous();
});

await runTest('5-cycle sort↔group stress', async () => {
  const d = ['alpha','bravo','charlie','delta'];
  for (let i = 0; i < 40; i++) mockTabs.push(makeTab(i+1,`https://${d[i%4]}.com/p${i}`,`${d[i%4]} ${i}`,{index:i}));
  for (let c = 0; c < 5; c++) { await performSort(); await performGroup(); }
  assertAllGroupsContiguous();
  assert(mockTabs.length === 40);
});

await runTest('Sort lock prevents concurrent sorts', async () => {
  for (let i = 0; i < 20; i++) mockTabs.push(makeTab(i+1,`https://${String.fromCharCode(122-i%26)}.com/p`,`T${i}`,{index:i}));
  // Fire two sorts concurrently - second should be skipped
  const p1 = performSort();
  const p2 = performSort();
  await Promise.all([p1, p2]);
  assert(mockTabs.length === 20);
});

// ━━━ 6: SCALE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n━━━ 6: Massive Scale ━━━');

await runTest('100 ungrouped tabs', async () => {
  const d = ['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel','india','juliet'];
  for (let i = 0; i < 100; i++) { const dom = d[Math.floor(Math.random()*10)]; mockTabs.push(makeTab(i+1,`https://${dom}.com/p${i}`,`${dom}${i}`,{index:i})); }
  await performSort();
  assertDomainOrder();
});

await runTest('500 tabs, 15 groups', async () => {
  const d = ['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel','india','juliet','kilo','lima','mike','november','oscar'];
  for (let g=0;g<15;g++) mockGroups.push({id:200+g,title:`${d[g]}.com`,windowId:1});
  for (let i=0;i<500;i++) { const dI=i%15; mockTabs.push(makeTab(i+1,`https://${d[dI]}.com/p${i}`,`${d[dI]}${i}`,{index:i,groupId:(i%3===0)?-1:200+dI})); }
  await performSort();
  for (let g=0;g<15;g++) assertGroupContiguous(200+g);
  assert(mockTabs.length===500);
});

await runTest('1,000 tabs, 20 groups', async () => {
  const d = Array.from({length:20},(_,i)=>`domain${String(i).padStart(2,'0')}`);
  for (let g=0;g<20;g++) mockGroups.push({id:300+g,title:`${d[g]}.com`,windowId:1});
  for (let i=0;i<1000;i++) { const dI=i%20; mockTabs.push(makeTab(i+1,`https://${d[dI]}.com/p${i}`,`${d[dI]}${i}`,{index:i,groupId:(i%4===0)?-1:300+dI})); }
  await performSort();
  for (let g=0;g<20;g++) assertGroupContiguous(300+g);
  assert(mockTabs.length===1000);
});

await runTest('2,000 tabs, 30 groups + group→sort cycle', async () => {
  const d = Array.from({length:30},(_,i)=>`site${String(i).padStart(2,'0')}`);
  for (let g=0;g<30;g++) mockGroups.push({id:500+g,title:`${d[g]}.com`,windowId:1});
  for (let i=0;i<2000;i++) { const dI=i%30; mockTabs.push(makeTab(i+1,`https://${d[dI]}.com/p${i}`,`${d[dI]}${i}`,{index:i,groupId:(i%5===0)?-1:500+dI})); }
  await performSort();
  await performGroup();
  await performSort();
  for (let g=0;g<30;g++) assertGroupContiguous(500+g);
  assert(mockTabs.length===2000);
});

await runTest('5,000 tabs, 50 groups', async () => {
  const d = Array.from({length:50},(_,i)=>`host${String(i).padStart(2,'0')}`);
  for (let g=0;g<50;g++) mockGroups.push({id:600+g,title:`${d[g]}.com`,windowId:1});
  for (let i=0;i<5000;i++) { const dI=i%50; mockTabs.push(makeTab(i+1,`https://${d[dI]}.com/p${i}`,`${d[dI]}${i}`,{index:i,groupId:(i%3===0)?-1:600+dI})); }
  await performSort();
  for (let g=0;g<50;g++) assertGroupContiguous(600+g);
  assert(mockTabs.length===5000);
});

await runTest('10,000 tabs, 100 groups — THE ULTIMATE TEST', async () => {
  const d = Array.from({length:100},(_,i)=>`web${String(i).padStart(3,'0')}`);
  for (let g=0;g<100;g++) mockGroups.push({id:700+g,title:`${d[g]}.com`,windowId:1});
  for (let i=0;i<10000;i++) { const dI=i%100; mockTabs.push(makeTab(i+1,`https://${d[dI]}.com/p${i}`,`${d[dI]}${i}`,{index:i,groupId:(i%4===0)?-1:700+dI})); }
  const start = performance.now();
  await performSort();
  const elapsed = performance.now() - start;
  for (let g=0;g<100;g++) assertGroupContiguous(700+g);
  assert(mockTabs.length===10000, `Count: ${mockTabs.length}`);
  console.log(`     ⏱  10K sort completed in ${elapsed.toFixed(0)}ms | API calls: ${apiCallCount.move} moves, ${apiCallCount.groupMove} group-moves, ${apiCallCount.group} group-binds`);
});

// ━━━ 7: Edge Cases ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n━━━ 7: Edge Cases ━━━');

await runTest('Empty window', async () => { await performSort(); await performGroup(); assert(mockTabs.length===0); });
await runTest('Single tab', async () => { mockTabs=[makeTab(1,'https://solo.com','S',{index:0})]; await performSort(); assert(mockTabs.length===1); });
await runTest('All pinned, sortPinned=false', async () => { mockTabs=[makeTab(1,'https://z.com','Z',{index:0,pinned:true}),makeTab(2,'https://a.com','A',{index:1,pinned:true})]; await performSort(); assert(mockTabs[0].id===1); });
await runTest('about:blank + empty URLs', async () => { mockTabs=[makeTab(1,'','Empty',{index:0}),makeTab(2,'https://apple.com','A',{index:1}),makeTab(3,'about:blank','B',{index:2})]; await performSort(); assert(mockTabs.length===3); });
await runTest('Suspended tab URL resolves', async () => { mockTabs=[makeTab(1,'chrome-extension://noogafoofpebimajpfpamcfhoaifemoa/suspended.html#https://github.com/test','S',{index:0})]; const r=getRealUrl(mockTabs[0]); assert(r==='https://github.com/test',`Got: ${r}`); });
await runTest('www. stripped in domain compare', async () => { mockTabs=[makeTab(1,'https://www.github.com/a','A',{index:0}),makeTab(2,'https://github.com/b','B',{index:1})]; await performGroup(); assert(mockTabs[0].groupId===mockTabs[1].groupId && mockTabs[0].groupId>0); });
await runTest('Singleton not grouped', async () => { mockTabs=[makeTab(1,'https://a.com','A',{index:0}),makeTab(2,'https://b.com','B',{index:1})]; await performGroup(); assert(mockTabs.every(t=>t.groupId===-1)); });
await runTest('Secondary sort by URL within domain', async () => { mockTabs=[makeTab(1,'https://github.com/zzz','Z',{index:0}),makeTab(2,'https://github.com/aaa','A',{index:1}),makeTab(3,'https://github.com/mmm','M',{index:2})]; await performSort(); assert(mockTabs[0].url.includes('/aaa')); assert(mockTabs[2].url.includes('/zzz')); });

// ━━━ 8: Real World ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n━━━ 8: Real-World Simulation ━━━');

await runTest('80 tabs, 12 domains: full cycle', async () => {
  const r=['github.com','stackoverflow.com','google.com','youtube.com','reddit.com','twitter.com','medium.com','dev.to','npmjs.com','mozilla.org','w3schools.com','linkedin.com'];
  for (let i=0;i<80;i++) { const d=r[(i*7+3)%r.length]; mockTabs.push(makeTab(i+1,`https://${d}/p${i}`,`${d} ${i}`,{index:i})); }
  await performSort();
  await performGroup();
  await performSort();
  assertAllGroupsContiguous();
  assert(mockTabs.length===80);
});

await runTest('150 tabs: pinned + groups + loose', async () => {
  testSettings.sortPinned = true;
  const d=['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel','india','juliet'];
  for (let i=0;i<5;i++) mockTabs.push(makeTab(i+1,`https://${d[4-i]}.com/pin`,`Pin${i}`,{index:i,pinned:true}));
  for (let g=0;g<10;g++) { const gid=400+g; mockGroups.push({id:gid,title:`${d[g]}.com`,windowId:1}); for (let t=0;t<10;t++) mockTabs.push(makeTab(100+g*10+t,`https://${d[g]}.com/p${t}`,`${d[g]}${t}`,{index:5+g*10+t,groupId:gid})); }
  for (let i=0;i<45;i++) mockTabs.push(makeTab(300+i,`https://${d[i%10]}.com/l${i}`,`L${i}`,{index:105+i}));
  await performSort();
  for (let i=0;i<5;i++) assert(mockTabs[i].pinned);
  for (let g=0;g<10;g++) assertGroupContiguous(400+g);
  assert(mockTabs.length===150);
});

// ━━━ 9: Batching Verification ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n━━━ 9: Batching Verification ━━━');

await runTest('200 ungrouped tabs use batched moves (>1 API call)', async () => {
  for (let i=0;i<200;i++) mockTabs.push(makeTab(i+1,`https://${String.fromCharCode(97+(i%26))}.com/p${i}`,`T${i}`,{index:i}));
  await performSort();
  assert(apiCallCount.move > 1, `Expected multiple move calls for 200 tabs, got ${apiCallCount.move}`);
  assertDomainOrder();
});

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log(`║  RESULTS: ${passed} passed, ${failed} failed out of ${testNum} tests`);
if (failed===0) console.log('║  🎉 ALL TESTS PASSED                                          ║');
else console.log('║  ⚠️  FAILURES DETECTED                                         ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
if (failures.length > 0) { console.log('\nFailed:'); for (const f of failures) console.log(`  #${f.num} ${f.name}: ${f.error}`); }
process.exit(failed > 0 ? 1 : 0);
