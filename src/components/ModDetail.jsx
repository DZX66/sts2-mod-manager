import React, { useState, useEffect, useRef } from 'react';
import { X, ToggleLeft, ToggleRight, Trash2, AlertTriangle, FileText, Box, Code, Languages, ExternalLink, Shield, Gamepad2, Palette, StickyNote } from 'lucide-react';
import { getUnsatisfiedDeps, checkDepSatisfied, checkMinGameVersion } from '../utils/deps';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isChinese(text) {
  if (!text) return false;
  return /[\u4e00-\u9fff]/.test(text);
}

function getModCategory(mod, allMods) {
  const isDepForOthers = allMods.some(m => m.id !== mod.id && m.dependencies && m.dependencies.some(d => d.id === mod.id));
  if (isDepForOthers) return { label: '框架前置', color: 'bg-indigo-50 text-indigo-600', icon: Shield };
  if (mod.affects_gameplay) return { label: '玩法改动', color: 'bg-amber-50 text-amber-700', icon: Gamepad2 };
  return { label: '资源类', color: 'bg-teal-50 text-teal-600', icon: Palette };
}

export default function ModDetail({ mod, allMods, onClose, onToggle, onUninstall, onSelectMod, onTranslationSaved, gameVersion }) {
  const missingDeps = getUnsatisfiedDeps(mod, allMods);
  const versionOk = checkMinGameVersion(mod, gameVersion);
  const versionIncompatible = versionOk === false;
  const dependents = allMods.filter(m => m.dependencies && m.dependencies.some(d => d.id === mod.id) && m.enabled);
  const category = getModCategory(mod, allMods);
  const CategoryIcon = category.icon;

  const [translatedDesc, setTranslatedDesc] = useState(null);
  const [translatedName, setTranslatedName] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(null);

  // Load saved translations when mod changes
  useEffect(() => {
    setTranslateError(null);
    if (window.api.loadTranslations) {
      window.api.loadTranslations().then(saved => {
        const t = saved[mod.id];
        if (t) {
          setTranslatedName(t.name || null);
          setTranslatedDesc(t.desc || null);
        } else {
          setTranslatedName(null);
          setTranslatedDesc(null);
        }
      }).catch(() => {
        setTranslatedName(null);
        setTranslatedDesc(null);
      });
    } else {
      setTranslatedName(null);
      setTranslatedDesc(null);
    }
  }, [mod.id, mod.instanceKey]);

  const handleTranslate = async () => {
    setTranslating(true);
    setTranslateError(null);
    try {
      const descText = mod.description || '';
      const nameText = mod.name || '';
      const results = await Promise.all([
        !isChinese(descText) && descText ? window.api.translateText(descText) : null,
        !isChinese(nameText) && nameText ? window.api.translateText(nameText) : null,
      ]);
      let newName = translatedName, newDesc = translatedDesc;
      if (results[0]?.success) { newDesc = results[0].translated; setTranslatedDesc(newDesc); }
      if (results[1]?.success) { newName = results[1].translated; setTranslatedName(newName); }
      if (results[0] && !results[0].success) setTranslateError(results[0].error);
      // Persist
      if (window.api.saveTranslations && (newName || newDesc)) {
        const saved = await window.api.loadTranslations();
        saved[mod.id] = { name: newName, desc: newDesc };
        await window.api.saveTranslations(saved);
        if (onTranslationSaved) onTranslationSaved();
      }
    } catch (e) {
      setTranslateError(e.message);
    }
    setTranslating(false);
  };

  const hasEnglishContent = !isChinese(mod.description) || !isChinese(mod.name);

  return (
    <div className="w-80 bg-white border-l border-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="min-w-0 flex-1 mr-2">
          <h2 className="font-bold text-base truncate">{translatedName || mod.name}</h2>
          {translatedName && <p className="text-[11px] text-gray-400 truncate">{mod.name}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">状态</span>
          <button onClick={onToggle} className="flex items-center gap-2">
            {mod.enabled
              ? <><span className="text-sm text-emerald-600 font-medium">已启用</span><ToggleRight size={24} className="text-emerald-500" /></>
              : <><span className="text-sm text-gray-400 font-medium">已禁用</span><ToggleLeft size={24} className="text-gray-300" /></>
            }
          </button>
        </div>

        {/* Category badge */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${category.color}`}>
            <CategoryIcon size={13} /> {category.label}
          </span>
          {missingDeps.length > 0 && mod.enabled && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600">
              <AlertTriangle size={13} /> 缺失依赖
            </span>
          )}
        </div>

        {/* Info rows */}
        <div className="space-y-3">
          {[
            ['ID', mod.id],
            ['作者', mod.author || '未知'],
            ['版本', mod.version || '未知'],
            ['大小', formatSize(mod.size)],
            ['类型', mod.isFolder ? '文件夹 MOD' : '独立文件 MOD'],
            ...(mod.min_game_version ? [['所需游戏版本', `≥ v${mod.min_game_version}`]] : []),
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{label}</span>
              <span className="text-xs text-gray-700 font-medium">{value}</span>
            </div>
          ))}
        </div>

        {/* Version incompatibility warning */}
        {versionIncompatible && mod.enabled && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            <span className="text-xs text-amber-700">
              此 MOD 需要游戏 v{mod.min_game_version} 以上版本，当前游戏版本为 {gameVersion}，可能无法正常工作
            </span>
          </div>
        )}

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-400">描述</p>
            {hasEnglishContent && (
              <button onClick={handleTranslate} disabled={translating}
                className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 disabled:text-gray-300 transition-colors">
                <Languages size={12} />
                {translating ? '翻译中...' : translatedDesc ? '重新翻译' : '翻译'}
              </button>
            )}
          </div>
          {translatedDesc ? (
            <>
              <p className="text-sm text-gray-700 leading-relaxed">{translatedDesc}</p>
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{mod.description}</p>
            </>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed">{mod.description || '暂无描述'}</p>
          )}
          {translateError && (
            <p className="mt-1 text-xs text-red-400">翻译失败: {translateError}</p>
          )}
        </div>

        {/* Mod Notes */}
        <ModNotesEditor modId={mod.id} />

        {/* Dependencies */}
        {mod.dependencies && mod.dependencies.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">依赖项</p>
            {mod.dependencies.map(dep => {
              const result = checkDepSatisfied(dep, allMods);
              const isMissing = !result.satisfied;
              const depMod = allMods.find(m => m.id === dep.id);
              const canJump = depMod && onSelectMod;
              return (
                <div key={dep.id}
                  onClick={canJump ? () => onSelectMod(depMod) : undefined}
                  className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-sm mb-1 ${
                    isMissing ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                  } ${canJump ? 'cursor-pointer hover:ring-1 hover:ring-current/20 transition-all' : ''}`}>
                  {isMissing ? <AlertTriangle size={14} /> : <Box size={14} />}
                  <span className="flex-1 truncate">{depMod ? depMod.name : dep.id}</span>
                  {dep.min_version && <span className="text-[10px] opacity-60">≥ {dep.min_version}</span>}
                  {isMissing && !depMod && <span className="text-[10px] ml-auto">未安装</span>}
                  {isMissing && depMod && result.reason === 'disabled' && <span className="text-[10px] ml-auto">未启用</span>}
                  {isMissing && depMod && result.reason === 'version_mismatch' && <span className="text-[10px] ml-auto text-amber-600">版本过低 ({depMod.version} {'<'}{dep.min_version})</span>}
                  {canJump && <ExternalLink size={12} className="flex-shrink-0 opacity-50" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Dependents warning */}
        {dependents.length > 0 && (
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-xs text-amber-700 font-medium mb-1">⚠ 以下 MOD 依赖此 MOD</p>
            {dependents.map(d => (
              <p key={d.id} className="text-xs text-amber-600">{d.name}</p>
            ))}
          </div>
        )}

        {/* Files */}
        <div>
          <p className="text-xs text-gray-400 mb-2">文件列表</p>
          <div className="space-y-1">
            {(mod.files || []).map(f => (
              <div key={f} className="flex items-center gap-2 text-xs text-gray-500 py-1">
                {f.endsWith('.dll') ? <Code size={12} /> :
                 f.endsWith('.json') ? <FileText size={12} /> :
                 <Box size={12} />}
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-gray-50 space-y-2">
        <button onClick={onToggle}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
            mod.enabled
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}>
          {mod.enabled ? '禁用 MOD' : '启用 MOD'}
        </button>
        <button onClick={onUninstall}
          className="w-full py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
          <Trash2 size={14} /> 卸载 MOD
        </button>
      </div>
    </div>
  );
}

function ModNotesEditor({ modId }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasNote, setHasNote] = useState(false);
  const saveTimerRef = useRef(null);

  // Load notes when mod changes
  useEffect(() => {
    if (window.api.loadModNotes) {
      window.api.loadModNotes().then(allNotes => {
        const savedNote = allNotes[modId];
        if (savedNote) {
          setNotes(savedNote);
          setHasNote(true);
        } else {
          setNotes('');
          setHasNote(false);
        }
      }).catch(() => {
        setNotes('');
        setHasNote(false);
      });
    }
  }, [modId]);

  const handleChange = (e) => {
    const value = e.target.value;
    setNotes(value);
    // Auto-save with debounce
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveNotes(value);
    }, 600);
  };

  const saveNotes = async (text) => {
    if (!window.api.saveModNotes) return;
    setSaving(true);
    try {
      const allNotes = await window.api.loadModNotes();
      if (text.trim()) {
        allNotes[modId] = text;
        setHasNote(true);
      } else {
        delete allNotes[modId];
        setHasNote(false);
      }
      await window.api.saveModNotes(allNotes);
    } catch (e) {
      console.error('Failed to save notes:', e);
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <StickyNote size={13} className="text-gray-400" />
          <p className="text-xs text-gray-400">备注</p>
          {saving && <span className="text-[10px] text-gray-300">保存中...</span>}
        </div>
        {notes && (
          <button onClick={() => {
              if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
              setNotes('');
              saveNotes('');
            }}
            className="text-[11px] text-gray-400 hover:text-red-500 transition-colors">
            清除
          </button>
        )}
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder="添加备注..."
        rows={3}
        className={`w-full text-xs border rounded-lg p-2 resize-none transition-colors focus:outline-none focus:ring-1 ${
          hasNote
            ? 'border-amber-200 bg-amber-50/50 text-gray-700 focus:ring-amber-300'
            : 'border-gray-200 bg-gray-50 text-gray-500 focus:ring-gray-300'
        }`}
      />
    </div>
  );
}
