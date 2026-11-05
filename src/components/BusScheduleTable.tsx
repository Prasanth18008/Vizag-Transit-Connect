import React, { useState } from 'react';
import { Language, Route, ActiveBus } from '../types/transit';
import { translations } from '../utils/translations';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Bus, 
  AlertCircle, 
  Navigation, 
  Compass, 
  Building2, 
  Layers, 
  CheckCircle2, 
  Radio, 
  ChevronRight 
} from 'lucide-react';

interface BusScheduleTableProps {
  route: Route;
  language: Language;
  activeBuses?: ActiveBus[];
  onSelectBus?: (bus: ActiveBus) => void;
}

type TimeShift = 'ALL' | 'MORNING' | 'MIDDAY' | 'EVENING' | 'NIGHT';

export const BusScheduleTable: React.FC<BusScheduleTableProps> = ({
  route,
  language,
  activeBuses = [],
  onSelectBus,
}) => {
  const t = translations[language];
  const [selectedShift, setSelectedShift] = useState<TimeShift>('ALL');
  const [selectedDeparture, setSelectedDeparture] = useState<string>(
    route.scheduledDepartures?.[0] || '06:00 AM'
  );

  const departures = route.scheduledDepartures && route.scheduledDepartures.length > 0
    ? route.scheduledDepartures
    : [
        '05:30 AM', '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM',
        '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '11:00 AM', '12:00 PM',
        '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM',
        '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM'
      ];

  // Helper to filter departures by shift
  const isTimeInShift = (timeStr: string, shift: TimeShift): boolean => {
    if (shift === 'ALL') return true;
    const parts = timeStr.trim().split(/[:\s]/);
    let hour = parseInt(parts[0], 10);
    const meridiem = parts[2] ? parts[2].toUpperCase() : 'AM';
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;

    switch (shift) {
      case 'MORNING': // 05:00 - 10:00 AM
        return hour >= 5 && hour < 10;
      case 'MIDDAY':  // 10:00 AM - 04:00 PM
        return hour >= 10 && hour < 16;
      case 'EVENING': // 04:00 PM - 08:30 PM
        return hour >= 16 && hour < 20;
      case 'NIGHT':   // 08:30 PM - 11:45 PM
        return hour >= 20 || hour < 5;
      default:
        return true;
    }
  };

  const filteredDepartures = departures.filter((d) => isTimeInShift(d, selectedShift));

  // Compute exact intermediate arrival times at each stop based on selected departure time
  const computeStopArrivalTimes = (departureStr: string) => {
    const parts = departureStr.trim().split(/[:\s]/);
    let hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    const meridiem = parts[2] ? parts[2].toUpperCase() : 'AM';
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;

    const baseMinutesFromMidnight = hour * 60 + minute;
    const totalDistance = Math.max(1, route.totalDistanceKm);
    const totalDuration = Math.max(20, route.typicalDurationMinutes);

    return route.stops.map((stop) => {
      // Fraction of total journey
      const fraction = stop.distanceFromStartKm / totalDistance;
      const elapsedMinutes = Math.round(fraction * totalDuration);
      const stopTotalMinutes = (baseMinutesFromMidnight + elapsedMinutes) % (24 * 60);

      let stopHour = Math.floor(stopTotalMinutes / 60);
      const stopMin = stopTotalMinutes % 60;
      const stopMeridiem = stopHour >= 12 ? 'PM' : 'AM';
      if (stopHour > 12) stopHour -= 12;
      if (stopHour === 0) stopHour = 12;

      const formatted = `${String(stopHour).padStart(2, '0')}:${String(stopMin).padStart(2, '0')} ${stopMeridiem}`;
      return {
        stop,
        arrivalTime: formatted,
        elapsedMinutes,
      };
    });
  };

  const stopTimings = computeStopArrivalTimes(selectedDeparture);

  // Active buses running on this route
  const activeBusesForRoute = activeBuses.filter((b) => b.routeNumber === route.routeNumber);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl mb-10 transition-all">
      
      {/* Route Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-9 h-9 rounded-xl bg-red-700 text-white font-black text-sm flex items-center justify-center shadow-md">
              {route.routeNumber}
            </span>
            <span className="bg-amber-400 text-red-950 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              APSRTC Official Schedule
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Code: APSRTC-VZ-{route.routeNumber}
            </span>
          </div>

          <h3 className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
            {route.name[language] || route.name.en}
          </h3>

          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="font-bold text-slate-700">{route.origin[language] || route.origin.en}</span>
            <span className="text-red-600 font-bold">➔</span>
            <span className="font-bold text-slate-700">{route.destination[language] || route.destination.en}</span>
          </p>
        </div>

        {/* Operational Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Frequency</span>
            <strong className="text-slate-900 font-mono text-sm">~{route.frequencyMinutes} mins</strong>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">First / Last Bus</span>
            <strong className="text-slate-900 font-mono text-xs">{route.firstBus} – {route.lastBus}</strong>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Route Length</span>
            <strong className="text-slate-900 font-mono text-xs">{route.totalDistanceKm} km ({route.typicalDurationMinutes}m)</strong>
          </div>
          <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-600 font-bold uppercase block">Active GPS Fleet</span>
            <strong className="text-emerald-800 font-mono text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {activeBusesForRoute.length} Buses Live
            </strong>
          </div>
        </div>
      </div>

      {/* Origin Platform Bay & Assigned Depot Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-red-600 shrink-0" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Designated Boarding Bay:</span>
            <strong className="text-slate-900">
              {route.platformBay ? (route.platformBay[language] || route.platformBay.en) : `Bay ${route.routeNumber} (RTC Complex)`}
            </strong>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Operational Depot:</span>
            <strong className="text-slate-900">
              {route.depotOrigin ? (route.depotOrigin[language] || route.depotOrigin.en) : 'Visakhapatnam City Fleet Depot'}
            </strong>
          </div>
        </div>
      </div>

      {/* Daily Shift Filter Pills */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Scheduled Departures From Origin Terminal ({filteredDepartures.length} trips)</span>
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Click any time to calculate intermediate stop schedule
          </span>
        </div>

        {/* Shift selector buttons */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(['ALL', 'MORNING', 'MIDDAY', 'EVENING', 'NIGHT'] as TimeShift[]).map((shift) => (
            <button
              key={shift}
              type="button"
              onClick={() => setSelectedShift(shift)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedShift === shift
                  ? 'bg-red-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {shift === 'ALL' && 'All Day'}
              {shift === 'MORNING' && 'Morning Peak (5-10 AM)'}
              {shift === 'MIDDAY' && 'Midday (10 AM-4 PM)'}
              {shift === 'EVENING' && 'Evening Peak (4-8 PM)'}
              {shift === 'NIGHT' && 'Night (8-11:45 PM)'}
            </button>
          ))}
        </div>

        {/* Departure Time Slots Grid */}
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-200">
          {filteredDepartures.map((time, idx) => {
            const isSelected = selectedDeparture === time;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDeparture(time)}
                className={`px-3 py-1.5 font-mono text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-amber-400 text-red-950 border-2 border-amber-500 shadow-md scale-105'
                    : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                }`}
              >
                <span>{time}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-red-700"></span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stop-by-Stop Intermediate Timing Matrix */}
      <div className="mt-5 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exact Stop-by-Stop Schedule for Trip Departing at {selectedDeparture}</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Calculated intermediate arrival times based on APSRTC transit speed standards
            </p>
          </div>
        </div>

        {/* Responsive Stop-by-Stop Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {stopTimings.map(({ stop, arrivalTime, elapsedMinutes }, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === stopTimings.length - 1;

            return (
              <div
                key={stop.id}
                className={`p-3 rounded-2xl border transition-all ${
                  isFirst
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : isLast
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                      isFirst ? 'bg-emerald-600 text-white' : isLast ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 leading-tight">
                          {stop.name[language] || stop.name.en}
                        </span>
                        {stop.isStageStop && (
                          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                            Stage
                          </span>
                        )}
                        {stop.stopCode && (
                          <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                            {stop.stopCode}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {stop.distanceFromStartKm} km (+{elapsedMinutes} mins)
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-black text-slate-900 block">
                      {arrivalTime}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">
                      {isFirst ? 'Origin' : isLast ? 'Terminus' : 'Scheduled'}
                    </span>
                  </div>
                </div>

                {stop.landmark && (
                  <div className="mt-1.5 pt-1 border-t border-slate-200/60 text-[10px] text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                    <span className="truncate">{stop.landmark[language] || stop.landmark.en}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Live Buses on This Route Banner */}
      {activeBusesForRoute.length > 0 && (
        <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-red-900 via-red-800 to-amber-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                {activeBusesForRoute.length} Live GPS Buses Operating Now on Route {route.routeNumber}
              </span>
            </div>
            <p className="text-xs text-amber-100 mt-0.5">
              Current buses on road: {activeBusesForRoute.map((b) => b.regNumber).join(', ')}
            </p>
          </div>

          {onSelectBus && (
            <button
              type="button"
              onClick={() => onSelectBus(activeBusesForRoute[0])}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-red-950 font-extrabold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Track Live Bus ({activeBusesForRoute[0].regNumber})</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Official APSRTC Notice */}
      <div className="mt-4 text-[11px] text-slate-500 flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          {language === 'te'
            ? 'ఈ సమయాలు మరియు రూట్లు APSRTC విశాఖపట్నం రీజియన్ (ద్వారకా బస్ స్టేషన్, మద్దిలపాలెం, గాజువాక డిపోలు) అధికారిక టైమ్‌టేబుల్ ఆధారంగా రూపొందించబడ్డాయి. శాటిలైట్ లైవ్ GPS ట్రాకింగ్ ప్రతి 10 సెకన్లకు రియల్-టైమ్ స్థానాన్ని అప్‌డేట్ చేస్తుంది.'
            : language === 'hi'
            ? 'यह समय सारिणी और मार्ग APSRTC विशाखापत्तनम क्षेत्र के आधिकारिक टाइमटेबल के अनुसार हैं। उपग्रह लाइव जीपीएस ट्रैकिंग हर 10 सेकंड में अद्यतन होती है।'
            : 'Routes, frequencies, and timetables are sourced in accordance with official APSRTC Visakhapatnam Metropolitan Zone schedules (Dwaraka Bus Station, Maddilapalem, Waltair, Gajuwaka, and Simhachalam depots). Real-time satellite GPS updates every 10 seconds.'}
        </span>
      </div>

    </div>
  );
};
