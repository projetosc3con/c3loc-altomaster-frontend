import { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface SearchableSelectProps<T> {
  label: string;
  placeholder: string;
  searchPlaceholder?: string;
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  getDisplayValue: (item: T) => string;
  getSearchValue: (item: T) => string;
  getSubtext?: (item: T) => string;
  getTriggerDisplayValue?: (item: T) => string;
  required?: boolean;
  disabled?: boolean;
  labelClassName?: string;
  triggerClassName?: string;
  clearable?: boolean;
}

function SearchableSelect<T extends { id: string }>({
  label,
  placeholder,
  searchPlaceholder = 'Pesquisar...',
  items,
  selectedId,
  onSelect,
  getDisplayValue,
  getSearchValue,
  getSubtext,
  getTriggerDisplayValue,
  required,
  disabled,
  labelClassName,
  triggerClassName,
  clearable
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const lowerSearch = searchTerm.toLowerCase().trim();
    const searchDigits = searchTerm.replace(/\D/g, '');
    return items.filter(item => {
      const searchValue = getSearchValue(item);
      const matchSearchValue = searchValue.toLowerCase().includes(lowerSearch);
      const itemDigits = searchValue.replace(/\D/g, '');
      const matchDigits = searchDigits.length >= 2 && itemDigits.includes(searchDigits);

      const modelMatch = ('model' in item) && String((item as any).model).toLowerCase().includes(lowerSearch);
      const heightMatch = ('height' in item) && String((item as any).height).toLowerCase().includes(lowerSearch);

      return matchSearchValue || matchDigits || modelMatch || heightMatch;
    });
  }, [items, searchTerm, getSearchValue]);

  const selectedItem = useMemo(() =>
    items.find(i => i.id === selectedId),
    [items, selectedId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      <label className={labelClassName || "text-xs font-bold text-slate-500 uppercase tracking-widest ml-1"}>
        {label} {required && '*'}
      </label>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={triggerClassName
          ? `${triggerClassName} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${isOpen ? 'border-mustard-500 ring-2 ring-mustard-500/20 dark:bg-slate-900' : ''}`
          : `w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl flex items-center justify-between transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${isOpen ? 'border-mustard-500 ring-2 ring-mustard-500/10 dark:bg-slate-900' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`
        }
      >
        <span className={`text-sm truncate ${selectedItem ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
          {selectedItem
            ? (getTriggerDisplayValue
                ? getTriggerDisplayValue(selectedItem)
                : `${getDisplayValue(selectedItem)}${('model' in selectedItem) && (selectedItem as any).model ? ` | ${(selectedItem as any).model}` : ''}${('height' in selectedItem) && (selectedItem as any).height ? ` - Altura: ${(selectedItem as any).height}m` : ''}`)
            : placeholder}
        </span>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {clearable && selectedItem && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect('');
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Limpar seleção"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
          <span className={`material-symbols-outlined text-slate-400 dark:text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">search</span>
                <input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-mustard-500 transition-all dark:text-white"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => {
                  const subtext = getSubtext ? getSubtext(item) : getSearchValue(item);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelect(item.id);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className={`px-4 py-2.5 text-xs cursor-pointer hover:bg-mustard-50 dark:hover:bg-mustard-500/10 transition-colors flex flex-col gap-0.5 ${selectedId === item.id ? 'bg-mustard-50/50 dark:bg-mustard-500/20 border-l-4 border-mustard-500' : 'border-l-4 border-transparent'}`}
                    >
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {getDisplayValue(item)}
                        {('model' in item) && (item as any).model && ` | ${(item as any).model}`}
                      </span>
                      <div className="flex justify-between items-center w-full">
                        {subtext && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                            {subtext}
                          </span>
                        )}
                        {('height' in item) && (item as any).height && (
                          <span className="text-[10px] text-mustard-600 dark:text-mustard-455 font-semibold shrink-0 ml-2">
                            Altura: {(item as any).height}m
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 italic">Nenhum resultado encontrado.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SearchableSelect;
