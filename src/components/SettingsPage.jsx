import React, { useState, useEffect } from 'react';
import { Settings, Monitor, Sun, Moon, Globe, Gamepad2, Github, ExternalLink, Info, ChevronRight } from 'lucide-react';

export default function SettingsPage() {
  const [theme, setTheme] = useState(() => localStorage.getItem('sts2-theme') || 'system');
  const [locale, setLocale] = useState(() => localStorage.getItem('sts2-locale') || 'zh-CN');
  const [gamePath, setGamePath] = useState(null);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    window.api.init().then(info => {
      if (info.gamePath) setGamePath(info.gamePath);
    });
    window.api.getAppVersion().then(v => setAppVersion(v)).catch(() => setAppVersion('1.1.0'));
  }, []);

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
    setLocale(newLocale);
    localStorage.setItem('sts2-locale', newLocale);
  };

  const handleSelectGamePath = async () => {
    const info = await window.api.selectGamePath();
    if (info) setGamePath(info.gamePath);
  };

  const themeOptions = [
    { id: 'light', icon: Sun, label: '浅色' },
    { id: 'dark', icon: Moon, label: '深色' },
    { id: 'system', icon: Monitor, label: '跟随系统' },
  ];

  const localeOptions = [
    { id: 'zh-CN', label: '简体中文' },
    { id: 'en', label: 'English' },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center">
            <Settings size={20} />
          </div>
          <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">设置</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500">自定义应用外观与偏好</p>
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
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">外观主题</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">选择你偏好的显示主题</p>
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
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">语言</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">界面显示语言（部分内容需重启生效）</p>
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

        {/* Game Path */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              <Gamepad2 size={18} className="text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">游戏路径</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">Slay the Spire 2 的安装目录</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 truncate border border-gray-100 dark:border-gray-700">
              {gamePath || '未设置'}
            </div>
            <button onClick={handleSelectGamePath}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap">
              更改
            </button>
          </div>
        </div>

        {/* About */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
              <Info size={18} className="text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">关于</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">应用信息和相关链接</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-500 dark:text-gray-400">应用版本</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">v{appVersion}</span>
            </div>
            <button onClick={() => window.api.openUrl && window.api.openUrl('https://github.com/ImogeneOctaviap794/sts2-mod-manager')}
              className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group">
              <div className="flex items-center gap-2">
                <Github size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">GitHub</span>
              </div>
              <ExternalLink size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}