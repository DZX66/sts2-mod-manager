import React, { useState, useEffect } from 'react';
import { Settings, Monitor, Sun, Moon, Globe, Gamepad2, Github, ExternalLink, Info, ChevronRight, Cpu, Cloud, FolderOpen, Download, Tag as TagIcon, Palette } from 'lucide-react';
import { useT } from '../i18n/I18nContext';

export default function SettingsPage() {
  const { t, locale, changeLocale } = useT();
  const [theme, setTheme] = useState(() => localStorage.getItem('sts2-theme') || 'system');
  const [gamePath, setGamePath] = useState(null);
  const [appVersion, setAppVersion] = useState('');
  const [smartInstall, setSmartInstall] = useState(true);
  const [steamUsers, setSteamUsers] = useState([]);
  const [selectedSteamId, setSelectedSteamId] = useState(null);
  const [workshopPath, setWorkshopPath] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null); // null | 'checking' | 'up-to-date' | { version: string, url: string } | 'failed'
  
  // Tag colors
  const [tagColorData, setTagColorData] = useState({ modTags: {}, tagColors: {} });
  const [allTags, setAllTags] = useState([]);

  const loadTagColorData = async () => {
    try {
      const data = await window.api.tagsLoad();
      setTagColorData(data);
      const tags = data.modTags
        ? [...new Set(Object.values(data.modTags).flat())].sort((a, b) => a.localeCompare(b))
        : [];
      setAllTags(tags);
    } catch (e) {
      console.error('Failed to load tag colors:', e);
    }
  };

  useEffect(() => {
    (async () => {
      // 必须先等 init 完成，确保 game_path 已设置
      const info = await window.api.init();
      if (info.gamePath) setGamePath(info.gamePath);
      
      const v = await window.api.getAppVersion().catch(() => '1.0.0');
      setAppVersion(v);
      
      // 从 init 结果中直接获取 smartInstall 状态
      if (info.smartInstall !== undefined) {
        setSmartInstall(info.smartInstall);
      }
      
      // 从 init 结果中直接获取 Steam 用户信息
      if (info.steamUsers) {
        setSteamUsers(info.steamUsers);
      }
      if (info.selectedSteamId) {
        setSelectedSteamId(info.selectedSteamId);
      }
      if (info.workshopPath) {
        setWorkshopPath(info.workshopPath);
      }
      
      // Load tag colors
      await loadTagColorData();
    })();
  }, []);

  // Auto-check for updates on mount
  useEffect(() => {
    if (appVersion) {
      handleCheckUpdate();
    }
  }, [appVersion]);

  const loadSteamUsers = async () => {
    try {
      const result = await window.api.getSteamUsers();
      setSteamUsers(result.users || []);
      setSelectedSteamId(result.selected_steam_id || null);
      setWorkshopPath(result.workshop_path || null);
    } catch (e) {
      console.error('Failed to load steam users:', e);
    }
  };

  const handleSteamUserChange = async (steamId) => {
    setSelectedSteamId(steamId);
    try {
      await window.api.selectSteamUser(steamId);
    } catch (e) {
      console.error('Failed to save steam user:', e);
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('sts2-theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  };

  const handleLocaleChange = (newLocale) => {
    changeLocale(newLocale);
  };

  const handleSelectGamePath = async () => {
    const info = await window.api.selectGamePath();
    if (info) setGamePath(info.gamePath);
  };

  const handleSmartInstallChange = async (value) => {
    setSmartInstall(value);
    try {
      const cfg = await window.api.getConfig();
      cfg.smartInstall = value;
      await window.api.setConfig(cfg);
    } catch (e) {
      console.error('Failed to save config:', e);
    }
  };

  const handleTagColorChange = async (tagName, newColor) => {
    const newTagColors = { ...(tagColorData.tagColors || {}) };
    newTagColors[tagName] = newColor;
    const newData = { ...tagColorData, tagColors: newTagColors };
    setTagColorData(newData);
    try {
      await window.api.tagsSave(newData);
    } catch (e) {
      console.error('Failed to save tag color:', e);
    }
  };

  const PRESET_COLORS_SETTINGS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
    '#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#f43f5e',
    '#ff6b6b', '#ffa07a', '#ffd700', '#90ee90', '#87ceeb',
    '#b0a0ff', '#ffb6c1', '#98d8c8', '#dda0dd', '#c0c0c0',
  ];

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    try {
      const res = await fetch('https://api.github.com/repos/DZX66/sts2-mod-manager/releases/latest');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const latestVersion = data.tag_name.replace(/^v/, '');
      const currentVersion = appVersion.replace(/^v/, '');
      if (latestVersion === currentVersion) {
        setUpdateStatus('up-to-date');
      } else {
        setUpdateStatus({ version: latestVersion, url: data.html_url });
      }
    } catch (e) {
      console.error('Check update failed:', e);
      setUpdateStatus('failed');
    }
  };

  const themeOptions = [
    { id: 'light', icon: Sun, label: t('settings.themeLight') },
    { id: 'dark', icon: Moon, label: t('settings.themeDark') },
    { id: 'system', icon: Monitor, label: t('settings.themeSystem') },
  ];

  const localeOptions = [
    { id: 'zh-CN', label: t('settings.localeZhCN') },
    { id: 'en', label: t('settings.localeEn') },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center">
            <Settings size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('settings.title')}</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500">{t('settings.subtitle')}</p>
          </div>
        </div>

        {/* Theme */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              {theme === 'dark' ? <Moon size={18} className="text-gray-600" /> :
               theme === 'light' ? <Sun size={18} className="text-gray-600" /> :
               <Monitor size={18} className="text-gray-600" />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.appearance')}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.appearanceDesc')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {themeOptions.map(opt => (
              <button key={opt.id}
                onClick={() => handleThemeChange(opt.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 ${
                  theme === opt.id
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}>
                <opt.icon size={16} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              <Globe size={18} className="text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.language')}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.languageDesc')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {localeOptions.map(opt => (
              <button key={opt.id}
                onClick={() => handleLocaleChange(opt.id)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 ${
                  locale === opt.id
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Smart Install */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              <Cpu size={18} className="text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.smartInstall')}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.smartInstallDesc')}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('settings.smartInstallLabel')}</span>
            <button
              onClick={() => handleSmartInstallChange(!smartInstall)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                smartInstall ? 'bg-gray-900' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  smartInstall ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Game Path */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              <Gamepad2 size={18} className="text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.gamePath')}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.gamePathDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 truncate border border-gray-100 dark:border-gray-700">
              {gamePath || t('settings.notSet')}
            </div>
            <button onClick={handleSelectGamePath}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap">
              {t('settings.change')}
            </button>
          </div>
        </div>

        {/* Steam Workshop */}
        {workshopPath && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                <Cloud size={18} className="text-gray-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.steamWorkshop')}</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.steamWorkshopDesc')}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('settings.steamUser')}</span>
                <select
                  value={selectedSteamId || ''}
                  onChange={(e) => handleSteamUserChange(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  <option value="">{t('settings.selectSteamUser')}</option>
                  {steamUsers.map(u => (
                    <option key={u.steam_id} value={u.steam_id}>{u.steam_id}</option>
                  ))}
                </select>
              </div>
              {workshopPath && (
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{t('settings.workshopPath')}</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[200px]">{workshopPath}</span>
                    <button onClick={() => window.api.openPath(workshopPath)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0">
                      <FolderOpen size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tag Colors */}
        {allTags.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                <Palette size={18} className="text-gray-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.tagColors')}</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.tagColorsDesc')}</p>
              </div>
            </div>
            <div className="space-y-2">
              {allTags.map(tagName => {
                const color = tagColorData.tagColors?.[tagName] || '#6366f1';
                return (
                  <div key={tagName} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TagIcon size={14} style={{ color }} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tagName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-0.5">
                        {PRESET_COLORS_SETTINGS.slice(0, 6).map(c => (
                          <button
                            key={c}
                            onClick={() => handleTagColorChange(tagName, c)}
                            className={`w-4 h-4 rounded-full border transition-transform hover:scale-125 ${
                              color === c ? 'border-gray-900 scale-110 ring-1 ring-gray-400' : 'border-gray-200'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <label className="relative cursor-pointer ml-1">
                        <div
                          className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                          style={{ backgroundColor: color, opacity: 0.3 }}
                        >
                          <Palette size={10} className="text-gray-500" />
                        </div>
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => handleTagColorChange(tagName, e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-5 h-5"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* About */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              <Info size={18} className="text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('settings.about')}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('settings.aboutDesc')}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('settings.appVersion')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">v{appVersion}</span>
            </div>
            <button onClick={handleCheckUpdate}
              disabled={updateStatus === 'checking'}
              className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group disabled:opacity-50">
              <div className="flex items-center gap-2">
                <Download size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {updateStatus === 'checking' ? t('settings.checkingUpdate') :
                   updateStatus === 'up-to-date' ? t('settings.upToDate') :
                   updateStatus && typeof updateStatus === 'object' ? t('settings.updateAvailable', { version: updateStatus.version }) :
                   updateStatus === 'failed' ? t('settings.checkUpdateFailed') :
                   t('settings.checkUpdate')}
                </span>
              </div>
              {updateStatus && typeof updateStatus === 'object' && updateStatus.url ? (
                <button onClick={(e) => { e.stopPropagation(); window.api.openUrl && window.api.openUrl(updateStatus.url); }}
                  className="px-2 py-1 text-[11px] font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800">
                  {t('settings.downloadPage')}
                </button>
              ) : (
                <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
              )}
            </button>
            <button onClick={() => window.api.openUrl && window.api.openUrl('https://github.com/ImogeneOctaviap794/sts2-mod-manager')}
              className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group">
              <div className="flex items-center gap-2">
                <Github size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('settings.github')}</span>
              </div>
              <ExternalLink size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}