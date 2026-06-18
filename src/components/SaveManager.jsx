import React, { useState, useEffect } from 'react';
import { Download, Upload, RefreshCw, Trash2, HardDrive, Gamepad2, FolderOpen, Clock, Trophy, Sword, Layers, CreditCard } from 'lucide-react';
import { useT } from '../i18n/I18nContext';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(iso, locale) {
  if (!iso) return '—';
  const d = new Date(iso);
  try {
    return d.toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}

function formatPlaytime(seconds, t) {
  if (!seconds) return t('saveManager.zeroMinutes');
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return t('saveManager.hoursMinutes', { h, m });
  return t('saveManager.minutes', { m });
}

function getCharacterName(charId, t) {
  // Map character IDs to translation keys
  const key = `${charId.toLowerCase().replace(/\s+/g, '_')}`;
  const translated = t(key);
  // If translation key not found, return original name
  return translated !== key ? translated : charId;
}

function SaveSummary({ summary, accent, locale, t }) {
  if (!summary) return null;
  const accentColor = accent === 'purple' ? 'purple' : 'emerald';
  return (
    <div className="space-y-3 mb-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-0.5">
            <Clock size={11} /><span className="text-[10px] uppercase font-semibold">{t('saveManager.playtime')}</span>
          </div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{formatPlaytime(summary.totalPlaytime, t)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-0.5">
            <Trophy size={11} /><span className="text-[10px] uppercase font-semibold">{t('saveManager.score')}</span>
          </div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{summary.currentScore.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-0.5">
            <Layers size={11} /><span className="text-[10px] uppercase font-semibold">{t('saveManager.floors')}</span>
          </div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{summary.floorsClimbed}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 mb-0.5">
            <CreditCard size={11} /><span className="text-[10px] uppercase font-semibold">{t('saveManager.discovery')}</span>
          </div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('saveManager.cards', { count: summary.discoveredCards })} / {t('saveManager.relics', { count: summary.discoveredRelics })}</p>
        </div>
      </div>

      {summary.characters.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">{t('saveManager.charStats')}</p>
          <div className="space-y-1">
            {summary.characters.map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs px-2 py-1 bg-gray-50 rounded-md">
                <span className="font-medium text-gray-700">{getCharacterName(c.id, t) || c.name}</span>
                <span className="text-gray-500">
                  <span className={`text-${accentColor}-600 font-medium`}>{t('saveManager.wins', { count: c.wins })}</span>
                  <span className="mx-1">/</span>
                  <span className="text-red-400">{t('saveManager.losses', { count: c.losses })}</span>
                  {c.maxAscension > 0 && <span className="ml-1.5 text-amber-500">A{c.maxAscension}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.epochs > 0 && (
        <p className="text-[10px] text-gray-400">{t('saveManager.runsComplete', { count: summary.epochs })}</p>
      )}
    </div>
  );
}

function SlotCard({ slotName, slot, modded, onExport, onImport, locale, t }) {
  const isEmpty = !slot || slot.empty;
  const accent = modded ? 'purple' : 'emerald';
  const borderClass = isEmpty ? 'border-gray-100' : modded ? 'border-purple-200 shadow-sm' : 'border-gray-200 shadow-sm';
  const slotNum = slotName.replace('profile', '');

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border p-5 transition-colors ${borderClass}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          {t('saveManager.slotLabel', { n: slotNum })}
          {modded && <span className="text-xs text-purple-500 font-normal ml-1.5">{t('saveManager.modLabel')}</span>}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          isEmpty ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
            : modded ? 'bg-purple-50 text-purple-600' : 'bg-emerald-50 text-emerald-600'
        }`}>
          {isEmpty ? t('saveManager.slotEmpty') : t('saveManager.slotHasData')}
        </span>
      </div>

      {!isEmpty && slot.summary && (
        <SaveSummary summary={slot.summary} accent={accent} locale={locale} t={t} />
      )}

      {!isEmpty && !slot.summary && (
        <div className="text-xs text-gray-500 space-y-1 mb-4">
          <p>{t('saveManager.size')}: {formatSize(slot.size)}</p>
          <p>{t('saveManager.lastModified')}: {formatTime(slot.lastModified, locale)}</p>
        </div>
      )}

      {isEmpty && <p className="text-xs text-gray-400 mb-4">{t('saveManager.noData')}</p>}

      {!isEmpty && (
        <div className="flex items-center gap-3 text-[10px] text-gray-400 mb-3">
          <span>{formatSize(slot.size)}</span>
          <span>·</span>
          <span>{formatTime(slot.lastModified, locale)}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => onExport(slotName, modded)}
          disabled={isEmpty}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            isEmpty
              ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
              : modded ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}>
          <Download size={13} /> {t('saveManager.export')}
        </button>
        <button onClick={() => onImport(slotName, modded)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <Upload size={13} /> {t('saveManager.import')}
        </button>
      </div>
    </div>
  );
}

export default function SaveManager() {
  const { t, locale } = useT();
  const [data, setData] = useState({ slots: [], backups: [] });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const refresh = async () => {
    setLoading(true);
    const result = await window.api.scanSaves();
    setData(result);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleExport = async (slot, modded) => {
    const result = await window.api.exportSave({ slot, modded });
    if (result.success) {
      showToast(t('saveManager.exportSuccess'));
      refresh();
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  };

  const handleImport = async (slot, modded) => {
    const result = await window.api.importSave({ slot, modded });
    if (result.success) {
      showToast(t('saveManager.importSuccess'));
      refresh();
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  };

  const handleDeleteBackup = async (backupPath) => {
    const result = await window.api.deleteBackup(backupPath);
    if (result.success) {
      showToast(t('saveManager.backupDeleted'));
      refresh();
    } else if (result.error) {
      showToast(result.error, 'error');
    }
  };

  const normalSlots = data.slots.filter(s => !s.modded);
  const moddedSlots = data.slots.filter(s => s.modded);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold dark:text-gray-100">{t('saveManager.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('saveManager.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {t('saveManager.refresh')}
            </button>
            <button onClick={() => window.api.openSavesDir()}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <FolderOpen size={16} /> {t('saveManager.openFolder')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-6 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <HardDrive size={14} /> {t('saveManager.normalSaves')}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {['profile1', 'profile2', 'profile3'].map(slotName => (
              <SlotCard key={slotName}
                slotName={slotName}
                slot={normalSlots.find(s => s.slot === slotName)}
                modded={false}
                onExport={handleExport}
                onImport={handleImport}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Gamepad2 size={14} /> {t('saveManager.moddedSaves')}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {['profile1', 'profile2', 'profile3'].map(slotName => (
              <SlotCard key={slotName}
                slotName={slotName}
                slot={moddedSlots.find(s => s.slot === slotName)}
                modded={true}
                onExport={handleExport}
                onImport={handleImport}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </section>

        {data.backups.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {t('saveManager.backups')}
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
              {data.backups.map(b => (
                <div key={b.name} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{b.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{formatTime(b.time, locale)} · {formatSize(b.size)}</p>
                  </div>
                  <button onClick={() => handleDeleteBackup(b.path)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title={t('saveManager.deleteBackup')}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.slots.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <HardDrive size={48} className="mb-4" />
            <p className="text-lg font-medium">{t('saveManager.noSaves')}</p>
            <p className="text-sm mt-1">{t('saveManager.noSavesHint')}</p>
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}