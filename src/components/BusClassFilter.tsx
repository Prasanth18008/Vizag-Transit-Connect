import React, { useRef } from 'react';
import { BusClass, Language, Route, SavedSearch } from '../types/transit';
import { BUS_CLASSES } from '../utils/transitData';
import { getUniqueStops } from '../utils/transitLogic';
import { translations } from '../utils/translations';
import { Search, Filter, X, Check, Zap, RotateCcw, ArrowLeftRight, History, Plus } from 'lucide-react';

interface BusClassFilterProps {
  language: Language;
  selectedClasses: BusClass[];
  onToggleClass: (busClass: BusClass) => void;
  onClearClasses: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  originStopId: string;
  onOriginChange: (id: string) => void;
  destinationStopId: string;
  onDestinationChange: (id: string) => void;
  allRoutes: Route[];
  totalActiveBusesCount: number;
  filteredBusesCount: number;
  recentSearches: SavedSearch[];
  searchesInLastMinute: number;
  onExecuteSearch: (overrideParams?: {
    query?: string;
    originStopId?: string;
    destinationStopId?: string;
    selectedClasses?: BusClass[];
  }) => void;
  onApplySavedSearch: (saved: SavedSearch) => void;
  onResetAllSearch: () => void;
  onClearHistory: () => void;
}

