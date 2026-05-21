import React, { useState, useEffect } from 'react';
import { Settings } from '../types';

const SORT_OPTIONS = [
  { value: 'domain', label: 'Domain' },
  { value: 'subdomain', label: 'Subdomain' },
  { value: 'mainPage', label: 'Main Page' },
  { value: 'url', label: 'URL' },
  { value: 'title', label: 'Title' },
  { value: 'lastAccessed', label: 'Last Accessed' },
];

export default function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (response) => {
      if (response) {
        setSettings(response);
        document.documentElement.classList.toggle('dark', response.theme === 'dark');
      }
    });
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const toggleTheme = () => {
    if (!settings) return;
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    update('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setStatus(null);
    try {
      await chrome.runtime.sendMessage({
        action: 'SAVE_SETTINGS',
        settings: {
          sortBy: settings.sortBy,
          reverseOrder: settings.reverseOrder,
          sortPinnedTabs: settings.sortPinnedTabs,
          autoSort: settings.autoSort,
          preserveOrderWithinGroups: settings.preserveOrderWithinGroups,
          groupSuspendedTabs: settings.groupSuspendedTabs,
          excludedDomains: settings.excludedDomains,
          theme: settings.theme,
        },
      });
      setStatus({ type: 'success', message: 'Settings saved' });
    } catch {
      setStatus({ type: 'error', message: 'Failed to save' });
    }
    setSaving(false);
  };

  const sortAndSave = async () => {
    await save();
    chrome.runtime.sendMessage({ action: 'SORT_TABS' });
  };

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputClass = "w-full rounded-lg px-3.5 py-2.5 text-sm transition-colors outline-none focus:ring-2 focus:ring-brand-500/40";
  const labelClass = "text-sm font-medium";
  const cardClass = "glass-strong rounded-2xl p-5 space-y-5";
  const sectionClass = "space-y-3";

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Tablica</h1>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Settings</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl transition-all duration-200 hover:scale-105"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
            title="Toggle theme"
          >
            {settings.theme === 'dark' ? (
              <svg className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </header>

        <div className={cardClass}>
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <label className={labelClass}>Sort by</label>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-gradient-glow', color: 'var(--text-tertiary)' }}>
                {SORT_OPTIONS.find(o => o.value === settings.sortBy)?.label}
              </span>
            </div>
            <div className="relative">
              <select
                value={settings.sortBy}
                onChange={e => update('sortBy', e.target.value as Settings['sortBy'])}
                className={inputClass}
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { key: 'reverseOrder' as const, label: 'Reverse order' },
              { key: 'sortPinnedTabs' as const, label: 'Include pinned tabs' },
              { key: 'autoSort' as const, label: 'Auto-sort on tab change' },
              { key: 'preserveOrderWithinGroups' as const, label: 'Preserve order within groups' },
              { key: 'groupSuspendedTabs' as const, label: 'Group suspended tabs separately' },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 py-1.5 group cursor-pointer"
              >
                <div
                  className="relative w-10 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
                  style={{
                    background: settings[key] ? 'linear-gradient(135deg, #0b84fe, #6366f1)' : 'var(--border-primary)',
                  }}
                >
                  <div
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: settings[key] ? 'translateX(16px)' : 'translateX(0)' }}
                  />
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={e => update(key, e.target.checked as never)}
                    className="sr-only"
                  />
                </div>
                <span className="text-sm font-medium select-none">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <div className={sectionClass}>
            <label className={labelClass}>Excluded domains</label>
            <input
              type="text"
              value={settings.excludedDomains}
              onChange={e => update('excludedDomains', e.target.value)}
              placeholder="e.g. mail.google.com, calendar.google.com"
              className={inputClass}
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}
            />
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Comma-separated. These domains won't be grouped together.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={sortAndSave}
            disabled={saving}
            className="flex-1 py-2.5 px-5 rounded-xl font-semibold text-sm text-white bg-gradient-brand shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Sort & Save'}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="py-2.5 px-5 rounded-xl font-medium text-sm transition-all duration-200 active:scale-[0.98]"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}
          >
            Save Only
          </button>
        </div>

        {status && (
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm animate-slide-up ${
              status.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
            }`}
          >
            {status.type === 'success' ? (
              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-medium">{status.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
