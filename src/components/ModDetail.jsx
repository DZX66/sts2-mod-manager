import React, { useState, useEffect, useRef } from 'react';
import { X, ToggleLeft, ToggleRight, Trash2, AlertTriangle, FileText, Box, Code, Languages, ExternalLink, Shield, Gamepad2, Palette, StickyNote } from 'lucide-react';
import { getUnsatisfiedDeps, checkDepSatisfied, checkMinGameVersion } from '../utils/deps';
import { useT } from '../i18n/I18nContext';

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isChinese(text) {
  if (!text) return false;
  return /[\u4e00-\u9fff]/.test(text);
}

function getModCategory(mod, allMods, t) {
  const isDepForOthers = allMods.some(m => m.id !== mod.id && m.dependencies && m.dependencies.some(d => d.id === mod.id));
  if (isDepForOthers) return { label: t('modCard.catFramework'), color: 'bg-indigo-50 text-indigo-600', icon: Shield };
  if (mod.affects_gameplay) return { label: t('modCard.catGameplay'), color: 'bg-amber-50 text-amber-700', icon: Gamepad2 };
  return { label: t('modCard.catResource'), color: 'bg-teal-50 text-teal-600', icon: Palette };
}

export default function ModDetail({ mod, allMods, onClose, onToggle, onUninstall, onSelectMod, onTranslationSaved, gameVersion }) {
  const { t } = useT();
  const missingDeps = getUnsatisfiedDeps(mod, allMods);
  const versionOk = checkMinGameVersion(mod, gameVersion);
  const versionIncompatible = versionOk === false;
  const dependents = allMods.filter(m => m.dependencies && m.dependencies.some(d => d.id === mod.id) && m.enabled);
  const category = getModCategory(mod, allMods, t);
  const CategoryIcon = category.icon;

  const [translatedDesc, setTranslatedDesc] = useState(null);
  const [translatedName, setTranslatedName] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(null);

  useEffect(() => {
    setTranslateError(null);
    if (window.api.loadTranslations) {
      window.api.loadTranslations().then(saved => {
        const savedT = saved[mod.id];
        if (savedT) {
          setTranslatedName(savedT.name || null);
          setTranslatedDesc(savedT.desc || null);
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
    <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-800">
        <div className="min-w-0 flex-1 mr-2">
          <h2 className="font-bold text-base truncate dark:text-gray-100">{translatedName || mod.name}</h2>
          {translatedName && <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{mod.name}</p>}
        </div>
        <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 transition-colors flex-shrink-0">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('modDetail.status')}</span>
          <button onClick={onToggle} className="flex items-center gap-2">
          {mod.enabled
              ? <><span className="text-sm text-emerald-600 font-medium">{t('modDetail.enabled')}</span><ToggleRight size={24} className="text-emerald-500" /></>
              : <><span className="text-sm text-gray-400 dark:text-gray-500 font-medium">{t('modDetail.disabled')}</span><ToggleLeft size={24} className="text-gray-300 dark:text-gray-600" /></>
            }
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${category.color}`}>
            <CategoryIcon size={13} /> {category.label}
          </span>
          {missingDeps.length > 0 && mod.enabled && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600">
              <AlertTriangle size={13} /> {t('modDetail.missingDeps')}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {[
            [t('modDetail.id'), mod.id],
            [t('modDetail.author'), mod.author || t('modDetail.unknown')],
            [t('modDetail.version'), mod.version || t('modDetail.unknown')],
            [t('modDetail.size'), formatSize(mod.size)],
            [t('modDetail.type'), mod.modType === 'steam_workshop' ? t('modDetail.typeWorkshop') : mod.isFolder ? t('modDetail.typeFolder') : t('modDetail.typeFile')],
            ...(mod.min_game_version ? [[t('modDetail.requiredGameVersion'), `≥ v${mod.min_game_version}`]] : []),
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
              <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{value}</span>
            </div>
          ))}
        </div>

        {versionIncompatible && mod.enabled && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950 rounded-lg">
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {t('modDetail.versionWarning', { required: mod.min_game_version, current: gameVersion })}
            </span>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-400 dark:text-gray-500">{t('modDetail.description')}</p>
            {hasEnglishContent && (
              <button onClick={handleTranslate} disabled={translating}
                className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 disabled:text-gray-300 transition-colors">
                <Languages size={12} />
                {translating ? t('modDetail.translating') : translatedDesc ? t('modDetail.retranslate') : t('modDetail.translate')}
              </button>
            )}
          </div>
          {translatedDesc ? (
            <>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{translatedDesc}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">{mod.description}</p>
            </>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{mod.description || t('modDetail.noDescription')}</p>
          )}
          {translateError && (
            <p className="mt-1 text-xs text-red-400">{t('modDetail.translateFailed', { error: translateError })}</p>
          )}
        </div>

        <ModNotesEditor modId={mod.id} t={t} />

        {mod.dependencies && mod.dependencies.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{t('modDetail.dependencies')}</p>
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
                  {isMissing && !depMod && <span className="text-[10px] ml-auto">{t('modDetail.notInstalled')}</span>}
                  {isMissing && depMod && result.reason === 'disabled' && <span className="text-[10px] ml-auto">{t('modDetail.notEnabled')}</span>}
                  {isMissing && depMod && result.reason === 'version_mismatch' && <span className="text-[10px] ml-auto text-amber-600">{t('modDetail.versionLow', { current: depMod.version, required: dep.min_version })}</span>}
                  {canJump && <ExternalLink size={12} className="flex-shrink-0 opacity-50" />}
                </div>
              );
            })}
          </div>
        )}

        {dependents.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">{t('modDetail.dependentWarning')}</p>
            {dependents.map(d => (
              <p key={d.id} className="text-xs text-amber-600 dark:text-amber-500">{d.name}</p>
            ))}
          </div>
        )}

        <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{t('modDetail.fileList')}</p>
            <div className="space-y-1">
              {(mod.files || []).map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 py-1">
                {f.endsWith('.dll') ? <Code size={12} /> :
                 f.endsWith('.json') ? <FileText size={12} /> :
                 <Box size={12} />}
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-50 dark:border-gray-800 space-y-2">
        <button onClick={onToggle}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
            mod.enabled
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}>
          {mod.enabled ? t('modDetail.disableMod') : t('modDetail.enableMod')}
        </button>
        <button onClick={mod.modType === 'steam_workshop' ? undefined : onUninstall}
          disabled={mod.modType === 'steam_workshop'}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            mod.modType === 'steam_workshop'
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900'
          }`}>
          <Trash2 size={14} /> {mod.modType === 'steam_workshop' ? t('modDetail.uninstallDisabledWorkshop') : t('modDetail.uninstallMod')}
        </button>
      </div>
    </div>
  );
}

function ModNotesEditor({ modId, t }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasNote, setHasNote] = useState(false);
  const saveTimerRef = useRef(null);

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
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('modDetail.modNotes')}</p>
          {saving && <span className="text-[10px] text-gray-300">{t('modDetail.notesSaving')}</span>}
        </div>
        {notes && (
          <button onClick={() => {
              if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
              setNotes('');
              saveNotes('');
            }}
            className="text-[11px] text-gray-400 hover:text-red-500 transition-colors">
            {t('modDetail.notesClear')}
          </button>
        )}
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder={t('modDetail.notesPlaceholder')}
        rows={3}
            className={`w-full text-xs border rounded-lg p-2 resize-none transition-colors focus:outline-none focus:ring-1 ${
              hasNote
                ? 'border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-gray-700 dark:text-gray-300 focus:ring-amber-300'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 focus:ring-gray-300'
            }`}
      />
    </div>
  );
}