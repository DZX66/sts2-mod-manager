import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, ChevronDown } from 'lucide-react';
import { useT } from '../i18n/I18nContext';

function isErrorLine(line) {
  return line.includes('[ERROR]') || line.trimStart().startsWith('ERROR');
}

function isWarnLine(line) {
  return line.includes('[WARN]') || line.trimStart().startsWith('WARNING');
}

function colorLine(line) {
  if (isErrorLine(line)) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950';
  if (isWarnLine(line)) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950';
  if (line.includes('[INFO]')) return 'text-gray-600 dark:text-gray-400';
  return 'text-gray-400 dark:text-gray-600';
}

const MAX_VISIBLE_LINES = 2000;

export default function LogViewer() {
  const { t } = useT();
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [content, setContent] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MAX_VISIBLE_LINES);

  const loadLogs = async () => {
    setLoading(true);
    const data = await window.api.getLatestLogs();
    setFiles(data.files);
    setContent(data.content);
    if (data.files.length > 0) setSelectedFile(data.files[0]);
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const handleFileChange = async (fileName) => {
    setSelectedFile(fileName);
    setLoading(true);
    setVisibleCount(MAX_VISIBLE_LINES);
    const c = await window.api.readLog(fileName);
    setContent(c);
    setLoading(false);
  };

  const lines = content.split('\n').filter(line => {
    if (filterLevel === 'error' && !isErrorLine(line)) return false;
    if (filterLevel === 'warn' && !isWarnLine(line) && !isErrorLine(line)) return false;
    if (search && !line.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const errorCount = content.split('\n').filter(l => isErrorLine(l)).length;
  const warnCount = content.split('\n').filter(l => isWarnLine(l)).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-gray-100">{t('logViewer.title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {errorCount > 0 && <span className="text-red-500 font-medium">{t('logViewer.errors', { count: errorCount })}</span>}
              {errorCount > 0 && warnCount > 0 && ' · '}
              {warnCount > 0 && <span className="text-amber-500 font-medium">{t('logViewer.warnings', { count: warnCount })}</span>}
              {errorCount === 0 && warnCount === 0 && t('logViewer.noIssues')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadLogs}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {t('logViewer.refresh')}
            </button>
            <button onClick={() => window.api.openLogsDir()}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <FileText size={16} /> {t('logViewer.openFolder')}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* File selector */}
          <div className="relative">
            <select value={selectedFile} onChange={(e) => handleFileChange(e.target.value)}
              className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-100">
              {files.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Filter */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {[['all', t('logViewer.filterAll')], ['warn', t('logViewer.filterWarn')], ['error', t('logViewer.filterError')]].map(([key, label]) => (
              <button key={key}
                onClick={() => setFilterLevel(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterLevel === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('logViewer.searchPlaceholder')}
            className="flex-1 max-w-xs px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-y-auto px-8 pb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="font-mono text-xs leading-6 dark:text-gray-300">
            {lines.slice(0, visibleCount).map((line, i) => (
              <div key={i} className={`px-4 py-0.5 border-b border-gray-50 dark:border-gray-700 ${colorLine(line)}`}>
                <span className="text-gray-300 mr-3 select-none">{String(i + 1).padStart(3, ' ')}</span>
                {line}
              </div>
            ))}
            {lines.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(c => c + MAX_VISIBLE_LINES)}
                className="w-full px-4 py-3 text-center text-sm text-blue-600 hover:bg-blue-50 transition-colors">
                {t('logViewer.loadMore', { count: lines.length - visibleCount })}
              </button>
            )}
            {lines.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400">{t('logViewer.noContent')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
