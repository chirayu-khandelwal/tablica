import React, { useState, useEffect } from 'react';
import { Settings } from '../types';
import ActionButton from './ActionButton';
import StatusMessage from './StatusMessage';

const SORT_OPTIONS = [
  { value: 'domain', label: 'Domain' },
  { value: 'subdomain', label: 'Subdomain' },
  { value: 'mainPage', label: 'Main Page' },
  { value: 'url', label: 'URL' },
  { value: 'title', label: 'Title' },
  { value: 'lastAccessed', label: 'Last Accessed' },
  { value: 'custom', label: 'Custom' },
];

interface Status {
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (response) => {
      if (response) {
        setSettings(response);
        document.documentElement.classList.toggle('dark', response.theme === 'dark');
      }
    });
  }, []);

  const toggleTheme = () => {
    if (!settings) return;
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...settings, theme: newTheme };
    setSettings(updated);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    chrome.runtime.sendMessage({
      action: 'SAVE_SETTINGS',
      settings: { theme: newTheme },
    });
  };

  const handleAction = async (action: string) => {
    setLoading(action);
    setStatus(null);

    return new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ action }, (response) => {
        setLoading(null);
        if (response) {
          if (response.success) {
            setStatus({ type: 'success', message: response.message });
          } else {
            setStatus({ type: 'error', message: response.message });
          }
        }
        setTimeout(() => resolve(), 2000);
      });
    });
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  if (!settings) {
    return (
      <div className="w-80 h-64 flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-80 overflow-hidden animate-fade-in" style={{ background: 'var(--bg-primary)' }}>
      <header className="relative overflow-hidden bg-gradient-brand px-4 py-3.5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner-glow">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-sm tracking-tight">Tablica</h1>
              <p className="text-white/60 text-[10px] font-medium tracking-wide uppercase">Tab Manager</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-white/15 active:bg-white/10 transition-all duration-200"
              title={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {settings.theme === 'dark' ? (
                <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={openOptions}
              className="p-2 rounded-lg hover:bg-white/15 active:bg-white/10 transition-all duration-200"
              title="Settings"
            >
              <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="p-3.5 space-y-2.5">
        <div className="glass-strong rounded-xl p-3">
          <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            Sort Mode
          </label>
          <div className="mt-1.5 relative">
            <select
              value={settings.sortBy}
              disabled
              className="w-full appearance-none rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-default"
              style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
            Change in <button onClick={openOptions} className="text-brand-500 hover:text-brand-600 font-medium transition-colors">Settings</button>
          </p>
        </div>

        <ActionButton
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
          }
          label="Sort Tabs"
          description="Arrange by selected mode"
          onClick={() => handleAction('SORT_TABS')}
          loading={loading === 'SORT_TABS'}
          variant="primary"
        />

        <ActionButton
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
            </svg>
          }
          label="Group by Domain"
          description="Create tab groups"
          onClick={() => handleAction('GROUP_TABS')}
          loading={loading === 'GROUP_TABS'}
          variant="secondary"
        />

        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
            label="Dedup"
            description="Remove duplicates"
            onClick={() => handleAction('REMOVE_DUPLICATES')}
            loading={loading === 'REMOVE_DUPLICATES'}
            variant="outline"
            compact
          />

          <ActionButton
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            }
            label="Undo"
            description="Restore order"
            onClick={() => handleAction('UNDO_SORT')}
            loading={loading === 'UNDO_SORT'}
            variant="outline"
            compact
          />
        </div>

        <div className="animate-slide-up">
          <StatusMessage status={status} />
        </div>
      </div>

      <footer
        className="px-4 py-2.5 border-t text-center"
        style={{
          background: 'var(--bg-tertiary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Open <button onClick={openOptions} className="text-brand-500 hover:text-brand-600 font-medium transition-colors">Settings</button> to customize
        </p>
      </footer>
    </div>
  );
}
