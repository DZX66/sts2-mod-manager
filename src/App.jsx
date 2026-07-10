import React, { useState, useEffect, useCallback } from 'react';
import workshopWarningImage from './assets/workshop_manager.webp';
import Sidebar from './components/Sidebar';
import ModCard from './components/ModCard';
import ModListItem from './components/ModListItem';
import ModDetail from './components/ModDetail';
import ModLoadOrder from './components/ModLoadOrder';
import LogViewer from './components/LogViewer';
import SettingsPage from './components/SettingsPage';
import SaveManager from './components/SaveManager';
import TitleBar from './components/TitleBar';
import {
  Download, RefreshCw, Search, FolderOpen, Archive, UploadCloud, Play, Loader, X, AlertTriangle, Info,
  ToggleLeft, ToggleRight, Trash2, Layers, Save, ChevronDown, Package, LayoutGrid, List,
  ArrowUpDown, CheckCircle2, Circle, Rocket, HelpCircle, Tag,
} from 'lucide-react';
import { getUnsatisfiedDeps } from './utils/deps';
import { useT } from './i18n/I18nContext';
import { loadTagsData, getModTags } from './components/ModTags';

function parseSearchQuery(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return { tags: [], text: '', customTags: [] };
  const tokens = trimmed.split(/\s+/);
  const tags = [];
  const textParts = [];
  const customTags = [];
  for (const token of tokens) {
    if (token.startsWith('#tag:')) {
      const tag = token.slice(5).trim();
      if (tag) customTags.push(tag.toLowerCase());
    } else if (token.startsWith('#')) {
      const tag = token.slice(1).toLowerCase();
      tags.push(tag);
    } else {
      textParts.push(token);
    }
  }
  return { tags, text: textParts.join(' '), customTags };
}

const TAG_FILTERS = {
  workshop: (m) => m.modType === 'steam_workshop',
  local: (m) => m.modType !== 'steam_workshop',
  enabled: (m) => m.enabled === true,
  disabled: (m) => m.enabled === false,
  dll: (m) => m.has_dll === true,
  pck: (m) => m.has_pck === true,
  gameplay: (m) => m.affects_gameplay === true,
  folder: (m) => m.isFolder === true,
  file: (m) => m.isFolder === false,
};

