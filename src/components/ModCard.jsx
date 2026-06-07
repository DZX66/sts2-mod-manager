import React from 'react';
import { ToggleLeft, ToggleRight, AlertTriangle, Blocks, Gamepad2, Palette, Shield } from 'lucide-react';
import { getUnsatisfiedDeps, checkMinGameVersion } from '../utils/deps';

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

function getModCategory(mod, allMods) {
  const isDepForOthers = allMods.some(m => m.id !== mod.id && m.dependencies && m.dependencies.some(d => d.id === mod.id));
  if (isDepForOthers) return { label: '框架前置', color: 'bg-indigo-50 text-indigo-600', icon: Shield };
  if (mod.affects_gameplay) return { label: '玩法改动', color: 'bg-amber-50 text-amber-700', icon: Gamepad2 };
  return { label: '资源类', color: 'bg-teal-50 text-teal-600', icon: Palette };
}

export default function ModCard({ mod, allMods, translations, onToggle, onClick, selected, gameVersion }) {
  const missingDeps = getMissingDeps(mod, allMods);
  const versionOk = checkMinGameVersion(mod, gameVersion);
  const versionIncompatible = versionOk === false;
  const category = getModCategory(mod, allMods);
  const CategoryIcon = category.icon;
  const t = translations && translations[mod.id];

  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
        selected ? 'border-gray-900 shadow-md' : missingDeps.length > 0 ? 'border-red-200' : versionIncompatible ? 'border-amber-200' : 'border-gray-100 hover:border-gray-200'
      } ${!mod.enabled ? 'opacity-60' : ''}`}
    >
      {/* Missing deps banner */}
      {missingDeps.length > 0 && mod.enabled && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 -mx-4 -mt-4 mb-3 bg-red-50 rounded-t-xl border-b border-red-100">
          <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
          <span className="text-[11px] text-red-600 font-medium truncate">
            缺失依赖，无法正常工作：{missingDeps.map(d => d.id).join(', ')}
          </span>
        </div>
      )}

      {/* Version incompatibility banner */}
      {versionIncompatible && !missingDeps.length && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 -mx-4 -mt-4 mb-3 bg-amber-50 rounded-t-xl border-b border-amber-100">
          <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
          <span className="text-[11px] text-amber-700 font-medium truncate">
            需要游戏 v{mod.min_game_version} 以上版本（当前 {gameVersion}）
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{(t && t.name) || mod.name}</h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {mod.author} · v{mod.version}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="flex-shrink-0 ml-2"
          title={mod.enabled ? '点击禁用' : '点击启用'}
        >
          {mod.enabled
            ? <ToggleRight size={28} className="text-emerald-500" />
            : <ToggleLeft size={28} className="text-gray-300" />
          }
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
        {(t && t.desc) || mod.description || '暂无描述'}
      </p>

      {/* Tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${category.color}`}>
          <CategoryIcon size={11} /> {category.label}
        </span>
        {!mod.enabled && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-500">已禁用</span>
        )}
        {mod.has_dll && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-600">DLL</span>
        )}
        {mod.has_pck && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-600">PCK</span>
        )}
        {mod.dependencies && mod.dependencies.length > 0 && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
            missingDeps.length > 0 ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
          }`}>
            <Blocks size={11} className="mr-0.5" /> {mod.dependencies.length} 依赖
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-300">{formatSize(mod.size)}</span>
      </div>
    </div>
  );
}
