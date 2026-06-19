import React, { useState, useEffect } from 'react';
import { Settings, Monitor, Sun, Moon, Globe, Gamepad2, Github, ExternalLink, Info, ChevronRight, Cpu, Cloud } from 'lucide-react';
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

  useEffect(() => {
    (async () => {
      // 必须先等 init 完成，确保 game_path 已设置
      const info = await window.api.init();
      if (info.gamePath) setGamePath(info.gamePath);
      
      const v = await window.api.getAppVersion().catch(() => '1.1.0');
      setAppVersion(v);
      
      const cfg = await window.api.getConfig().catch(() => ({}));
      if (cfg.smartInstall !== undefined) {
        setSmartInstall(cfg.smartInstall);
      }
      
      // init 完成后才加载 Steam 用户
      await loadSteamUsers();
    })();
  }, []);

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