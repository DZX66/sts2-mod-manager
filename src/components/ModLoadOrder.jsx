import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUpDown, Save, Download, Upload, Shuffle, Loader, RefreshCw,
  GripVertical, ArrowUp, ArrowDown, Settings,
} from 'lucide-react';
import { useT } from '../i18n/I18nContext';

export default function ModLoadOrder({ mods, loadOrder, setLoadOrder }) {
  const { t } = useT();
  const [enabledMods, setEnabledMods] = useState([]);
  const [order, setOrder] = useState([]);
  const [toast, setToast] = useState(null);
  const [writeToSettings, setWriteToSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const dragFromRef = useRef(null);
  const orderRef = useRef(order);
  const listContainerRef = useRef(null);
  // Keep orderRef in sync with order state for mouse event handlers
  useEffect(() => { orderRef.current = order; }, [order]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load initial data
  useEffect(() => {
    loadData();
    const pref = localStorage.getItem('sts2-load-order-write-settings');
    if (pref !== null) setWriteToSettings(pref === 'true');
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const enabledIds = await window.api.getLoadOrderEnabledIds();
      setEnabledMods(enabledIds || []);

      const result = await window.api.getLoadOrder();
      if (result.success && result.load_order) {
        const enabledSet = new Set((enabledIds || []).map(m => m.id));
        const validOrder = (result.load_order || []).filter(id => enabledSet.has(id));
        const remaining = (enabledIds || [])
          .map(e => e.id)
          .filter(id => !validOrder.includes(id))
          .sort((a, b) => a.localeCompare(b));
        const merged = [...validOrder, ...remaining];
        setOrder(merged);
        if (setLoadOrder) setLoadOrder(merged);
      } else {
        if (enabledIds) {
          const defaultOrder = enabledIds
            .map(e => e.id)
            .sort((a, b) => a.localeCompare(b));
          setOrder(defaultOrder);
          if (setLoadOrder) setLoadOrder(defaultOrder);
        }
      }
    } catch (e) {
      console.error('Failed to load order data:', e);
    }
    setLoading(false);
  };

  const saveOrder = useCallback(async (newOrder) => {
    try {
      await window.api.setLoadOrder(newOrder);
    } catch (e) {
      console.error('Failed to save order:', e);
    }
  }, []);

  const handleReorder = (newOrder) => {
    setOrder(newOrder);
    if (setLoadOrder) setLoadOrder(newOrder);
    saveOrder(newOrder);
  };

  // ── Mouse-based Drag & Drop (replaces HTML5 DnD for WebView2 compatibility) ──

  // Attach / detach document-level listeners when drag starts / stops
  useEffect(() => {
    if (dragIndex === null) return;

    const onMove = (e) => {
      const from = dragFromRef.current;
      if (from === null) return;
      const currentOrder = orderRef.current;
      const container = listContainerRef.current;
      if (!container) return;

      const items = container.querySelectorAll('[data-drag-item]');
      let targetIndex = currentOrder.length; // default: after last item

      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          targetIndex = i;
          break;
        }
      }

      // Calculate insert position relative to the dragged item's current slot
      let insertAt = targetIndex;
      if (targetIndex > from) insertAt = targetIndex - 1;

      if (insertAt !== from) {
        const newOrder = [...currentOrder];
        const [moved] = newOrder.splice(from, 1);
        newOrder.splice(insertAt, 0, moved);
        orderRef.current = newOrder;
        dragFromRef.current = insertAt;
        setOrder(newOrder);
        if (setLoadOrder) setLoadOrder(newOrder);
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDragIndex(null);
      // Persist final order
      saveOrder(orderRef.current);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragIndex]);

  const handleGripMouseDown = useCallback((e, index) => {
    e.preventDefault();
    e.stopPropagation();
    dragFromRef.current = index;
    setDragIndex(index);
  }, []);

  const moveUp = (index) => {
    if (index === 0) return;
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    handleReorder(newOrder);
  };

  const moveDown = (index) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    handleReorder(newOrder);
  };

  const handleSmartSort = async () => {
    setLoading(true);
    try {
      const result = await window.api.smartSortLoadOrder();
      if (result.success && result.load_order) {
        const enabledSet = new Set(enabledMods.map(m => m.id));
        const validOrder = result.load_order.filter(id => enabledSet.has(id));
        setOrder(validOrder);
        if (setLoadOrder) setLoadOrder(validOrder);
        showToast(t('loadOrder.smartSortDone'));
      } else {
        showToast(result.error || t('loadOrder.smartSortError'), 'error');
      }
    } catch (e) {
      console.error('Smart sort failed:', e);
      showToast(t('loadOrder.smartSortError'), 'error');
    }
    setLoading(false);
  };

  const handleWriteToSettings = async () => {
    setLoading(true);
    try {
      // Save current order first
      await saveOrder(order);
      const result = await window.api.writeLoadOrderToSettings();
      if (result.success) {
        showToast(t('loadOrder.writtenToSettings'));
      } else {
        showToast(result.error || t('loadOrder.writeSettingsError'), 'error');
      }
    } catch (e) {
      console.error('Failed to write to settings:', e);
      showToast(t('loadOrder.writeSettingsError'), 'error');
    }
    setLoading(false);
  };

  const toggleWriteSettings = () => {
    const newVal = !writeToSettings;
    setWriteToSettings(newVal);
    localStorage.setItem('sts2-load-order-write-settings', newVal.toString());
  };

  const handleExport = async () => {
    try {
      const jsonStr = JSON.stringify(order);
      const result = await window.api.exportLoadOrderFile(jsonStr);
      showToast(t('loadOrder.exported'));
    } catch (e) {
      // User cancelled or error
      if (e !== '用户取消了操作') {
        showToast(t('loadOrder.exportError'), 'error');
      }
    }
  };

  const handleImport = async () => {
    try {
      const result = await window.api.importLoadOrderFile();
      if (result.success && result.load_order) {
        const enabledSet = new Set(enabledMods.map(m => m.id));
        const validOrder = result.load_order.filter(id => enabledSet.has(id));
        setOrder(validOrder);
        if (setLoadOrder) setLoadOrder(validOrder);
        showToast(t('loadOrder.imported'));
      } else if (result.error && result.error !== '用户取消了操作') {
        showToast(result.error || t('loadOrder.importError'), 'error');
      }
    } catch (e) {
      showToast(t('loadOrder.importError'), 'error');
    }
  };

  const getMod = (id) => mods.find(m => m.id === id);
  const getModName = (id) => {
    const mod = getMod(id);
    return mod ? (mod.name || mod.id || id) : id;
  };
  const isFramework = (mod) => mod && mods.some(m => m.id !== mod.id && m.dependencies?.some(d => d.id === mod.id));
  const isResource = (mod) => mod  && !mod.affects_gameplay;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-8 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-gray-100">{t('loadOrder.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('loadOrder.summary', { count: order.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSmartSort} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50">
              {loading ? <Loader size={16} className="animate-spin" /> : <Shuffle size={16} />}
              {t('loadOrder.smartSort')}
            </button>
            {/* Write button always visible */}
            <button onClick={handleWriteToSettings} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors disabled:opacity-50">
              <Save size={16} /> {t('loadOrder.writeSettings')}
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
              <Download size={14} /> {t('loadOrder.export')}
            </button>
            <button onClick={handleImport}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300">
              <Upload size={14} /> {t('loadOrder.import')}
            </button>
            <button onClick={loadData} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-gray-700 dark:text-gray-300">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Auto-write toggle */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">{t('loadOrder.writeSettingsToggle')}</span>
            <button onClick={toggleWriteSettings}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                writeToSettings ? 'bg-gray-900 dark:bg-gray-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                writeToSettings ? 'translate-x-[18px]' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {writeToSettings ? t('loadOrder.writeSettingsOn') : t('loadOrder.writeSettingsOff')}
          </span>
        </div>

      </div>

      {/* Load order list */}
      <div className="flex-1 overflow-y-auto px-8 pb-6">
        {loading && order.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader size={24} className="animate-spin text-gray-400" />
          </div>
        ) : order.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <ArrowUpDown size={32} className="mb-2" />
            <p className="text-sm">{t('loadOrder.noEnabledMods')}</p>
            <p className="text-xs mt-1">{t('loadOrder.noEnabledModsHint')}</p>
          </div>
        ) : (
          <div ref={listContainerRef} className="space-y-1 max-w-2xl">
            {order.map((modId, index) => {
              const mod = getMod(modId);
              const fw = isFramework(mod);
              const res = isResource(mod);
              const catColor = fw ? 'border-l-violet-400' :
                mod?.affects_gameplay ? 'border-l-blue-400' :
                res ? 'border-l-emerald-400' : 'border-l-gray-200';

              return (
                <div
                  key={modId}
                  data-drag-item
                  className={`flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 border-l-4 ${catColor} hover:shadow-sm transition-shadow group select-none ${
                    dragIndex === index ? 'opacity-50 ring-2 ring-indigo-400 shadow-lg z-10 relative' : ''
                  } ${dragIndex !== null ? 'transition-transform duration-150' : ''}`}
                >
                  <span
                    onMouseDown={(e) => handleGripMouseDown(e, index)}
                    className="text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0"
                  >
                    <GripVertical size={16} />
                  </span>
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500 w-6 flex-shrink-0">
                    #{index + 1}
                  </span>
                  {fw && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300 font-medium flex-shrink-0">
                      {t('modCard.catFrameworkShort')}
                    </span>
                  )}
                  {!fw && mod?.affects_gameplay && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 font-medium flex-shrink-0">
                      {t('modCard.catGameplayShort')}
                    </span>
                  )}
                  {res && !fw && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium flex-shrink-0">
                      {t('modCard.catResourceShort')}
                    </span>
                  )}
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100 truncate min-w-0">
                    {getModName(modId)}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => moveDown(index)}
                      disabled={index === order.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {order.length > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
            {t('loadOrder.dragHint')}
          </p>
        )}

        {/* Load order hash note */}
        {order.length > 0 && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
            {t('loadOrder.hashNote')}
          </p>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 transition-all ${
          toast.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}