export default function App() {
  const { t } = useT();
  const [page, setPage] = useState('mods');
  const [mods, setMods] = useState([]);
  const [selectedMod, setSelectedMod] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [gamePath, setGamePath] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [gameState, setGameState] = useState('idle');
  const [gameVersion, setGameVersion] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [showProfiles, setShowProfiles] = useState(false);
  const [profiles, setProfiles] = useState({});
  const [newProfileName, setNewProfileName] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [missingModsDialog, setMissingModsDialog] = useState(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const [showWorkshopWarning, setShowWorkshopWarning] = useState(false);
  const [tagsData, setTagsData] = useState({ modTags: {}, tagColors: {} });
  const [tagFilter, setTagFilter] = useState('all'); // 'all' or specific tag name
  const [showTagFilterMenu, setShowTagFilterMenu] = useState(false);
  const [allTagNames, setAllTagNames] = useState([]);
  const [translations, setTranslations] = useState({});
  const [loadOrder, setLoadOrder] = useState([]);
  const [loadOrderInitialized, setLoadOrderInitialized] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [updateDialog, setUpdateDialog] = useState(null); // { version, url } or null

  // Initialize load order once
  useEffect(() => {
    if (!loadOrderInitialized && mods.length > 0) {
      (async () => {
        try {
          const result = await window.api.getLoadOrder();
          if (result.success && result.load_order) {
            const enabledIds = mods.filter(m => m.enabled && m.id).map(m => m.id);
            const validOrder = result.load_order.filter(id => enabledIds.includes(id));
            // Add any enabled mods not yet in order
            for (const id of enabledIds) {
              if (!validOrder.includes(id)) validOrder.push(id);
            }
            setLoadOrder(validOrder);
          } else {
            // Default to alphabetical
            setLoadOrder(mods.filter(m => m.enabled && m.id).map(m => m.id).sort((a, b) => a.localeCompare(b)));
          }
        } catch (e) {
          console.error('Failed to init load order:', e);
        }
        setLoadOrderInitialized(true);
      })();
    }
  }, [mods, loadOrderInitialized]);

  useEffect(() => {
    window.api.getGameState().then(setGameState);
    window.api.onGameStateChanged((state) => setGameState(state));
    window.api.loadProfiles().then(setProfiles);
    if (window.api.loadTranslations) window.api.loadTranslations().then(setTranslations);
  }, []);

  // Auto-refresh mods on window focus regain
  useEffect(() => {
    const onFocus = () => { refreshMods(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshMods]);

  // Show workshop warning if workshop mods exist and not dismissed
  useEffect(() => {
    if (mods.length > 0 && !localStorage.getItem('sts2-workshop-warning-dismissed')) {
      const hasWorkshop = mods.some(m => m.modType === 'steam_workshop');
      if (hasWorkshop) {
        setShowWorkshopWarning(true);
      }
    }
  }, [mods]);

  const handleLaunchGame = async () => {
    if (gameState !== 'idle') return;
    
    // Auto-write load order to settings.save if enabled
    const writePref = localStorage.getItem('sts2-load-order-write-settings');
    if (writePref !== 'false') {
      try {
        await window.api.writeLoadOrderToSettings();
      } catch (e) {
        console.error('Failed to write load order to settings:', e);
      }
    }
    
    const result = await window.api.launchGame();
    if (!result.success && result.error) showToast(result.error, 'error');
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const syncMods = useCallback((list) => {
    setMods(list);
    setSelectedMod((prev) => {
      if (!prev?.instanceKey) return null;
      return list.find((m) => m.instanceKey === prev.instanceKey) || null;
    });
  }, []);

  const refreshMods = useCallback(async () => {
    setLoading(true);
    const list = await window.api.scanMods();
    syncMods(list);
    setLoading(false);
  }, [syncMods]);

  useEffect(() => {
    (async () => {
      const info = await window.api.init();
      setGamePath(info.gamePath);
      if (info.gamePath) {
        const list = await window.api.scanMods();
        syncMods(list);
      }
      const v = await window.api.getGameVersion();
      if (v.version) setGameVersion(v.version);
    })();
  }, [syncMods]);

  // Load tags data
  useEffect(() => {
    loadTagsData().then(data => {
      setTagsData(data);
      const tags = data.modTags
        ? [...new Set(Object.values(data.modTags).flat())].sort((a, b) => a.localeCompare(b))
        : [];
      setAllTagNames(tags);
    });
  }, []);

  // Refresh tags when mods change or when switching back to mods page
  useEffect(() => {
    loadTagsData().then(data => {
      setTagsData(data);
      const tags = data.modTags
        ? [...new Set(Object.values(data.modTags).flat())].sort((a, b) => a.localeCompare(b))
        : [];
      setAllTagNames(tags);
    });
  }, [mods.length, selectedMod?.instanceKey, page]);

  // Fetch app version & check for updates
  useEffect(() => {
    (async () => {
      try {
        const ver = await window.api.getAppVersion().catch(() => '1.0.0');
        setAppVersion(ver);
      } catch (e) {
        setAppVersion('1.0.0');
      }
    })();
  }, []);

  // Check for updates on mount (only if not dismissed)
  useEffect(() => {
    if (!appVersion) return;
    (async () => {
      try {
        const res = await fetch('https://api.github.com/repos/DZX66/sts2-mod-manager/releases/latest');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const latestVersion = data.tag_name.replace(/^v/, '');
        const currentVersion = appVersion.replace(/^v/, '');
        const dismissedVersion = localStorage.getItem('sts2-update-dismissed');
        if (dismissedVersion === latestVersion) return;
        if (latestVersion !== currentVersion) {
          setUpdateDialog({ version: latestVersion, url: data.html_url, body: data.body });
        }
      } catch (e) {
        console.error('Update check failed:', e);
      }
    })();
  }, [appVersion]);

  const handleSelectGamePath = async () => {
    const info = await window.api.selectGamePath();
    if (info) { setGamePath(info.gamePath); refreshMods(); }
  };

  const handleToggle = async (mod) => {
    const result = await window.api.toggleMod(mod);
    if (result.success) {
      showToast(mod.enabled ? t('mods.disabled', { name: mod.name }) : t('mods.enabled', { name: mod.name }));
      if (result.mods) syncMods(result.mods); else refreshMods();
    } else showToast(result.error, 'error');
  };

  const doUninstall = async (mod) => {
    const result = await window.api.uninstallMod(mod);
    if (result.success) {
      showToast(t('mods.uninstalled', { name: mod.name }));
      if (result.mods) syncMods(result.mods); else refreshMods();
    } else showToast(result.error, 'error');
  };

  const handleUninstall = (mod) => {
    const dependents = mods.filter(m => m.dependencies && m.dependencies.some(d => d.id === mod.id) && m.enabled);
    setConfirmDialog({
      title: t('mods.confirmUninstallTitle', { name: mod.name }),
      message: dependents.length > 0
        ? t('mods.confirmUninstallMessage', { deps: dependents.map(d => d.name).join(', ') })
        : t('mods.confirmUninstallMessageSimple', { name: mod.name }),
      danger: true,
      onConfirm: () => { setConfirmDialog(null); doUninstall(mod); },
    });
  };

  const handleInstall = async () => {
    const result = await window.api.installMod();
    if (result.success) {
      showToast(t('mods.installed', { names: result.installed.join(', ') }));
      if (result.mods) syncMods(result.mods); else refreshMods();
    } else if (result.error !== 'Cancelled') showToast(result.error, 'error');
  };

  const handleBackup = async () => {
    const result = await window.api.backupMods();
    if (result.success) showToast(t('mods.backupDone'));
    else if (result.error) showToast(result.error, 'error');
  };

  const handleRestore = () => {
    setConfirmDialog({
      title: t('mods.confirmRestoreTitle'),
      message: t('mods.confirmRestoreMessage'),
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        const result = await window.api.restoreMods();
        if (result.success) {
          showToast(t('mods.restoreDone'));
          if (result.mods) syncMods(result.mods); else refreshMods();
        } else if (result.error) showToast(result.error, 'error');
      },
    });
  };

  const handleBatchToggle = async (enable) => {
    const targets = mods.filter(m => selectedIds.has(m.instanceKey) && m.enabled !== enable);
    for (const mod of targets) {
      await window.api.toggleMod(mod);
    }
    setSelectedIds(new Set());
    refreshMods();
    showToast(enable ? t('mods.batchEnabled', { count: targets.length }) : t('mods.batchDisabled', { count: targets.length }));
  };

  const handleBatchUninstall = () => {
    const targets = mods.filter(m => selectedIds.has(m.instanceKey));
    if (targets.length === 0) return;
    setConfirmDialog({
      title: t('mods.confirmUninstallTitle', { name: `${targets.length} MOD(s)` }),
      message: targets.map(m => m.name).join(', '),
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        for (const mod of targets) { await window.api.uninstallMod(mod); }
        setSelectedIds(new Set());
        setSelectedMod(null);
        refreshMods();
        showToast(t('mods.batchUninstalled', { count: targets.length }));
      },
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMods.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMods.map(m => m.instanceKey)));
    }
  };

  const handleSaveProfile = async () => {
    const name = newProfileName.trim();
    if (!name) return;
    const snapshot = {};
    mods.forEach(m => {
      if (m.enabled) {
        snapshot[m.id] = { version: m.version || null, enabled: true };
      }
    });
    const updated = { ...profiles, [name]: { snapshot, loadOrder: [...loadOrder], savedAt: new Date().toISOString() } };
    await window.api.saveProfiles(updated);
    setProfiles(updated);
    setNewProfileName('');
    showToast(t('mods.profileSaved', { name }));
  };

  const handleSaveExistingProfile = async (name) => {
    const snapshot = {};
    mods.forEach(m => {
      if (m.enabled) {
        snapshot[m.id] = { version: m.version || null, enabled: true };
      }
    });
    const updated = { ...profiles, [name]: { ...profiles[name], snapshot, loadOrder: [...loadOrder], savedAt: new Date().toISOString() } };
    await window.api.saveProfiles(updated);
    setProfiles(updated);
    showToast(t('mods.profileOverwritten', { name }));
  };

  const getProfileEntry = (entry) => {
    if (typeof entry === 'boolean') return { version: null, enabled: entry };
    return { version: entry?.version || null, enabled: entry?.enabled ?? false };
  };

  const applyProfileState = async (profile) => {
    for (const mod of mods) {
      const entry = profile.snapshot[mod.id];
      if (entry !== undefined) {
        const info = getProfileEntry(entry);
        if (info.version) {
          const isTargetVersion = mod.version === info.version;
          if (isTargetVersion && !mod.enabled) {
            await window.api.toggleMod(mod);
          } else if (!isTargetVersion && mod.enabled) {
            await window.api.toggleMod(mod);
          }
        } else {
          if (info.enabled !== mod.enabled) {
            await window.api.toggleMod(mod);
          }
        }
      } else {
        if (mod.enabled) {
          await window.api.toggleMod(mod);
        }
      }
    }

    // Restore load order from profile if available
    if (profile.loadOrder && profile.loadOrder.length > 0) {
      const enabledIds = mods.filter(m => m.enabled && m.id).map(m => m.id);
      const validOrder = profile.loadOrder.filter(id => enabledIds.includes(id));
      // Add any enabled mods not yet in order
      for (const id of enabledIds) {
        if (!validOrder.includes(id)) validOrder.push(id);
      }
      await window.api.setLoadOrder(validOrder);
      setLoadOrder(validOrder);
    }
  };

  const handleApplyProfile = (name) => {
    const profile = profiles[name];
    if (!profile) return;

    const missingModIds = Object.keys(profile.snapshot).filter(id => {
      return !mods.some(m => m.id === id);
    });

    const versionMismatches = Object.keys(profile.snapshot).filter(id => {
      const entry = profile.snapshot[id];
      const info = getProfileEntry(entry);
      if (!info.version) return false;
      if (missingModIds.includes(id)) return false;
      return !mods.some(m => m.id === id && m.version === info.version);
    }).map(id => {
      const entry = profile.snapshot[id];
      const info = getProfileEntry(entry);
      const availableVersions = [...new Set(
        mods.filter(m => m.id === id).map(m => m.version || t('common.unknown'))
      )];
      return { id, savedVersion: info.version, availableVersions };
    });

    const changes = mods.filter(m => {
      const entry = profile.snapshot[m.id];
      if (entry !== undefined) {
        const info = getProfileEntry(entry);
        if (info.version) {
          if (m.version === info.version) return !m.enabled;
          return m.enabled;
        }
        return info.enabled !== m.enabled;
      }
      return m.enabled;
    });

    if (missingModIds.length > 0 || versionMismatches.length > 0) {
      const missingInfo = missingModIds.map(id => {
        const entry = profile.snapshot[id];
        const info = getProfileEntry(entry);
        return { id, version: info.version };
      });
      setMissingModsDialog({
        profileName: name,
        missingMods: missingInfo,
        versionMismatches,
        onIgnore: async () => {
          setMissingModsDialog(null);
          await applyProfileState(profile);
          refreshMods();
          setShowProfiles(false);
          showToast(t('mods.profileAppliedWithIssues', { name, missing: missingModIds.length, mismatch: versionMismatches.length > 0 ? ` + ${versionMismatches.length} ${t('missingModsDialog.versionMismatches')}` : '' }));
        },
        onUpdate: async () => {
          setMissingModsDialog(null);
          const updatedSnapshot = { ...profile.snapshot };
          missingModIds.forEach(id => delete updatedSnapshot[id]);
          versionMismatches.forEach(m => {
            if (m.availableVersions && m.availableVersions.length > 0) {
              const firstAvail = m.availableVersions[0];
              updatedSnapshot[m.id] = { ...updatedSnapshot[m.id], version: firstAvail !== t('common.unknown') ? firstAvail : null };
            }
          });
          const updatedProfile = { ...profile, snapshot: updatedSnapshot, savedAt: new Date().toISOString() };
          const updated = { ...profiles, [name]: updatedProfile };
          await window.api.saveProfiles(updated);
          setProfiles(updated);
          await applyProfileState(updatedProfile);
          refreshMods();
          setShowProfiles(false);
          showToast(t('mods.profileUpdatedAndApplied', { name, missing: missingModIds.length, mismatch: versionMismatches.length }));
        },
      });
      return;
    }

    setConfirmDialog({
      title: t('mods.confirmApplyProfile', { name }),
      message: changes.length > 0
        ? t('mods.confirmApplyProfileChanges', { count: changes.length })
        : t('mods.confirmApplyProfileNoChanges'),
      danger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        await applyProfileState(profile);
        refreshMods();
        setShowProfiles(false);
        showToast(t('mods.profileApplied', { name }));
      },
    });
  };

  const handleDeleteProfile = async (name) => {
    const updated = { ...profiles };
    delete updated[name];
    await window.api.saveProfiles(updated);
    setProfiles(updated);
    showToast(t('mods.profileDeleted', { name }));
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const paths = Array.from(e.dataTransfer.files)
      .filter(f => f.name.endsWith('.zip') || !f.name.includes('.') || f.type === '')
      .map(f => f.path);
    if (paths.length === 0) {
      showToast(t('mods.dragZipError'), 'error');
      return;
    }
    const result = await window.api.installDrop(paths);
    if (result.success) {
      showToast(t('mods.installed', { names: result.installed.join(', ') }));
      if (result.mods) syncMods(result.mods); else refreshMods();
    } else showToast(result.error, 'error');
  };

  const hasMissingDeps = (mod) => {
    if (!mod.dependencies || mod.dependencies.length === 0) return false;
    return getUnsatisfiedDeps(mod, mods).length > 0;
  };

  const isFramework = (mod) => mods.some(m => m.id !== mod.id && m.dependencies && m.dependencies.some(d => d.id === mod.id));

  const { tags: searchTags, text: searchText, customTags: searchCustomTags } = parseSearchQuery(search);

  const filteredMods = mods.filter(m => {
    if (filter === 'enabled' && !m.enabled) return false;
    if (filter === 'disabled' && m.enabled) return false;

    // Apply tag filter from dropdown
    if (tagFilter !== 'all') {
      const modTagNames = getModTags(tagsData, m.id);
      if (!modTagNames.includes(tagFilter)) return false;
    }

    // Apply search tag filters
    for (const tag of searchTags) {
      if (tag === 'framework') {
        if (!isFramework(m)) return false;
      } else if (tag === 'resource') {
        if (isFramework(m) || m.affects_gameplay) return false;
      } else if (tag === 'missingdeps' || tag === 'dep') {
        if (!hasMissingDeps(m)) return false;
      } else if (TAG_FILTERS[tag]) {
        if (!TAG_FILTERS[tag](m)) return false;
      }
    }

    // Apply custom tag search (#tag:name syntax)
    for (const customTag of searchCustomTags) {
      const modTagNames = getModTags(tagsData, m.id);
      if (!modTagNames.some(t => t.toLowerCase().includes(customTag))) {
        return false;
      }
    }

    // Apply text search (only if there's text after tags)
    if (searchText) {
      const s = searchText.toLowerCase();
      return (m.name || '').toLowerCase().includes(s)
        || (m.id || '').toLowerCase().includes(s)
        || (m.author || '').toLowerCase().includes(s);
    }
    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name': return (a.name || '').localeCompare(b.name || '');
      case 'depIssues': {
        const aIssue = hasMissingDeps(a) ? 0 : 1;
        const bIssue = hasMissingDeps(b) ? 0 : 1;
        return aIssue - bIssue || (a.name || '').localeCompare(b.name || '');
      }
      case 'gameplay': {
        const aScore = (a.affects_gameplay || a.has_dll) ? 0 : 1;
        const bScore = (b.affects_gameplay || b.has_dll) ? 0 : 1;
        return aScore - bScore || (a.name || '').localeCompare(b.name || '');
      }
      case 'category': {
        const catOrder = (m) => isFramework(m) ? 0 : (m.affects_gameplay || m.has_dll) ? 1 : 2;
        return catOrder(a) - catOrder(b) || (a.name || '').localeCompare(b.name || '');
      }
      case 'size': return (b.size || 0) - (a.size || 0);
      default: return 0;
    }
  });

  const enabledCount = mods.filter(m => m.enabled).length;
  const disabledCount = mods.filter(m => !m.enabled).length;

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          page={page}
          setPage={setPage}
          gamePath={gamePath}
          onSelectGamePath={handleSelectGamePath}
          enabledCount={enabledCount}
          totalCount={mods.length}
          gameVersion={gameVersion}
        />

        <main
          className={`flex-1 flex flex-col overflow-hidden transition-colors ${dragOver ? 'bg-blue-50 dark:bg-blue-950' : 'bg-gray-50 dark:bg-gray-900'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {page === 'mods' && (
            <>
              <div className="px-8 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-bold">{t('mods.title')}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('mods.summary', { total: mods.length, enabled: enabledCount, disabled: disabledCount })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleInstall}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                      <Download size={16} /> {t('mods.installMod')}
                    </button>
                    <button onClick={refreshMods}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {t('mods.refresh')}
                    </button>
                    <div className="relative">
                      <button onClick={() => setShowProfiles(!showProfiles)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <Layers size={16} /> {t('mods.profile')} <ChevronDown size={12} />
                      </button>
                      {showProfiles && (
                        <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                          <div className="p-3 border-b border-gray-50 dark:border-gray-700">
                            <div className="flex gap-1.5">
                              <input type="text" value={newProfileName} onChange={e => setNewProfileName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveProfile()}
                                placeholder={t('mods.profileInputPlaceholder')}
                                className="flex-1 px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-gray-300 dark:bg-gray-700 dark:text-gray-100" />
                              <button onClick={handleSaveProfile}
                                className="px-2.5 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800">
                                <Save size={12} />
                              </button>
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">{t('mods.profileCurrentEnabled', { count: enabledCount })}</p>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {Object.keys(profiles).length === 0 ? (
                              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">{t('mods.profileNoProfiles')}</p>
                            ) : Object.entries(profiles).map(([name, profile]) => (
                              <div key={name} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 group">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium truncate dark:text-gray-100">{name}</p>
                                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                    {t('mods.profileModsCount', { count: Object.values(profile.snapshot).filter(v => typeof v === 'boolean' ? v : v?.enabled).length })}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleApplyProfile(name)}
                                    className="px-2 py-1 text-[10px] font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800">
                                    {t('mods.profileApply')}
                                  </button>
                                  <button onClick={() => handleSaveExistingProfile(name)}
                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                    title={t('mods.profileOverwriteTitle')}>
                                    <Save size={12} />
                                  </button>
                                  <button onClick={() => handleDeleteProfile(name)}
                                    className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={handleLaunchGame}
                      disabled={gameState !== 'idle'}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        gameState === 'idle'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : gameState === 'launching'
                            ? 'bg-amber-500 text-white cursor-wait'
                            : 'bg-blue-500 text-white cursor-default'
                      }`}>
                      {gameState === 'idle' && <><Play size={14} /> {t('mods.launchGame')}</>}
                      {gameState === 'launching' && <><Loader size={14} className="animate-spin" /> {t('mods.launching')}</>}
                      {gameState === 'running' && <><span className="w-2 h-2 rounded-full bg-white animate-pulse" /> {t('mods.gameRunning')}</>}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('mods.searchPlaceholder')}
                      className="w-full pl-10 pr-10 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:bg-gray-800 dark:text-gray-100" />
                    <button onClick={() => setShowSearchHelp(!showSearchHelp)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                      <HelpCircle size={16} />
                    </button>
                    {showSearchHelp && (
                      <div className="absolute left-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase">{t('mods.searchHelpTitle')}</p>
                          <button onClick={() => setShowSearchHelp(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={14} />
                          </button>
                        </div>
                        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                          <p><code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[11px]">#workshop</code> {t('mods.searchHelpWorkshop')}</p>
                          <p><code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[11px]">#local</code> {t('mods.searchHelpLocal')}</p>
                          <p><code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[11px]">#enabled / #disabled</code> {t('mods.searchHelpEnabledDisabled')}</p>
                          <p><code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[11px]">#dll / #pck</code> {t('mods.searchHelpDllPck')}</p>
                          <p><code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[11px]">#gameplay</code> {t('mods.searchHelpGameplay')}</p>
                          <p><code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[11px]">#folder / #file</code> {t('mods.searchHelpFolderFile')}</p>
                          <p><code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[11px]">#framework</code> {t('mods.searchHelpFramework')}</p>
                          <p><code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[11px]">#resource</code> {t('mods.searchHelpResource')}</p>
                          <p><code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[11px]">#missingdeps</code> {t('mods.searchHelpMissingDeps')}</p>
                          <p><code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[11px]">#tag:名称</code> {t('mods.searchHelpCustomTag')}</p>
                          <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
                            <p className="text-gray-400">{t('mods.searchHelpCombine')}<code className="text-[11px]">{t('mods.searchHelpCombineText')}</code></p>
                            <p className="text-gray-400">{t('mods.searchHelpSearch')}<code className="text-[11px]">{t('mods.searchHelpSearchText')}</code></p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                    {[['all', t('mods.filterAll')], ['enabled', t('mods.filterEnabled')], ['disabled', t('mods.filterDisabled')]].map(([key, label]) => (
                      <button key={key} onClick={() => setFilter(key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          filter === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <button onClick={() => setShowTagFilterMenu(!showTagFilterMenu)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        tagFilter !== 'all'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}>
                      <Tag size={13} />
                      {tagFilter !== 'all' ? tagFilter : t('mods.filterTag')}
                      <ChevronDown size={11} />
                    </button>
                    {showTagFilterMenu && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden py-1">
                        <button
                          onClick={() => { setTagFilter('all'); setShowTagFilterMenu(false); }}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                            tagFilter === 'all' ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}>
                          {t('mods.filterAll')}
                        </button>
                        {allTagNames.map(tagName => {
                          const color = tagsData.tagColors?.[tagName];
                          const bg = color ? color + '20' : '#f0f0ff';
                          const textColor = color || '#6366f1';
                          return (
                            <button
                              key={tagName}
                              onClick={() => { setTagFilter(tagName); setShowTagFilterMenu(false); }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                                tagFilter === tagName ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}>
                              <Tag size={11} style={{ color: textColor }} />
                              <span>{tagName}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {showTagFilterMenu && (
                    <div className="fixed inset-0 z-40" onClick={() => setShowTagFilterMenu(false)} />
                  )}
                  <div className="relative">
                    <button onClick={() => setShowSortMenu(!showSortMenu)}
                      className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                      <ArrowUpDown size={13} className="text-gray-400 dark:text-gray-500" />
                      {{ name: t('mods.name'), depIssues: t('mods.depIssues'), gameplay: t('mods.gameplay'), category: t('mods.category'), size: t('mods.size') }[sortBy]}
                      <ChevronDown size={11} className="text-gray-400" />
                    </button>
                    {showSortMenu && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden py-1">
                        {[['name', t('mods.sortName')], ['depIssues', t('mods.sortDepIssues')], ['gameplay', t('mods.sortGameplay')], ['category', t('mods.sortCategory')], ['size', t('mods.sortSize')]].map(([key, label]) => (
                          <button key={key}
                            onClick={() => { setSortBy(key); setShowSortMenu(false); }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                              sortBy === key ? 'bg-gray-900 dark:bg-gray-700 text-white font-medium' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                    <button onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                      title={t('mods.cardView')}>
                      <LayoutGrid size={16} />
                    </button>
                    <button onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                      title={t('mods.listView')}>
                      <List size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-8 pb-3 flex items-center gap-2">
                {viewMode === 'list' && (
                  <input type="checkbox"
                    checked={filteredMods.length > 0 && selectedIds.size === filteredMods.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400 cursor-pointer mr-1" />
                )}
                <button onClick={() => window.api.openModsDir()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                  <FolderOpen size={14} /> {t('mods.modsFolder')}
                </button>
                <button onClick={() => window.api.openGameDir()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                  <FolderOpen size={14} /> {t('mods.gameDir')}
                </button>
                <button onClick={handleBackup}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                  <Archive size={14} /> {t('mods.backup')}
                </button>
                <button onClick={handleRestore}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                  <UploadCloud size={14} /> {t('mods.restore')}
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <div className="w-px h-5 bg-gray-200 mx-1" />
                    <span className="text-xs font-medium text-blue-600">{t('mods.selected', { count: selectedIds.size })}</span>
                    <button onClick={() => handleBatchToggle(true)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100">
                      <ToggleRight size={12} /> {t('mods.batchEnable')}
                    </button>
                    <button onClick={() => handleBatchToggle(false)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">
                      <ToggleLeft size={12} /> {t('mods.batchDisable')}
                    </button>
                    <button onClick={handleBatchUninstall}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100">
                      <Trash2 size={12} /> {t('mods.batchUninstall')}
                    </button>
                    <button onClick={() => setSelectedIds(new Set())}
                      className="p-1 text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>

              {viewMode === 'grid' ? (
                <div className="flex flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-8 pb-6">
                    {!gamePath && mods.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">{t('mods.noGamePathTitle')}</h2>
                        <p className="text-sm text-gray-400 mb-8">{t('mods.noGamePathDesc')}</p>
                        <div className="flex gap-5 max-w-2xl">
                          <div onClick={handleSelectGamePath}
                            className="flex-1 bg-white rounded-xl border-2 border-dashed border-gray-200 p-6 text-center cursor-pointer hover:border-gray-900 hover:shadow-lg transition-all group">
                            <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                              <FolderOpen size={22} />
                            </div>
                            <p className="font-semibold text-gray-800 mb-1">{t('mods.noGamePathStep1')}</p>
                            <p className="text-xs text-gray-400">{t('mods.noGamePathStep1Desc')}</p>
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-gray-100 p-6 text-center opacity-50">
                            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                              <Download size={22} />
                            </div>
                            <p className="font-semibold text-gray-500 mb-1">{t('mods.noGamePathStep2')}</p>
                            <p className="text-xs text-gray-400">{t('mods.noGamePathStep2Desc')}</p>
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-gray-100 p-6 text-center opacity-50">
                            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                              <Rocket size={22} />
                            </div>
                            <p className="font-semibold text-gray-500 mb-1">{t('mods.noGamePathStep3')}</p>
                            <p className="text-xs text-gray-400">{t('mods.noGamePathStep3Desc')}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-300 mt-6">{t('mods.noGamePathHelp')}</p>
                      </div>
                    ) : gamePath && mods.length === 0 && !search ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">{t('mods.gameReadyTitle')}</h2>
                        <p className="text-sm text-gray-400 mb-8">{t('mods.gameReadyDesc')}</p>
                        <div className="flex gap-5 max-w-2xl">
                          <div className="flex-1 bg-white rounded-xl border border-gray-100 p-6 text-center opacity-50">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                              <CheckCircle2 size={22} />
                            </div>
                            <p className="font-semibold text-gray-500 mb-1">{t('mods.gameReadyStep1')}</p>
                            <p className="text-xs text-gray-400">{t('mods.gameReadyStep1Done')}</p>
                          </div>
                          <div onClick={handleInstall}
                            className="flex-1 bg-white rounded-xl border-2 border-dashed border-gray-200 p-6 text-center cursor-pointer hover:border-gray-900 hover:shadow-lg transition-all group">
                            <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                              <Download size={22} />
                            </div>
                            <p className="font-semibold text-gray-800 mb-1">{t('mods.gameReadyStep2')}</p>
                            <p className="text-xs text-gray-400">{t('mods.gameReadyStep2Desc')}</p>
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-gray-100 p-6 text-center opacity-50">
                            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                              <Rocket size={22} />
                            </div>
                            <p className="font-semibold text-gray-500 mb-1">{t('mods.gameReadyStep3')}</p>
                            <p className="text-xs text-gray-400">{t('mods.gameReadyStep3Desc')}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-300 mt-6">{t('mods.gameReadyHelp')}</p>
                      </div>
                    ) : filteredMods.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <p className="text-lg font-medium">{search ? t('mods.noMatch') : t('mods.noMods')}</p>
                        <p className="text-sm mt-1">{t('mods.dragToInstall')}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredMods.map(mod => (
                          <ModCard
                            key={mod.instanceKey || `${mod.id}-${mod.enabled}-${mod.folderName}`}
                            mod={mod}
                            allMods={mods}
                            translations={translations}
                            gameVersion={gameVersion}
                            tagsData={tagsData}
                            onToggle={() => handleToggle(mod)}
                            onClick={() => setSelectedMod(mod)}
                            selected={selectedMod?.instanceKey === mod.instanceKey}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedMod && (
                    <ModDetail
                      gameVersion={gameVersion}
                      mod={selectedMod}
                      allMods={mods}
                      onClose={() => setSelectedMod(null)}
                      onToggle={() => handleToggle(selectedMod)}
                      onUninstall={() => handleUninstall(selectedMod)}
                      onSelectMod={setSelectedMod}
                      onTranslationSaved={() => window.api.loadTranslations && window.api.loadTranslations().then(setTranslations)}
                      onTagsChanged={() => loadTagsData().then(data => {
                        setTagsData(data);
                        const tags = data.modTags
                          ? [...new Set(Object.values(data.modTags).flat())].sort((a, b) => a.localeCompare(b))
                          : [];
                        setAllTagNames(tags);
                      })}
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto border-t border-gray-100">
                    {!gamePath && mods.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <FolderOpen size={40} className="mb-3" />
                        <p className="text-sm font-medium mb-2">{t('mods.noGamePathTitle')}</p>
                        <button onClick={handleSelectGamePath}
                          className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs">{t('nav.clickSelectGamePath')}</button>
                      </div>
                    ) : filteredMods.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <p className="text-sm font-medium">{search ? t('mods.noMatch') : t('mods.noMods')}</p>
                        <p className="text-xs mt-1">{t('mods.dragToInstall')}</p>
                      </div>
                    ) : (
                      filteredMods.map(mod => (
                        <ModListItem
                          key={mod.instanceKey || `${mod.id}-${mod.enabled}-${mod.folderName}`}
                          mod={mod}
                          allMods={mods}
                          translations={translations}
                          gameVersion={gameVersion}
                          selected={selectedMod?.instanceKey === mod.instanceKey}
                          multiSelected={selectedIds.has(mod.instanceKey)}
                          onToggle={() => handleToggle(mod)}
                          onClick={() => setSelectedMod(mod)}
                          onCheckToggle={() => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(mod.instanceKey)) next.delete(mod.instanceKey);
                              else next.add(mod.instanceKey);
                              return next;
                            });
                          }}
                          draggable={false}
                        />
                      ))
                    )}
                  </div>
                  {selectedMod ? (
                    <ModDetail
                      gameVersion={gameVersion}
                      mod={selectedMod}
                      allMods={mods}
                      onClose={() => setSelectedMod(null)}
                      onToggle={() => handleToggle(selectedMod)}
                      onUninstall={() => handleUninstall(selectedMod)}
                      onSelectMod={setSelectedMod}
                      onTranslationSaved={() => window.api.loadTranslations && window.api.loadTranslations().then(setTranslations)}
                      onTagsChanged={() => loadTagsData().then(data => {
                        setTagsData(data);
                        const tags = data.modTags
                          ? [...new Set(Object.values(data.modTags).flat())].sort((a, b) => a.localeCompare(b))
                          : [];
                        setAllTagNames(tags);
                      })}
                    />
                  ) : (
                    <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
                      <Package size={40} className="mb-3" />
                      <p className="text-sm dark:text-gray-500">{t('mods.selectModHint')}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {page === 'saves' && <SaveManager />}
          {page === 'logs' && <LogViewer />}
          {page === 'settings' && <SettingsPage />}
          {page === 'loadorder' && (
            <ModLoadOrder
              mods={mods}
              loadOrder={loadOrder}
              setLoadOrder={setLoadOrder}
            />
          )}
        </main>
      </div>

      {dragOver && (
        <div className="fixed inset-0 bg-blue-50/80 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
            <Download size={40} className="mx-auto mb-3 text-gray-900" />
            <p className="text-lg font-semibold">{t('mods.dragOverlay')}</p>
          </div>
        </div>
      )}

      {showProfiles && (
        <div className="fixed inset-0 z-40" onClick={() => setShowProfiles(false)} />
      )}
      {showSortMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
      )}

      {showWorkshopWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowWorkshopWarning(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[520px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <h3 className="font-bold text-gray-900">{t('mods.workshopWarningTitle')}</h3>
            </div>
            <div className="px-6 py-4 flex items-start gap-4">
              <img
                src={workshopWarningImage}
                alt="Workshop Manager"
                className="w-44 h-auto rounded-xl flex-shrink-0 border border-gray-200"
              />
              <div>
                <p className="text-sm text-gray-600 leading-relaxed">{t('mods.workshopWarningMessage')}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => {
                localStorage.setItem('sts2-workshop-warning-dismissed', 'true');
                setShowWorkshopWarning(false);
              }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                {t('mods.workshopWarningDontShow')}
              </button>
              <button onClick={() => setShowWorkshopWarning(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                {t('confirmDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {updateDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setUpdateDialog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[540px] max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Download size={20} className="text-blue-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{t('updateDialog.title')}</h3>
                <p className="text-xs text-gray-500">v{updateDialog.version}</p>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
              {updateDialog.body ? (
                <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {updateDialog.body}
                </div>
              ) : (
                <p className="text-sm text-gray-600 leading-relaxed">{t('updateDialog.message', { version: updateDialog.version })}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <button onClick={() => {
                window.api.openUrl && window.api.openUrl(updateDialog.url);
                setUpdateDialog(null);
              }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                {t('updateDialog.openRelease')}
              </button>
              <button onClick={() => {
                localStorage.setItem('sts2-update-dismissed', updateDialog.version);
                setUpdateDialog(null);
              }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                {t('updateDialog.dismissVersion')}
              </button>
              <button onClick={() => setUpdateDialog(null)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                {t('updateDialog.later')}
              </button>
            </div>
          </div>
        </div>
      )}

      {missingModsDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setMissingModsDialog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{t('missingModsDialog.title', { name: missingModsDialog.profileName })}</h3>
                <p className="text-xs text-gray-400">
                  {missingModsDialog.missingMods?.length > 0 && `${missingModsDialog.missingMods.length} ${t('missingModsDialog.missingMods')}`}
                  {missingModsDialog.missingMods?.length > 0 && missingModsDialog.versionMismatches?.length > 0 && ' · '}
                  {missingModsDialog.versionMismatches?.length > 0 && `${missingModsDialog.versionMismatches.length} ${t('missingModsDialog.versionMismatches')}`}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto max-h-52 space-y-3">
              {missingModsDialog.missingMods?.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1">{t('missingModsDialog.missingMods')}</p>
                  {missingModsDialog.missingMods.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                        <X size={12} className="text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.id}</p>
                        {m.version && <p className="text-[10px] text-gray-400">{t('missingModsDialog.recordedVersion', { version: m.version })}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {missingModsDialog.versionMismatches?.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1">{t('missingModsDialog.versionMismatches')}</p>
                  {missingModsDialog.versionMismatches.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Info size={12} className="text-amber-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.id}</p>
                        <p className="text-[10px] text-gray-400">
                          {t('missingModsDialog.recorded', { saved: m.savedVersion, available: m.availableVersions?.join(', ') || t('common.unknown') })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={missingModsDialog.onIgnore}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors">
                {t('missingModsDialog.ignore')}
              </button>
              <button onClick={missingModsDialog.onUpdate}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                {t('missingModsDialog.updateProfile')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmDialog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmDialog.danger ? 'bg-red-50' : 'bg-blue-50'}`}>
                <AlertTriangle size={20} className={confirmDialog.danger ? 'text-red-500' : 'text-blue-500'} />
              </div>
              <h3 className="font-bold text-gray-900">{confirmDialog.title}</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={confirmDialog.onConfirm}
                style={{ backgroundColor: confirmDialog.danger ? '#dc2626' : '#111827', color: '#fff' }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors">
                {t('confirmDialog.confirm')}
              </button>
              <button onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                {t('confirmDialog.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 transition-all ${
          toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}