export const BusClassFilter: React.FC<BusClassFilterProps> = ({
  language,
  selectedClasses,
  onToggleClass,
  onClearClasses,
  searchQuery,
  onSearchChange,
  originStopId,
  onOriginChange,
  destinationStopId,
  onDestinationChange,
  allRoutes,
  totalActiveBusesCount,
  filteredBusesCount,
  recentSearches,
  searchesInLastMinute,
  onExecuteSearch,
  onApplySavedSearch,
  onResetAllSearch,
  onClearHistory,
}) => {
  const t = translations[language];
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Deduplicated unique stops across all routes
  const allStopsList = getUniqueStops(allRoutes, language);

  const popularRoutes = [
    '10K', '500P', '500Y', '505', '52D', '52E', '52V/G', '540',
    '68/68K', '69', '6A/H', '700', '744', '900', '900K', '222',
    '25MR', '28A', '300C', '333', '38A'
  ];

  // Parse active comma-separated terms so users can toggle multiple routes at once or switch rapidly
  const activeTerms = searchQuery
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const handleRouteChipClick = (routeNo: string, appendMode: boolean) => {
    let nextQuery = routeNo;
    if (appendMode) {
      if (activeTerms.includes(routeNo)) {
        const remaining = activeTerms.filter((r) => r !== routeNo);
        nextQuery = remaining.join(', ');
      } else {
        nextQuery = [...activeTerms, routeNo].join(', ');
      }
    }
    onSearchChange(nextQuery);
    onExecuteSearch({ query: nextQuery });
  };

  const handleSwapStops = () => {
    const prevOrigin = originStopId;
    const prevDest = destinationStopId;
    onOriginChange(prevDest);
    onDestinationChange(prevOrigin);
    onExecuteSearch({ originStopId: prevDest, destinationStopId: prevOrigin });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExecuteSearch();
  };

  const handleNewSearchFocus = () => {
    onResetAllSearch();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(originStopId) ||
    Boolean(destinationStopId) ||
    selectedClasses.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 mb-6">
      
      {/* Section Title & Rapid Search Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Filter className="w-5 h-5 text-red-700" />
            <span>{t.filterByClass}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === 'te' 
              ? 'ఒకే నిమిషంలో ఎన్నిసార్లైనా వేగంగా రూట్లు, స్టాప్‌లు లేదా పలు బస్సు రకాలను శోధించండి'
              : language === 'hi'
              ? 'एक मिनट में जितनी बार चाहें उतनी बार रूट, स्टॉप और बस श्रेणियां तेजी से खोजें'
              : 'Instant multi-search enabled — run unlimited route, stop, and class searches per minute'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span
            data-testid="searches-per-minute-badge"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
            <span>
              {language === 'te'
                ? `ఈ నిమిషంలో శోధనలు: ${searchesInLastMinute}`
                : language === 'hi'
                ? `इस मिनट में खोजें: ${searchesInLastMinute}`
                : `Searches this min: ${searchesInLastMinute}`}
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              {filteredBusesCount}/{totalActiveBusesCount} {t.activeBusesCount}
            </span>
          </span>
        </div>
      </div>

      {/* Bus Class Selection Options (Multi-select) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {BUS_CLASSES.map((busClass) => {
          const isSelected = selectedClasses.includes(busClass.id);
          return (
            <button
              key={busClass.id}
              type="button"
              onClick={() => onToggleClass(busClass.id)}
              className={`p-3.5 rounded-xl border-2 text-left transition relative cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-red-600 bg-red-50/70 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                  style={{
                    backgroundColor: isSelected ? busClass.color : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#475569',
                  }}
                >
                  {busClass.code}
                </span>

                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                    isSelected
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'border-slate-300 bg-slate-100 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-900 leading-tight">
                  {busClass.title[language] || busClass.title.en}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {busClass.description[language] || busClass.description.en}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Clear selection chips if any active */}
      {selectedClasses.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-slate-500 font-medium">
            {language === 'te' ? 'ఎంపిక చేసిన రకాలు:' : language === 'hi' ? 'चयनित श्रेणियां:' : 'Filtered Classes:'}
          </span>
          <button
            type="button"
            onClick={onClearClasses}
            className="text-xs text-red-700 hover:text-red-900 font-bold underline flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t.resetFilters} ({t.allClasses})</span>
          </button>
        </div>
      )}

      {/* Search Form: Input, Origin, Destination & Rapid Action Buttons */}
      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 items-end">
        
        {/* Main Search Bar: Route number(s) or stop keyword */}
        <div className="md:col-span-5 relative">
          <label
            htmlFor="bus-route-search-input"
            className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider"
          >
            {language === 'te'
              ? 'రూట్ నంబర్ లేదా స్టాప్ వెతకండి (కామాతో బహుళ రూట్లు: 10K, 28A)'
              : language === 'hi'
              ? 'रूट नंबर या स्टॉप खोजें (एक से अधिक: 10K, 28A)'
              : 'Search Route No or Stop (Single or Multiple e.g. 10K, 28A)'}
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="bus-route-search-input"
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  if (searchInputRef.current) searchInputRef.current.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                aria-label="Clear search query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Origin Stop Filter */}
        <div className="md:col-span-2">
          <label
            htmlFor="origin-stop-select"
            className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider"
          >
            {t.filterOrigin}
          </label>
          <select
            id="origin-stop-select"
            value={originStopId}
            onChange={(e) => {
              onOriginChange(e.target.value);
              onExecuteSearch({ originStopId: e.target.value });
            }}
            className="w-full py-2.5 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-red-600 outline-none transition"
          >
            <option value="">{t.anyStop}</option>
            {allStopsList.map((stop) => (
              <option key={'from-' + stop.id} value={stop.id}>
                {stop.name}
              </option>
            ))}
          </select>
        </div>

        {/* Swap Origin & Destination Button */}
        <div className="md:col-span-1 flex justify-center">
          <button
            type="button"
            onClick={handleSwapStops}
            className="w-full md:w-10 h-10 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition cursor-pointer"
            title="Swap Origin and Destination Stops"
            aria-label="Swap Origin and Destination Stops"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>

        {/* Destination Stop Filter */}
        <div className="md:col-span-2">
          <label
            htmlFor="destination-stop-select"
            className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider"
          >
            {t.filterDestination}
          </label>
          <select
            id="destination-stop-select"
            value={destinationStopId}
            onChange={(e) => {
              onDestinationChange(e.target.value);
              onExecuteSearch({ destinationStopId: e.target.value });
            }}
            className="w-full py-2.5 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-red-600 outline-none transition"
          >
            <option value="">{t.anyStop}</option>
            {allStopsList.map((stop) => (
              <option key={'to-' + stop.id} value={stop.id}>
                {stop.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search Now & New Search Action Buttons */}
        <div className="md:col-span-2 flex items-center gap-1.5">
          <button
            type="submit"
            className="flex-1 bg-red-700 hover:bg-red-800 text-white font-bold py-2.5 px-3 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer text-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{language === 'te' ? 'వెతకండి' : language === 'hi' ? 'खोजें' : 'Search Now'}</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleNewSearchFocus}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition cursor-pointer"
              title="New Search / Reset All"
              aria-label="New Search"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

      </form>

      {/* Quick Route Shortcuts (Single click to switch, + button to combine routes) */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400 font-semibold mr-1">
            {language === 'te' ? 'ప్రముఖ రూట్లు (1-క్లిక్ వెతకండి):' : language === 'hi' ? 'प्रमुख रूट (तुरंत खोजें):' : 'Quick Route Search:'}
          </span>
          {popularRoutes.map((rNo) => {
            const isActive = activeTerms.includes(rNo);
            return (
              <div key={rNo} className="inline-flex items-center rounded-lg overflow-hidden border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleRouteChipClick(rNo, false)}
                  className={`px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-red-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {rNo}
                </button>
                <button
                  type="button"
                  onClick={() => handleRouteChipClick(rNo, true)}
                  className={`px-1.5 py-1 text-[10px] font-bold border-l transition cursor-pointer ${
                    isActive
                      ? 'bg-red-800 text-amber-200 border-red-600'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-200 border-slate-200'
                  }`}
                  title={`Add or toggle ${rNo} in multi-route search`}
                  aria-label={`Toggle ${rNo} in multi-route search`}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleNewSearchFocus}
            className="text-xs font-bold text-red-700 hover:text-red-900 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'te' ? 'కొత్త శోధన (New Search)' : language === 'hi' ? 'नई खोज (New Search)' : 'New Search (Clear All)'}</span>
          </button>
        )}
      </div>

      {/* Recent Searches Strip (Instant 1-Click Replay for Multiple Searches per Minute) */}
      {recentSearches.length > 0 && (
        <div
          data-testid="recent-searches-strip"
          className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mr-1">
              <History className="w-3.5 h-3.5 text-red-700" />
              <span>
                {language === 'te'
                  ? 'ఇటీవలి శోధనలు (1-క్లిక్ మార్పు):'
                  : language === 'hi'
                  ? 'हाल की खोजें (तुरंत बदलें):'
                  : 'Recent Searches (Instant Switch):'}
              </span>
            </span>

            {recentSearches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onApplySavedSearch(item)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-slate-800 border border-amber-200 transition cursor-pointer"
              >
                <span>{item.label}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white text-emerald-700 border border-amber-200">
                  {item.resultCount}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClearHistory}
            className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
          >
            {language === 'te' ? 'చరిత్ర క్లియర్' : language === 'hi' ? 'इतिहास मिटाएं' : 'Clear History'}
          </button>
        </div>
      )}

    </div>
  );
};
