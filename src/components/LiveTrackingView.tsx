import React, { useState, useMemo } from 'react';
import { ActiveBus, Language, Route } from '../types/transit';
import { translations } from '../utils/translations';
import { BUS_CLASSES } from '../utils/transitData';
import { getUpcomingStops, generateBusDaySchedule } from '../utils/transitLogic';
import { LiveRouteMap } from './LiveRouteMap';
import { SpeedControlTable } from './SpeedControlTable';
import { 
  ArrowLeft, 
  Bus, 
  MapPin, 
  Clock, 
  Radio, 
  Users, 
  ShieldCheck, 
  Volume2, 
  AlertTriangle, 
  Award, 
  Gauge, 
  Phone, 
  Sparkles,
  CheckCircle2,
  Share2,
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  Coffee,
  Compass
} from 'lucide-react';

interface LiveTrackingViewProps {
  bus: ActiveBus;
  route: Route;
  language: Language;
  onBack: () => void;
  gpsCountdown: number; // 0-10 seconds
  onOpenReportModal: () => void;
  onQuickSearch?: (query: string) => void;
  simSpeed?: number;
  onSpeedChange?: (speed: number) => void;
}

export const LiveTrackingView: React.FC<LiveTrackingViewProps> = ({
  bus,
  route,
  language,
  onBack,
  gpsCountdown,
  onOpenReportModal,
  onQuickSearch,
  simSpeed,
  onSpeedChange,
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'map' | 'schedule' | 'duty'>('map');
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [speechActive, setSpeechActive] = useState(false);
  const [inlineQuery, setInlineQuery] = useState('');

  const daySchedule = useMemo(() => generateBusDaySchedule(bus, route), [bus, route]);

  const busClassInfo = BUS_CLASSES.find((c) => c.id === bus.busClass) || BUS_CLASSES[0];
  const upcomingStops = getUpcomingStops(route, bus.currentStopIndex, bus.segmentProgress, bus.speedKmH);
  const currentStop = route.stops[bus.currentStopIndex] || route.stops[0];
  const nextStop = route.stops[Math.min(bus.currentStopIndex + 1, route.stops.length - 1)] || route.stops[0];

  // Text to speech announcement in Telugu / English / Hindi
  const handleAudioAnnouncement = () => {
    if (!('speechSynthesis' in window)) return;
    
    setSpeechActive(true);
    const stopName = nextStop.name[language] || nextStop.name.en;
    let announcementText = '';

    if (language === 'te') {
      announcementText = `బస్సు నంబర్ ${bus.routeNumber}. తదుపరి బస్ స్టాప్ ${stopName}. దయచేసి దిగడానికి సిద్ధంగా ఉండండి.`;
    } else if (language === 'hi') {
      announcementText = `बस संख्या ${bus.routeNumber}. अगला बस स्टॉप ${stopName}. कृपया उतरने के लिए तैयार रहें।`;
    } else {
      announcementText = `Bus number ${bus.routeNumber}. Next bus stop is ${stopName}. Please prepare to deboard.`;
    }

    const utterance = new SpeechSynthesisUtterance(announcementText);
    utterance.rate = 0.95;
    if (language === 'te') utterance.lang = 'te-IN';
    else if (language === 'hi') utterance.lang = 'hi-IN';
    else utterance.lang = 'en-IN';

    utterance.onend = () => setSpeechActive(false);
    utterance.onerror = () => setSpeechActive(false);

    window.speechSynthesis.speak(utterance);
  };

  const getCrowdLabel = () => {
    switch (bus.crowdLevel) {
      case 'low': return t.crowdLow;
      case 'moderate': return t.crowdModerate;
      case 'standing': return t.crowdStanding;
      case 'heavy': return t.crowdHeavy;
      default: return t.crowdModerate;
    }
  };

  const handleInlineSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onQuickSearch) {
      onQuickSearch(inlineQuery.trim());
    } else {
      onBack();
    }
  };

  return (
    <div className="space-y-6 mb-12">
      
      {/* Top Navigation, Quick New Search & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-red-700 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.backToBuses}</span>
          </button>

          {onQuickSearch && (
            <form onSubmit={handleInlineSearchSubmit} className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inlineQuery}
                  onChange={(e) => setInlineQuery(e.target.value)}
                  placeholder="Quick search another route/stop..."
                  aria-label="Quick search another route or stop"
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-red-600 outline-none w-52 sm:w-64"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Search
              </button>
            </form>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Audio Speech Announcement Button */}
          <button
            type="button"
            onClick={handleAudioAnnouncement}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition cursor-pointer ${
              speechActive
                ? 'bg-amber-400 text-red-950 border-amber-500 shadow-sm animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
            title={t.announceStop}
          >
            <Volume2 className="w-4 h-4 text-red-700" />
            <span>{speechActive ? t.audioPlaying : t.announceStop}</span>
          </button>

          {/* Grievance & Reporting Button */}
          <button
            type="button"
            onClick={onOpenReportModal}
            className="px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <span>{t.reportIssueBtn}</span>
          </button>
        </div>
      </div>

      {/* Primary Tracking Telematics Header Card */}
      <div className="bg-gradient-to-br from-red-900 via-red-800 to-amber-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-red-700 relative overflow-hidden">
        
        {/* Subtle decorative bus watermark */}
        <div className="absolute right-4 -bottom-6 opacity-10 pointer-events-none">
          <Bus className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10">
          
          {/* Top row: Route Number, Reg No, 10s GPS Sync status */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b border-red-700/60">
            
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white text-red-800 flex items-center justify-center font-black text-2xl shadow-lg border-2 border-amber-300 shrink-0">
                {bus.routeNumber}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wider ${busClassInfo.bgBadge}`}>
                    {busClassInfo.title[language] || busClassInfo.title.en}
                  </span>
                  <span className="bg-amber-400 text-red-950 font-mono font-bold text-xs px-2.5 py-0.5 rounded shadow-sm">
                    {t.regNoLabel}: {bus.regNumber}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {route.name[language] || route.name.en}
                </h2>
                <p className="text-xs text-amber-200 mt-0.5">
                  {t.depotLabel}: <strong>{bus.depot[language] || bus.depot.en}</strong>
                </p>
              </div>
            </div>

            {/* 1-Second Real-Time Live GPS Telematics Box */}
            <div className="bg-red-950/80 border border-amber-400/40 rounded-2xl p-4 flex items-center gap-4 shadow-inner">
              {/* 1s Real-Time Satellite Pulse Radar */}
              <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                <span className="w-12 h-12 rounded-full border-2 border-emerald-400/30 flex items-center justify-center">
                  <span className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/60 animate-ping"></span>
                </span>
                <div className="absolute flex flex-col items-center">
                  <span className="font-mono text-xs font-black text-emerald-300">1s</span>
                  <span className="text-[8px] font-bold text-amber-200 uppercase tracking-tighter">LIVE</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <span className={`w-2 h-2 rounded-full ${bus.isDwellAtStop ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`}></span>
                  <span className={bus.isDwellAtStop ? 'text-amber-300 font-extrabold' : ''}>
                    {bus.isDwellAtStop ? `🛑 30s Stop Active (${bus.dwellRemainingSeconds ?? 30}s)` : t.liveGpsStatus}
                  </span>
                </div>
                <div className="text-[11px] text-amber-100/90 mt-1 space-y-0.5 font-mono">
                  <div>
                    Speed: <strong className="text-white">{bus.isDwellAtStop ? '0 km/h (At Stop)' : `${bus.speedKmH} km/h`}</strong>
                    {bus.isDwellAtStop && <span className="ml-1 text-[10px] text-amber-300 font-sans font-bold">Doors Open</span>}
                  </div>
                  <div>Coords: <strong className="text-white">{bus.currentLat}, {bus.currentLng}</strong></div>
                </div>
              </div>
            </div>

          </div>

          {/* Real-time Journey Status Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`p-3 rounded-xl border ${bus.isDwellAtStop ? 'bg-red-900 border-amber-400/80 shadow-md ring-1 ring-amber-400' : 'bg-red-950/60 border-red-700/50'}`}>
              <span className="text-[10px] text-amber-200/80 uppercase font-bold block">
                {bus.isDwellAtStop ? '🛑 Halted at Stop (30s)' : t.currentLocation}
              </span>
              <span className="font-extrabold text-sm text-white block mt-0.5 truncate">
                {bus.isDwellAtStop 
                  ? (bus.dwellStopName?.[language] || bus.dwellStopName?.en || currentStop.name[language] || currentStop.name.en)
                  : (currentStop.name[language] || currentStop.name.en)}
              </span>
            </div>

            <div className="bg-red-950/60 p-3 rounded-xl border border-red-700/50">
              <span className="text-[10px] text-amber-200/80 uppercase font-bold block">
                {t.nextStop}
              </span>
              <span className="font-extrabold text-sm text-amber-300 block mt-0.5 truncate">
                {nextStop.name[language] || nextStop.name.en}
              </span>
            </div>

            <div className="bg-red-950/60 p-3 rounded-xl border border-red-700/50">
              <span className="text-[10px] text-amber-200/80 uppercase font-bold block">
                {t.crowdStatus}
              </span>
              <span className="font-extrabold text-sm text-white block mt-0.5">
                {getCrowdLabel()}
              </span>
            </div>

            <div className="bg-red-950/60 p-3 rounded-xl border border-red-700/50">
              <span className="text-[10px] text-amber-200/80 uppercase font-bold block">
                {t.hygieneClean.split('&')[0]} Score
              </span>
              <span className="font-extrabold text-sm text-emerald-400 block mt-0.5">
                ★ {bus.hygieneScore} / 5.0
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* Staff Present On Board with Official IDs Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <ShieldCheck className="w-5 h-5 text-red-700" />
          <h3 className="font-extrabold text-base text-slate-900">
            {t.staffOnBoard}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Driver Profile Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-red-100 text-red-800 flex items-center justify-center font-bold text-xl shrink-0 border border-red-200 overflow-hidden">
              {bus.driver.photoUrl ? (
                <img src={bus.driver.photoUrl} alt={bus.driver.name} className="w-full h-full object-cover" />
              ) : (
                'DR'
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-red-700 uppercase tracking-wider">
                  {t.driverLabel}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ★ {bus.driver.rating} {t.safetyRating}
                </span>
              </div>
              <h4 className="font-extrabold text-slate-900 text-base mt-0.5">
                {bus.driver.name}
              </h4>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-600 mt-2 font-mono">
                <div>
                  <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">{t.staffId}:</span>
                  <strong className="text-slate-900">{bus.driver.id}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">{t.badgeNo}:</span>
                  <strong className="text-slate-900">{bus.driver.badgeNo}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Conductor Profile Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xl shrink-0 border border-amber-200 overflow-hidden">
              {bus.conductor.photoUrl ? (
                <img src={bus.conductor.photoUrl} alt={bus.conductor.name} className="w-full h-full object-cover" />
              ) : (
                'CD'
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-amber-700 uppercase tracking-wider">
                  {t.conductorLabel}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ★ {bus.conductor.rating} {t.safetyRating}
                </span>
              </div>
              <h4 className="font-extrabold text-slate-900 text-base mt-0.5">
                {bus.conductor.name}
              </h4>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-600 mt-2 font-mono">
                <div>
                  <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">{t.staffId}:</span>
                  <strong className="text-slate-900">{bus.conductor.id}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-sans block text-[10px] uppercase font-bold">{t.badgeNo}:</span>
                  <strong className="text-slate-900">{bus.conductor.badgeNo}</strong>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Tabs: Live Route Map vs Stops Timetable */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`px-4 py-2 font-bold text-sm rounded-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'map'
              ? 'bg-red-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>{t.routeMap}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 font-bold text-sm rounded-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'schedule'
              ? 'bg-red-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>{t.allStopsTitle || 'Every Single Stop'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
            activeTab === 'schedule' ? 'bg-red-800 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {route.stops.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('duty')}
          className={`px-4 py-2 font-bold text-sm rounded-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'duty'
              ? 'bg-red-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t.fullDaySchedule || 'Full Day Bus Schedule'}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
            activeTab === 'duty' ? 'bg-red-800 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {daySchedule.length} {language === 'te' ? 'ట్రిప్‌లు' : language === 'hi' ? 'ट्रिप्स' : 'Trips'}
          </span>
        </button>
      </div>

      {/* Tab 1: Live Interactive SVG Map & Telematics Speed Controller */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <LiveRouteMap bus={bus} route={route} language={language} />
          {simSpeed !== undefined && onSpeedChange && (
            <SpeedControlTable
              simSpeed={simSpeed}
              onSpeedChange={onSpeedChange}
              language={language}
            />
          )}
        </div>
      )}

      {/* Tab 2: Every Single Stop on Route */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-700" />
                <span>{t.allStopsTitle || 'All Stops on Route'} ({route.stops.length} {language === 'te' ? 'స్టాప్‌లు' : language === 'hi' ? 'स्टॉप' : 'Total Stops'})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {route.origin[language] || route.origin.en} ➔ {route.destination[language] || route.destination.en} ({route.totalDistanceKm} km)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                {t.stageStopLabel || 'Fare Stage Stop'}
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block"></span>
                {t.requestStopLabel || 'Regular Bus Stop'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {route.stops.map((stop, idx) => {
              const isPassed = idx < bus.currentStopIndex;
              const isCurrent = idx === bus.currentStopIndex;
              const upcomingItem = upcomingStops.find((u) => u.stop.id === stop.id);

              return (
                <div
                  key={stop.id}
                  className={`flex items-start gap-4 p-3.5 rounded-xl transition border ${
                    isCurrent
                      ? 'bg-red-50 border-red-300 ring-2 ring-red-100 shadow-sm'
                      : isPassed
                      ? 'bg-slate-50/70 border-slate-200 opacity-75'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  {/* Step status dot */}
                  <div className="mt-0.5 flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-xs ${
                        isPassed
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-red-700 text-white ring-4 ring-red-100 animate-pulse'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {isPassed ? '✓' : idx + 1}
                    </div>
                    {idx < route.stops.length - 1 && (
                      <div className={`w-0.5 h-7 mt-1 ${isPassed ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">
                          {stop.name[language] || stop.name.en}
                        </h4>
                        {stop.stopCode && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                            {stop.stopCode}
                          </span>
                        )}
                        {stop.isStageStop ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            {t.stageStopLabel || 'Stage'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {t.requestStopLabel || 'Stop'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isPassed && (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                            ✓ {language === 'te' ? 'పూర్తయింది' : language === 'hi' ? 'पार किया' : 'Passed'}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[11px] font-black text-red-700 bg-red-100 px-2.5 py-0.5 rounded border border-red-200 animate-pulse">
                            📍 {language === 'te' ? 'ప్రస్తుత స్టాప్' : language === 'hi' ? 'वर्तमान स्टॉप' : 'At This Stop'}
                          </span>
                        )}
                        {upcomingItem && (
                          <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-300">
                            ~{upcomingItem.etaMinutes} mins ETA
                          </span>
                        )}
                      </div>
                    </div>

                    {stop.landmark && (
                      <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                        <span className="text-slate-400">📍</span>
                        <span>{stop.landmark[language] || stop.landmark.en}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 font-mono">
                      <span>{stop.distanceFromStartKm} km from terminal</span>
                      <span>•</span>
                      <span>Coordinates: {stop.lat.toFixed(4)}°N, {stop.lng.toFixed(4)}°E</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Full Day Bus Schedule (Duty Roster with Every Stop Timings) */}
      {activeTab === 'duty' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          {/* Duty Banner */}
          <div className="bg-slate-900 text-white rounded-xl p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-600 text-white text-xs uppercase font-mono font-black px-2 py-0.5 rounded">
                    {bus.dailyDutyCode || 'DUTY-VZ-APSRTC'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {bus.regNumber}
                  </span>
                </div>
                <h3 className="text-lg font-black mt-1">
                  {t.dailyDutyRoster || 'Daily Bus Duty Schedule'}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Route {route.routeNumber}: {route.origin[language] || route.origin.en} ⇄ {route.destination[language] || route.destination.en}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{language === 'te' ? 'డ్యూటీ ప్రారంభం' : language === 'hi' ? 'ड्यूटी प्रारंभ' : 'Duty Start'}</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{bus.dutyStartTime || '05:00'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{language === 'te' ? 'డ్యూటీ ముగింపు' : language === 'hi' ? 'ड्यूटी समाप्त' : 'Duty End'}</span>
                  <span className="font-mono font-bold text-amber-400 text-sm">{bus.dutyEndTime || '23:30'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">{language === 'te' ? 'మొత్తం ట్రిప్‌లు' : language === 'hi' ? 'कुल ट्रिप्स' : 'Total Trips'}</span>
                  <span className="font-mono font-bold text-white text-sm">{daySchedule.length} Trips / Day</span>
                </div>
              </div>
            </div>
          </div>

          {/* List of All Trips */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>{language === 'te' ? 'రోజంతా ట్రిప్‌ల షెడ్యూల్ మరియు ప్రతి స్టాప్ సమయం' : language === 'hi' ? 'दिन भर की यात्राएं और प्रत्येक स्टॉप का समय' : 'All Trips in the Day & Every Single Stop Timing'}</span>
              <span className="text-xs text-slate-500 font-normal">
                {language === 'te' ? 'స్టాప్‌ల సమయాలను చూడటానికి ట్రిప్‌పై క్లిక్ చేయండి' : language === 'hi' ? 'सभी स्टॉप का समय देखने के लिए ट्रिप पर क्लिक करें' : 'Click any trip to see all stop timings'}
              </span>
            </h4>

            {daySchedule.map((trip) => {
              const isExpanded = expandedTripId === trip.tripId;
              const isCurrentTrip = trip.status === 'in_progress';
              const isCompletedTrip = trip.status === 'completed';

              return (
                <div
                  key={trip.tripId}
                  className={`border rounded-xl transition overflow-hidden ${
                    isCurrentTrip
                      ? 'border-red-400 bg-red-50/20 shadow-sm'
                      : isCompletedTrip
                      ? 'border-slate-200 bg-slate-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Trip Summary Header */}
                  <div
                    onClick={() => setExpandedTripId(isExpanded ? null : trip.tripId)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-xs ${
                          isCurrentTrip
                            ? 'bg-red-700 text-white ring-2 ring-red-200 animate-pulse'
                            : isCompletedTrip
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        #{trip.tripNumber}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm">
                            {trip.originName[language] || trip.originName.en} ➔ {trip.destinationName[language] || trip.destinationName.en}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            ({trip.direction === 'forward' ? 'Up' : 'Down'})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span>{trip.distanceKm} km</span>
                          <span>•</span>
                          <span>~{trip.durationMinutes} mins</span>
                          <span>•</span>
                          <span>{trip.stops.length} {language === 'te' ? 'స్టాప్‌లు' : language === 'hi' ? 'स्टॉप' : 'stops'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-auto">
                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-900 text-sm">
                          {trip.originDepartureTime} ➔ {trip.destinationArrivalTime}
                        </div>
                        <span
                          className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isCurrentTrip
                              ? 'bg-red-100 text-red-700 border border-red-300 animate-pulse'
                              : isCompletedTrip
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {isCurrentTrip
                            ? (t.tripInProgress || 'LIVE ON ROAD')
                            : isCompletedTrip
                            ? (t.tripCompleted || 'COMPLETED')
                            : (t.tripScheduled || 'SCHEDULED')}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Accordion: Every Single Stop with Timings */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-red-700" />
                          <span>{language === 'te' ? 'ప్రతి స్టాప్ వద్ద నిర్ణీత రాక సమయం' : language === 'hi' ? 'हर स्टॉप पर निर्धारित आगमन समय' : 'Scheduled Arrival Timing at Every Single Stop'}</span>
                        </h5>
                        <span className="text-[11px] font-mono text-slate-500">
                          {trip.stops.length} stops included
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {trip.stops.map((stopTiming) => {
                          const isPassedTiming = trip.status === 'completed' || (trip.status === 'in_progress' && stopTiming.stopIndex < bus.currentStopIndex);
                          const isCurrentTiming = trip.status === 'in_progress' && stopTiming.stopIndex === bus.currentStopIndex;

                          return (
                            <div
                              key={stopTiming.stopId}
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition ${
                                isCurrentTiming
                                  ? 'bg-red-50 border-red-300 font-bold'
                                  : isPassedTiming
                                  ? 'bg-white/60 border-slate-200 text-slate-600'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                                  isPassedTiming
                                    ? 'bg-emerald-600 text-white'
                                    : isCurrentTiming
                                    ? 'bg-red-700 text-white'
                                    : 'bg-slate-100 text-slate-600 border border-slate-300'
                                }`}>
                                  {isPassedTiming ? '✓' : stopTiming.stopIndex + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-bold text-slate-900 truncate">
                                      {stopTiming.stopName[language] || stopTiming.stopName.en}
                                    </span>
                                    {stopTiming.isStageStop && (
                                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded shrink-0">
                                        Stage
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    {stopTiming.distanceKm} km
                                  </span>
                                </div>
                              </div>

                              <div className="text-right shrink-0 pl-2">
                                <span className="font-mono font-black text-slate-900 text-xs">
                                  {stopTiming.scheduledArrival}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Community Reports on this Bus */}
      {bus.reports && bus.reports.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <span>{t.recentReports}</span>
          </h4>
          <div className="space-y-2.5">
            {bus.reports.slice(0, 4).map((rep) => (
              <div key={rep.id} className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {rep.evidenceImageUrl && (
                    <img
                      src={rep.evidenceImageUrl}
                      alt={rep.evidenceImageName || 'Passenger report photo'}
                      className="w-11 h-11 rounded-lg object-cover border border-slate-300 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div>
                      <span className="font-bold text-slate-900">{rep.reporterName}</span>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span>Crowd: <strong className="capitalize">{rep.crowdLevel}</strong></span>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span>Hygiene: <strong className="capitalize">{rep.hygiene}</strong></span>
                    </div>
                    {rep.otherProblems && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        "{rep.otherProblems}"
                      </p>
                    )}
                  </div>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0">{rep.ticketId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
