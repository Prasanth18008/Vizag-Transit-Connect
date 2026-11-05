import React, { useState, useEffect } from 'react';
import { 
  Language, 
  BusClass, 
  UserProfile, 
  ActiveBus, 
  Route, 
  PassengerReport,
  SavedSearch
} from './types/transit';
import { VIZAG_ROUTES, INITIAL_ACTIVE_BUSES } from './utils/transitData';
import { translations } from './utils/translations';
import { 
  filterBuses, 
  stepBusGPS, 
  addPassengerReportToBus,
  recordRapidSearch,
  getSearchesInLastMinuteCount,
  getUniqueStops
} from './utils/transitLogic';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { BusClassFilter } from './components/BusClassFilter';
import { NextAvailableBusesList } from './components/NextAvailableBusesList';
import { LiveTrackingView } from './components/LiveTrackingView';
import { PassengerReportModal } from './components/PassengerReportModal';
import { BusScheduleTable } from './components/BusScheduleTable';
import { SpeedControlTable } from './components/SpeedControlTable';
import { PublicTransportRouteMap } from './components/PublicTransportRouteMap';
import { Bus, Phone, ShieldCheck, Calendar, Map as MapIcon, Layers } from 'lucide-react';

export default function App() {
  // Read query params for ?autostart=1 or initial state
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const autostart = urlParams.get('autostart') === '1';

  // State: GPS Simulation Speed (1x, 2x, 10x)
  const [simSpeed, setSimSpeed] = useState<number>(1);

  // State: Main Navigation View: Fleet arrivals, Public Transport Route Map, or Schedules
  const [activeMainTab, setActiveMainTab] = useState<'fleet' | 'network_map' | 'schedules'>('fleet');

  // State: Language & Accessibility
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('apsrtc_lang');
    return (saved as Language) || 'en';
  });
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [audioAnnouncements, setAudioAnnouncements] = useState(true);

  // State: User Auth
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (autostart) {
      return {
        id: 'autostart-usr',
        name: 'Vizag Commuter (Auto)',
        phone: '9848012345',
        isLoggedIn: true,
        preferredLanguage: 'en',
      };
    }
    const saved = localStorage.getItem('apsrtc_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // State: Bus Filter & Search
  const [selectedClasses, setSelectedClasses] = useState<BusClass[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [originStopId, setOriginStopId] = useState('');
  const [destinationStopId, setDestinationStopId] = useState('');
  const [recentSearches, setRecentSearches] = useState<SavedSearch[]>([]);
  const [searchTimestamps, setSearchTimestamps] = useState<number[]>([]);

  // State: Live Transit Fleet & Selection
  const [routes] = useState<Route[]>(VIZAG_ROUTES);
  const [buses, setBuses] = useState<ActiveBus[]>(INITIAL_ACTIVE_BUSES);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);

  // State: Real-Time 1-Second Live GPS Telematics Heartbeat
  const [gpsCountdown, setGpsCountdown] = useState<number>(1);

  // State: Modal for Passenger Reporting
  const [reportModalBus, setReportModalBus] = useState<ActiveBus | null>(null);

  // State: View schedule timetable (default to Route 10K for instant schedule view)
  const [viewScheduleRouteId, setViewScheduleRouteId] = useState<string | null>('route-10k');

  const t = translations[language];
  const uniqueStops = getUniqueStops(routes, language);

  const lookupStopName = (stopId: string) => {
    const found = uniqueStops.find((s) => s.id === stopId);
    return found ? found.name : stopId;
  };

  // Save language preference
  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('apsrtc_lang', lang);
  };

  // Login handler
  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    localStorage.setItem('apsrtc_user', JSON.stringify(loggedInUser));
  };

  // Logout handler
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('apsrtc_user');
    setSelectedBusId(null);
  };

  // Execute & record a rapid search (unlimited searches per minute)
  const handleExecuteSearch = (overrideParams?: {
    query?: string;
    originStopId?: string;
    destinationStopId?: string;
    selectedClasses?: BusClass[];
  }) => {
    const q = overrideParams?.query !== undefined ? overrideParams.query : searchQuery;
    const orig = overrideParams?.originStopId !== undefined ? overrideParams.originStopId : originStopId;
    const dest = overrideParams?.destinationStopId !== undefined ? overrideParams.destinationStopId : destinationStopId;
    const cls = overrideParams?.selectedClasses !== undefined ? overrideParams.selectedClasses : selectedClasses;

    const { buses: matched } = filterBuses(buses, routes, cls, q, orig, dest);
    const now = Date.now();

    setSearchTimestamps((prev) => [...prev.filter((ts) => now - ts <= 60_000), now]);
    setRecentSearches((prev) =>
      recordRapidSearch(
        prev,
        {
          query: q,
          selectedClasses: cls,
          originStopId: orig,
          destinationStopId: dest,
          resultCount: matched.length,
          stopNameLookup: lookupStopName,
        },
        now
      )
    );
  };

  // Bus class toggle handler
  const handleToggleClass = (busClass: BusClass) => {
    const nextClasses = selectedClasses.includes(busClass)
      ? selectedClasses.filter((c) => c !== busClass)
      : [...selectedClasses, busClass];
    setSelectedClasses(nextClasses);
    handleExecuteSearch({ selectedClasses: nextClasses });
  };

  const handleClearClasses = () => {
    setSelectedClasses([]);
    handleExecuteSearch({ selectedClasses: [] });
  };

  const handleApplySavedSearch = (saved: SavedSearch) => {
    setSearchQuery(saved.query);
    setSelectedClasses(saved.selectedClasses);
    setOriginStopId(saved.originStopId);
    setDestinationStopId(saved.destinationStopId);
    setSelectedBusId(null);
    const now = Date.now();
    setSearchTimestamps((prev) => [...prev.filter((ts) => now - ts <= 60_000), now]);
  };

  const handleResetAllSearch = () => {
    setSearchQuery('');
    setSelectedClasses([]);
    setOriginStopId('');
    setDestinationStopId('');
    setSelectedBusId(null);
  };

  const handleClearHistory = () => {
    setRecentSearches([]);
  };

  const handleQuickSearchFromLiveView = (query: string) => {
    setSearchQuery(query);
    setSelectedBusId(null);
    handleExecuteSearch({ query });
  };

  // Real-Time GPS Telematics Timer Loop (Updates every second with simSpeed multiplier: 1x, 2x, 10x)
  useEffect(() => {
    const timer = setInterval(() => {
      // Step all active GPS buses every single second (advancing by simSpeed elapsed seconds)
      setBuses((currentBuses) =>
        currentBuses.map((bus) => {
          const route = routes.find((r) => r.id === bus.routeId) || routes[0];
          return stepBusGPS(bus, route, simSpeed);
        })
      );
      setGpsCountdown(1);
    }, 1000);

    return () => clearInterval(timer);
  }, [routes, simSpeed]);

  // Selected bus reference
  const selectedBus = buses.find((b) => b.id === selectedBusId) || null;
  const selectedRoute = selectedBus ? routes.find((r) => r.id === selectedBus.routeId) : null;

  // Filtered buses based on class selection, route number, and stops
  const { buses: filteredBuses } = filterBuses(
    buses,
    routes,
    selectedClasses,
    searchQuery,
    originStopId,
    destinationStopId
  );

  const searchesInLastMinute = getSearchesInLastMinuteCount(searchTimestamps);

  // Handle passenger report submission
  const handlePassengerReport = (report: PassengerReport) => {
    setBuses((currentBuses) =>
      currentBuses.map((bus) => {
        if (bus.id === report.busId) {
          return addPassengerReportToBus(bus, report);
        }
        return bus;
      })
    );
  };

  // If user is not logged in, show initial User Login Screen
  if (!user || !user.isLoggedIn) {
    return (
      <div className={`${highContrast ? 'high-contrast' : ''} ${largeText ? 'text-lg' : ''}`}>
        <AuthModal
          language={language}
          onLanguageChange={handleLanguageChange}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-slate-100 flex flex-col text-slate-900 transition-colors ${
        highContrast ? 'high-contrast bg-black text-white' : ''
      } ${largeText ? 'text-base sm:text-lg' : 'text-sm'}`}
    >
      {/* Top Header */}
      <Header
        language={language}
        onLanguageChange={handleLanguageChange}
        user={user}
        onLogout={handleLogout}
        gpsCountdown={gpsCountdown}
        highContrast={highContrast}
        onToggleHighContrast={() => setHighContrast(!highContrast)}
        largeText={largeText}
        onToggleLargeText={() => setLargeText(!largeText)}
        audioAnnouncements={audioAnnouncements}
        onToggleAudioAnnouncements={() => setAudioAnnouncements(!audioAnnouncements)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* If a bus is selected, show the Live Tracking View */}
        {selectedBus && selectedRoute ? (
          <LiveTrackingView
            bus={selectedBus}
            route={selectedRoute}
            language={language}
            onBack={() => setSelectedBusId(null)}
            gpsCountdown={gpsCountdown}
            onOpenReportModal={() => setReportModalBus(selectedBus)}
            onQuickSearch={handleQuickSearchFromLiveView}
            simSpeed={simSpeed}
            onSpeedChange={setSimSpeed}
          />
        ) : (
          /* Otherwise show Bus Class Filters and Next Available Buses */
          <>
            {/* Main Navigation View Switcher: Fleet Arrivals vs Public Transport Route Map vs Timetables */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveMainTab('fleet')}
                  className={`px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer ${
                    activeMainTab === 'fleet'
                      ? 'bg-red-700 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Bus className="w-4 h-4" />
                  <span>
                    {language === 'te' ? 'బస్సుల లైవ్ ట్రాకింగ్ & రాకలు' : language === 'hi' ? 'लाइव बसें एवं आगमन' : 'Live Fleet & Bus Arrivals'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab('network_map')}
                  className={`px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer ${
                    activeMainTab === 'network_map'
                      ? 'bg-red-700 text-white shadow-md ring-2 ring-amber-400/50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <MapIcon className="w-4 h-4 text-amber-400" />
                  <span>
                    {language === 'te' ? 'ప్రజా రవాణా రూట్ మ్యాప్' : language === 'hi' ? 'सार्वजनिक परिवहन मार्ग मानचित्र' : 'Public Transport Route Map'}
                  </span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-red-950">
                    49 Lines
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab('schedules')}
                  className={`px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer ${
                    activeMainTab === 'schedules'
                      ? 'bg-red-700 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>
                    {language === 'te' ? 'APSRTC టైమ్‌టేబుల్' : language === 'hi' ? 'समय सारिणी' : 'Official Timetables'}
                  </span>
                </button>
              </div>

              {activeMainTab === 'fleet' && (
                <button
                  type="button"
                  onClick={() => setActiveMainTab('network_map')}
                  className="hidden md:flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-800 cursor-pointer px-3 py-1.5 rounded-xl hover:bg-red-50 border border-red-200 transition"
                >
                  <MapIcon className="w-4 h-4" />
                  <span>{language === 'te' ? 'మ్యాప్‌లో అన్ని లైన్లు చూడండి ➔' : 'View All 49 Lines on Map ➔'}</span>
                </button>
              )}
            </div>

            {/* View 1: Public Transport Route Map (All-Corridor Interactive Network Map) */}
            {activeMainTab === 'network_map' && (
              <div className="space-y-6">
                <PublicTransportRouteMap
                  routes={routes}
                  activeBuses={buses}
                  language={language}
                  onSelectBus={(bus) => {
                    setSelectedBusId(bus.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onSelectRoute={(route) => {
                    setViewScheduleRouteId(route.id);
                  }}
                  simSpeed={simSpeed}
                  onSpeedChange={setSimSpeed}
                />

                {/* GPS Telematics Speed Controller Table (1x, 2x, 10x) */}
                <SpeedControlTable
                  simSpeed={simSpeed}
                  onSpeedChange={setSimSpeed}
                  language={language}
                />
              </div>
            )}

            {/* View 2: Live Bus Fleet & Arrivals Search */}
            {activeMainTab === 'fleet' && (
              <>
                {/* Banner inviting commuters to explore Public Transport Map */}
                <div className="bg-gradient-to-r from-red-800 via-amber-700 to-red-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-amber-400/40">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
                      <MapIcon className="w-6 h-6 text-amber-300" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-white">
                        {language === 'te' ? 'గ్రేటర్ విశాఖపట్నం ప్రజా రవాణా రూట్ మ్యాప్' : 'Greater Visakhapatnam Public Transport Network Map'}
                      </h3>
                      <p className="text-xs text-amber-100 mt-0.5">
                        {language === 'te' ? '49 కారిడార్లు, 8 కీలక బస్ స్టేషన్లు మరియు లైవ్ బస్సులను ఒకే మ్యాప్‌లో వీక్షించండి' : 'Interactive full-city transit map covering all 49 routes, interchanges, and live GPS fleet'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveMainTab('network_map')}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-red-950 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <span>{language === 'te' ? 'రూట్ మ్యాప్ తెరవండి' : 'Open Transit Route Map'}</span>
                    <span>➔</span>
                  </button>
                </div>

                {/* Bus Type Filter & Route Search */}
                <BusClassFilter
                  language={language}
                  selectedClasses={selectedClasses}
                  onToggleClass={handleToggleClass}
                  onClearClasses={handleClearClasses}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  originStopId={originStopId}
                  onOriginChange={setOriginStopId}
                  destinationStopId={destinationStopId}
                  onDestinationChange={setDestinationStopId}
                  allRoutes={routes}
                  totalActiveBusesCount={buses.length}
                  filteredBusesCount={filteredBuses.length}
                  recentSearches={recentSearches}
                  searchesInLastMinute={searchesInLastMinute}
                  onExecuteSearch={handleExecuteSearch}
                  onApplySavedSearch={handleApplySavedSearch}
                  onResetAllSearch={handleResetAllSearch}
                  onClearHistory={handleClearHistory}
                />

                {/* GPS Telematics Simulation Speed Controller Table (1x, 2x, 10x) */}
                <div className="mb-6">
                  <SpeedControlTable
                    simSpeed={simSpeed}
                    onSpeedChange={setSimSpeed}
                    language={language}
                  />
                </div>

                {/* Next Available Buses List */}
                <NextAvailableBusesList
                  buses={filteredBuses}
                  routes={routes}
                  language={language}
                  selectedBusId={selectedBusId}
                  onSelectBus={(bus) => setSelectedBusId(bus.id)}
                  onOpenReportModal={(bus) => setReportModalBus(bus)}
                />
              </>
            )}

            {/* View 3: Official Schedules & Timetables */}
            {(activeMainTab === 'schedules' || activeMainTab === 'fleet') && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8 mt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-red-700" />
                    <h3 className="font-extrabold text-base text-slate-900">
                      {language === 'te' 
                        ? 'APSRTC అధికారిక టైమ్‌టేబుల్ & షెడ్యూల్ చూడండి' 
                        : language === 'hi'
                        ? 'APSRTC आधिकारिक समय सारिणी देखें'
                        : 'APSRTC Official Schedule & Timetable Lookup'}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {routes.slice(0, 15).map((r) => (
                      <button
                        key={'btn-' + r.id}
                        type="button"
                        onClick={() =>
                          setViewScheduleRouteId(viewScheduleRouteId === r.id ? null : r.id)
                        }
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                          viewScheduleRouteId === r.id
                            ? 'bg-red-700 text-white border-red-700'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        Route {r.routeNumber}
                      </button>
                    ))}
                  </div>
                </div>

                {viewScheduleRouteId && (
                  <div className="mt-4">
                    {(() => {
                      const r = routes.find((item) => item.id === viewScheduleRouteId);
                      return r ? (
                        <BusScheduleTable 
                          route={r} 
                          language={language} 
                          activeBuses={buses}
                          onSelectBus={(bus) => {
                            setSelectedBusId(bus.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        />
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </main>

      {/* Passenger Grievance & Crowd Report Modal */}
      {reportModalBus && (
        <PassengerReportModal
          bus={reportModalBus}
          language={language}
          isOpen={true}
          onClose={() => setReportModalBus(null)}
          onSubmitReport={handlePassengerReport}
          userName={user.name}
        />
      )}

      {/* Footer with APSRTC Visakhapatnam Helpline Information */}
      <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 py-8 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-700 text-white flex items-center justify-center font-bold shadow-md">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white">
                {t.appName}
              </h4>
              <p className="text-xs text-slate-400">
                Andhra Pradesh State Road Transport Corporation • Visakhapatnam Zone
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-amber-400" />
              <span>Dwaraka Bus Station (RTC Complex): <strong>0891-2746400</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Women & Passenger Safety Helpline: <strong>112 / 1091</strong></span>
            </div>
          </div>

          <div className="text-xs text-slate-400 text-center md:text-right">
            <span>Live Satellite GPS Telematics • Real-Time Commuter Portal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
