import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Tag } from 'lucide-react';
import ReactDOM from 'react-dom';

const DEFAULT_COLORS = {
  '默认': '#6366f1',
};

// Colors that can be assigned to tags
const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#f43f5e',
];

// Light background versions for display
function getColorStyle(color) {
  if (!color) return { bg: '#f0f0ff', text: '#6366f1', border: '#e0e0ff' };
  return {
    bg: color + '18',
    text: color,
    border: color + '30',
  };
}

export default function ModTags({ modId, t, onTagsChanged }) {
  const [allData, setAllData] = useState({ modTags: {}, tagColors: {} });
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [filterText, setFilterText] = useState('');
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const inputRef = useRef(null);
  const buttonRef = useRef(null);

  // Load tags data
  const loadTags = useCallback(async () => {
    try {
      if (window.api.tagsLoad) {
        const data = await window.api.tagsLoad();
        setAllData(data);
      }
    } catch (e) {
      console.error('Failed to load tags:', e);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags, modId]);

  // Save tags data
  const saveTags = async (data) => {
    try {
      if (window.api.tagsSave) {
        await window.api.tagsSave(data);
      }
    } catch (e) {
      console.error('Failed to save tags:', e);
    }
  };

  const modTags = allData.modTags?.[modId] || [];
  const tagColors = allData.tagColors || {};

  // Get all unique tag names across all mods
  const allUsedTags = allData.modTags
    ? [...new Set(Object.values(allData.modTags).flat())]
    : [];
  
  // Filter tags based on input
  const filteredTags = inputValue
    ? allUsedTags.filter(tag =>
        tag.toLowerCase().includes(inputValue.toLowerCase()) &&
        !modTags.includes(tag)
      )
    : allUsedTags.filter(tag => !modTags.includes(tag));

  // Also filter by filterText (for when popup is already open)
  const displayTags = filterText
    ? filteredTags.filter(tag =>
        tag.toLowerCase().includes(filterText.toLowerCase())
      )
    : filteredTags;

  const handleAddTag = async (tagName) => {
    const name = (tagName || inputValue).trim();
    if (!name) return;

    const newModTags = { ...(allData.modTags || {}) };
    const currentTags = [...(newModTags[modId] || [])];
    if (!currentTags.includes(name)) {
      currentTags.push(name);
    }
    newModTags[modId] = currentTags;

    // Assign default color if not already assigned
    const newTagColors = { ...(allData.tagColors || {}) };
    if (!newTagColors[name]) {
      const usedColors = Object.values(newTagColors);
      const available = PRESET_COLORS.find(c => !usedColors.includes(c));
      newTagColors[name] = available || PRESET_COLORS[0];
    }

    const newData = { modTags: newModTags, tagColors: newTagColors };
    setAllData(newData);
    await saveTags(newData);
    setInputValue('');
    setFilterText('');
    setIsAdding(false);
    if (onTagsChanged) onTagsChanged();
  };

  const handleRemoveTag = async (tagName) => {
    const newModTags = { ...(allData.modTags || {}) };
    const currentTags = [...(newModTags[modId] || [])];
    newModTags[modId] = currentTags.filter(t => t !== tagName);

    const newData = { modTags: newModTags, tagColors: allData.tagColors || {} };
    setAllData(newData);
    await saveTags(newData);
    if (onTagsChanged) onTagsChanged();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        handleAddTag(inputValue.trim());
      }
    }
  };

  const openPopup = (e) => {
    e.stopPropagation();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 224) });
    }
    setIsAdding(true);
    setInputValue('');
    setFilterText('');
  };

  // Close popup on outside click
  useEffect(() => {
    if (!isAdding) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        // Check if click is on the popup
        const popupEl = document.getElementById('modtags-popup');
        if (popupEl && !popupEl.contains(e.target)) {
          setIsAdding(false);
          setInputValue('');
          setFilterText('');
        } else if (!popupEl) {
          setIsAdding(false);
          setInputValue('');
          setFilterText('');
        }
      }
    };
    // Use mousedown on document
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAdding]);

  // Focus input when popup opens
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {modTags.map(tagName => {
          const color = tagColors[tagName];
          const cs = getColorStyle(color);
          return (
            <span
              key={tagName}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium group/tag"
              style={{ backgroundColor: cs.bg, color: cs.text, border: `1px solid ${cs.border}` }}
            >
              <Tag size={10} />
              {tagName}
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveTag(tagName); }}
                className="opacity-0 group-hover/tag:opacity-100 transition-opacity hover:opacity-70"
                title={t('modDetail.removeTag')}
              >
                <X size={10} />
              </button>
            </span>
          );
        })}
        <button
          ref={buttonRef}
          onClick={openPopup}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
          title={t('modDetail.addTag')}
        >
          <Plus size={12} />
        </button>
      </div>

      {isAdding && ReactDOM.createPortal(
        <div
          id="modtags-popup"
          className="fixed z-[9999] w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
          style={{ top: popupPos.top, left: popupPos.left, maxHeight: '280px' }}
        >
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setFilterText(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder={t('modDetail.tagInputPlaceholder')}
              className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-gray-300 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          {displayTags.length > 0 && (
            <div className="max-h-40 overflow-y-auto border-t border-gray-50 dark:border-gray-700">
              {displayTags.map(tagName => {
                const color = tagColors[tagName];
                const cs = getColorStyle(color);
                return (
                  <button
                    key={tagName}
                    onClick={(e) => { e.stopPropagation(); handleAddTag(tagName); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Tag size={11} style={{ color: cs.text }} />
                    <span>{tagName}</span>
                  </button>
                );
              })}
            </div>
          )}
          {inputValue.trim() && !allUsedTags.includes(inputValue.trim()) && (
            <div className="border-t border-gray-50 dark:border-gray-700 p-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleAddTag(inputValue.trim()); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
              >
                <Plus size={11} />
                {t('modDetail.tagCreateNew', { name: inputValue.trim() })}
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// Export utility functions for use in other components
export function getModTags(allData, modId) {
  return allData?.modTags?.[modId] || [];
}

export function getTagColor(allData, tagName) {
  return allData?.tagColors?.[tagName] || '#6366f1';
}

export function getDefaultTagStyle(color) {
  if (!color) return { bg: '#f0f0ff', text: '#6366f1', border: '#e0e0ff' };
  return {
    bg: color + '18',
    text: color,
    border: color + '30',
  };
}

// Load tags data for external use
export async function loadTagsData() {
  try {
    if (window.api.tagsLoad) {
      return await window.api.tagsLoad();
    }
  } catch (e) {
    console.error('Failed to load tags:', e);
  }
  return { modTags: {}, tagColors: {} };
}