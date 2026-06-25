import React from 'react';
import { ToggleLeft, ToggleRight, AlertTriangle, Blocks, Gamepad2, Palette, Shield, Cloud } from 'lucide-react';
import { getUnsatisfiedDeps, checkMinGameVersion } from '../utils/deps';
import { useT } from '../i18n/I18nContext';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getMissingDeps(mod, allMods) {
  return getUnsatisfiedDeps(mod, allMods).map(r => ({
    id: r.id,
    reason: r.reason,
    dep: r.dep,
  }));
}

function getModCategory(mod, allMods, t) {
  const isDepForOthers = allMods.some(m => m.id !== mod.id && m.dependencies && m.dependencies.some(d => d.id === mod.id));
  if (isDepForOthers) return { type: 'framework', label: t('modCard.catFramework'), color: 'bg-indigo-50 text-indigo-600', icon: Shield };
  if (mod.affects_gameplay) return { type: 'gameplay', label: t('modCard.catGameplay'), color: 'bg-amber-50 text-amber-700', icon: Gamepad2 };
  return { type: 'resource', label: t('modCard.catResource'), color: 'bg-teal-50 text-teal-600', icon: Palette };
}

export default function ModCard({ mod, allMods, translations, onToggle, onClick, selected, gameVersion }) {
  const { t } = useT();
  const missingDeps = getMissingDeps(mod, allMods);
  const versionOk = checkMinGameVersion(mod, gameVersion);
  const versionIncompatible = versionOk === false;
  const category = getModCategory(mod, allMods, t);
  const CategoryIcon = category.icon;
  const modT = translations && translations[mod.id];

  return (
    <div
      onClick={onClick}
      className={`relative bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
        selected ? 'border-gray-900 dark:border-gray-500 shadow-md' : missingDeps.length > 0 ? 'border-red-200 dark:border-red-700' : versionIncompatible ? 'border-amber-200 dark:border-amber-700' : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
      } ${!mod.enabled ? 'opacity-60' : ''}`}
    >
      {missingDeps.length > 0 && mod.enabled && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 -mx-4 -mt-4 mb-3 bg-red-50 dark:bg-red-950 rounded-t-xl border-b border-red-100 dark:border-red-800">
          <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
          <span className="text-[11px] text-red-600 dark:text-red-400 font-medium truncate">
            {t('modCard.missingDeps', { deps: missingDeps.map(d => d.id).join(', ') })}
          </span>
        </div>
      )}

      {versionIncompatible && !missingDeps.length && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 -mx-4 -mt-4 mb-3 bg-amber-50 dark:bg-amber-950 rounded-t-xl border-b border-amber-100 dark:border-amber-800">
          <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium truncate">
            {t('modCard.versionIncompatible', { required: mod.min_game_version, current: gameVersion })}
          </span>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{(modT && modT.name) || mod.name}</h3>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {mod.author} · v{mod.version}
            {mod.modType === 'steam_workshop' && mod.folderName && (
              <span className="ml-1.5 font-mono opacity-60">· #{mod.folderName}</span>
            )}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="flex-shrink-0 ml-2"
          title={mod.enabled ? t('modCard.clickDisable') : t('modCard.clickEnable')}
        >
          {mod.enabled
            ? <ToggleRight size={28} className="text-emerald-500" />
            : <ToggleLeft size={28} className="text-gray-300" />
          }
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 leading-relaxed">
        {(modT && modT.desc) || mod.description || t('modCard.noDescription')}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${category.color}`}>
          <CategoryIcon size={11} /> {category.label}
        </span>
        {category.type === 'framework' && mod.affects_gameplay && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700">
            <Gamepad2 size={11} /> {t('modCard.catGameplayShort')}
          </span>
        )}
        {mod.has_dll && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-600">DLL</span>
        )}
        {mod.has_pck && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-600">PCK</span>
        )}
        {mod.modType === 'steam_workshop' && (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-cyan-50 text-cyan-600">
            <Cloud size={11} /> {t('modCard.catWorkshop')}
          </span>
        )}
        {mod.dependencies && mod.dependencies.length > 0 && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
            missingDeps.length > 0 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
          }`}>
            <Blocks size={11} className="mr-0.5" /> {t('modCard.depsCount', { count: mod.dependencies.length })}
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-300 dark:text-gray-600">{formatSize(mod.size)}</span>
      </div>
    </div>
  );
}