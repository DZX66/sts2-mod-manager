import React from 'react';
import { ToggleLeft, ToggleRight, AlertTriangle, GripVertical, Blocks, Gamepad2, Palette, Shield, Cloud } from 'lucide-react';
import { getUnsatisfiedDeps, checkMinGameVersion } from '../utils/deps';
import { useT } from '../i18n/I18nContext';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getMissingDeps(mod, allMods) {
  return getUnsatisfiedDeps(mod, allMods).map(r => r.id);
}

function getModCategory(mod, allMods, t) {
  const isDepForOthers = allMods.some(m => m.id !== mod.id && m.dependencies && m.dependencies.some(d => d.id === mod.id));
  if (isDepForOthers) return { label: t('modCard.catFrameworkShort'), color: 'bg-indigo-50 text-indigo-600' };
  if (mod.affects_gameplay) return { label: t('modCard.catGameplayShort'), color: 'bg-amber-50 text-amber-700' };
  return { label: t('modCard.catResourceShort'), color: 'bg-teal-50 text-teal-600' };
}

export default function ModListItem({ mod, allMods, translations, selected, multiSelected, onToggle, onClick, onCheckToggle, draggable, gameVersion }) {
  const { t } = useT();
  const missingDeps = getMissingDeps(mod, allMods);
  const versionOk = checkMinGameVersion(mod, gameVersion);
  const versionIncompatible = versionOk === false;
  const category = getModCategory(mod, allMods, t);
  const modT = translations && translations[mod.id];

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-gray-50 dark:border-gray-800 transition-colors group ${
        selected ? 'bg-blue-50 dark:bg-blue-950 border-l-2 border-l-blue-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-l-2 border-l-transparent'
      } ${!mod.enabled ? 'opacity-50' : ''}`}
    >
      <input
        type="checkbox"
        checked={multiSelected}
        onChange={(e) => { e.stopPropagation(); onCheckToggle(); }}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-400 flex-shrink-0 cursor-pointer"
      />

      {draggable && (
        <GripVertical size={14} className="text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate dark:text-gray-100">{(modT && modT.name) || mod.name}</span>
          {missingDeps.length > 0 && mod.enabled && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium flex-shrink-0">
              <AlertTriangle size={11} /> {t('modCard.catFrameworkShort')}
            </span>
          )}
          {versionIncompatible && mod.enabled && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-medium flex-shrink-0">
              <AlertTriangle size={11} /> {t('modCard.catFrameworkShort')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{mod.author || t('modDetail.unknown')}</span>
          <span className="text-[11px] text-gray-300 dark:text-gray-600">v{mod.version}</span>
          {missingDeps.length > 0 && mod.enabled && (
            <span className="text-[10px] text-red-400 truncate">{t('modCard.catFrameworkShort')}: {missingDeps.join(', ')}</span>
          )}
          {versionIncompatible && mod.enabled && (
            <span className="text-[10px] text-amber-500 truncate">{t('modCard.versionIncompatible', { required: mod.min_game_version, current: gameVersion })}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${category.color}`}>{category.label}</span>
        {mod.has_dll && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-500">DLL</span>
        )}
        {mod.has_pck && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-500">PCK</span>
        )}
        {mod.modType === 'steam_workshop' && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-50 text-cyan-500 flex items-center gap-0.5">
            <Cloud size={10} /> {t('modCard.catWorkshop')}
          </span>
        )}
        {mod.dependencies && mod.dependencies.length > 0 && (
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${missingDeps.length > 0 ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}>
            {mod.dependencies.length}{t('modCard.catFrameworkShort')}
          </span>
        )}
        <span className="text-[10px] text-gray-300 dark:text-gray-600 w-12 text-right">{formatSize(mod.size)}</span>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="flex-shrink-0"
        title={mod.enabled ? t('modCard.clickDisable') : t('modCard.clickEnable')}
      >
        {mod.enabled
          ? <ToggleRight size={24} className="text-emerald-500" />
          : <ToggleLeft size={24} className="text-gray-300" />
        }
      </button>
    </div>
  );
}