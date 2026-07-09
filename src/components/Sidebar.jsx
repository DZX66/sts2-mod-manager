import React from 'react';
import {
  Package, FileText, FolderOpen, Save, HardDrive, ExternalLink, Github, Settings, ArrowUpDown,
} from 'lucide-react';
import { useT } from '../i18n/I18nContext';

export default function Sidebar({ page, setPage, gamePath, onSelectGamePath, enabledCount, totalCount, gameVersion }) {
  const { t } = useT();

  const navItems = [
    { id: 'mods', icon: Package, label: t('nav.mods') },
    { id: 'loadorder', icon: ArrowUpDown, label: t('nav.loadOrder') },
    { id: 'saves', icon: HardDrive, label: t('nav.saves') },
    { id: 'logs', icon: FileText, label: t('nav.logs') },
    { id: 'settings', icon: Settings, label: t('nav.settings') },
  ];

  const quickLinks = [
    { id: 'workshop', icon: ExternalLink, label: t('nav.workshop'), action: () => window.api.openUrl('steam://openurl/https://steamcommunity.com/app/2868840/workshop/') },
    { id: 'nexus', icon: ExternalLink, label: t('nav.nexusMods'), action: () => window.api.openUrl('https://www.nexusmods.com/slaythespire2') },
    { id: 'modsDir', icon: FolderOpen, label: t('nav.modsFolder'), action: () => window.api.openModsDir() },
    { id: 'logsDir', icon: FileText, label: t('nav.logsFolder'), action: () => window.api.openLogsDir() },
    { id: 'savesDir', icon: Save, label: t('nav.savesFolder'), action: () => window.api.openSavesDir() },
  ];
  return (
    <div className="w-56 bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800 flex flex-col">
      {/* Nav */}
      <nav className="flex-1 px-3 pt-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">{t('nav.nav')}</p>
        {navItems.map(item => (
          <button key={item.id}
            onClick={() => setPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
              page === item.id
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}>
            <item.icon size={18} />
            {item.label}
          </button>
        ))}

        <div className="h-px bg-gray-100 my-4" />

        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">{t('nav.quickAccess')}</p>
        {quickLinks.map(item => (
          <button key={item.id}
            onClick={item.action}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors mb-0.5">
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Game path */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase">{t('nav.gamePath')}</p>
            <button onClick={onSelectGamePath}
              className="text-[10px] text-blue-500 hover:text-blue-700 font-medium transition-colors"
              title={t('nav.change')}>
              {t('nav.change')}
            </button>
          </div>
          {gamePath ? (
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate cursor-pointer hover:text-blue-600 transition-colors"
              title={gamePath} onClick={onSelectGamePath}>{gamePath}</p>
          ) : (
            <button onClick={onSelectGamePath}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              {t('nav.clickSelectGamePath')}
            </button>
          )}
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{t('nav.modsEnabled', { enabled: enabledCount, total: totalCount })}</span>
          </div>
          {gameVersion && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 dark:text-gray-500">{t('nav.gameVersion')}: <span className="text-gray-600 dark:text-gray-300 font-medium">{gameVersion}</span></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
