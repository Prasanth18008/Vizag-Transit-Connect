import React from 'react';
import { ActiveBus, Language, Route } from '../types/transit';
import { BUS_CLASSES } from '../utils/transitData';
import { translations } from '../utils/translations';
import { calculateFare } from '../utils/transitLogic';
import { 
  Bus, 
  MapPin, 
  Clock, 
  Users, 
  Radio, 
  ChevronRight, 
  Sparkles, 
  ShieldCheck, 
  IndianRupee,
  Navigation
} from 'lucide-react';

interface NextAvailableBusesListProps {
  buses: ActiveBus[];
  routes: Route[];
  language: Language;
  selectedBusId: string | null;
  onSelectBus: (bus: ActiveBus) => void;
  onOpenReportModal: (bus: ActiveBus) => void;
}

export const NextAvailableBusesList: React.FC<NextAvailableBusesListProps> = ({
  buses,
  routes,
  language,
  selectedBusId,
  onSelectBus,
  onOpenReportModal,
}) => {
  const t = translations[language];

  const getRouteForBus = (bus: ActiveBus): Route | undefined => {
    return routes.find((r) => r.id === bus.routeId);
  };

  const getBusClassInfo = (classId: string) => {
    return BUS_CLASSES.find((c) => c.id === classId) || BUS_CLASSES[0];
  };

  const getCrowdBadge = (crowd: string) => {
    switch (crowd) {
      case 'low':
        return {
          label: t.crowdLow,
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-500',
        };
      case 'moderate':
        return {
          label: t.crowdModerate,
          color: 'bg-amber-100 text-amber-800 border-amber-300',
          dot: 'bg-amber-500',
        };
      case 'standing':
        return {
          label: t.crowdStanding,
          color: 'bg-orange-100 text-orange-800 border-orange-300',
          dot: 'bg-orange-500',
        };
      case 'heavy':
      default:
        return {
          label: t.crowdHeavy,
          color: 'bg-red-100 text-red-800 border-red-300',
          dot: 'bg-red-500',
        };
    }
  };

  if (buses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center my-6">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-700 flex items-center justify-center mx-auto mb-4 border border-red-200">
          <Bus className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">
          {t.noBusesFound}
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          {t.tryDifferentFilters}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-8">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-700" />
            <span>{t.nextAvailableTitle}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {t.nextAvailableSubtitle}
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full w-fit">
          {buses.length} {language === 'te' ? 'బస్సులు సిద్ధంగా ఉన్నాయి' : language === 'hi' ? 'बसें उपलब्ध हैं' : 'live buses on road'}
        </span>
      </div>

      {/* Grid of Available Buses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {buses.map((bus) => {
          const route = getRouteForBus(bus);
          const classInfo = getBusClassInfo(bus.busClass);
          const crowdBadge = getCrowdBadge(bus.crowdLevel);
          const isSelected = selectedBusId === bus.id;

          // Estimate current and next stop names
          const stops = route?.stops || [];
          const currentStop = stops[bus.currentStopIndex] || stops[0];
          const nextStop = stops[Math.min(bus.currentStopIndex + 1, stops.length - 1)] || stops[0];
          const fare = route ? calculateFare(route.totalDistanceKm, bus.busClass) : 25;

          return (
            <div
              key={bus.id}
              className={`rounded-2xl border-2 transition relative overflow-hidden bg-white shadow-sm hover:shadow-md ${
                isSelected
                  ? 'border-red-600 ring-2 ring-red-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Top Accent Strip */}
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: classInfo.color }}
              />

              <div className="p-5">
                
                {/* Top Row: Route Number, Bus Class, Live GPS badge, Next Departure */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    {/* Big Route Number Badge */}
                    <div className="bg-red-800 text-white font-extrabold text-lg px-3 py-1.5 rounded-xl shadow-sm tracking-wide">
                      {bus.routeNumber}
                    </div>

                    <div>
                      {/* Class Badge */}
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold border ${classInfo.bgBadge}`}
                      >
                        {classInfo.title[language] || classInfo.title.en}
                      </span>
                      {/* Registration Number */}
                      <span className="block text-xs font-mono font-bold text-slate-800 mt-0.5">
                        {bus.regNumber}
                      </span>
                    </div>
                  </div>

                  {/* Live Departure Countdown Badge */}
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      {t.departsIn}
                    </span>
                    <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                      ~{bus.nextDepartureMinutes} {t.seconds === 'సెకన్లు' ? 'నిమి' : t.seconds === 'सेकंड' ? 'मिनट' : 'mins'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {bus.departureTimeFormatted}
                    </span>
                  </div>
                </div>

                {/* Route Path (Origin -> Destination) */}
                <div className="mb-3.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                    <span className="truncate">
                      {route ? (route.origin[language] || route.origin.en) : 'Origin'}
                    </span>
                    <span className="text-slate-400 mx-1">➔</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span className="truncate">
                      {route ? (route.destination[language] || route.destination.en) : 'Destination'}
                    </span>
                  </div>
                </div>

                {/* Real-time Location: Current Stop & Next Stop */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3.5">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                      {t.currentLocation}
                    </span>
                    <span className="font-bold text-slate-800 truncate block mt-0.5">
                      {currentStop?.name[language] || currentStop?.name.en}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                      {t.nextStop}
                    </span>
                    <span className="font-bold text-emerald-700 truncate block mt-0.5">
                      {nextStop?.name[language] || nextStop?.name.en}
                    </span>
                  </div>
                </div>

                {/* Onboard Details: Staff, Crowd, Hygiene, Fare */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100 mb-4">
                  
                  {/* Crowd Indicator */}
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${crowdBadge.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${crowdBadge.dot}`}></span>
                      <span>{crowdBadge.label}</span>
                    </span>
                  </div>

                  {/* Staff Info snippet */}
                  <div className="text-[11px] text-slate-600">
                    <span>{t.driverLabel}: <strong>{bus.driver.name.split(' ')[0]}</strong></span>
                    <span className="text-slate-300 mx-1">•</span>
                    <span>{t.staffId}: <strong className="font-mono text-slate-700">{bus.driver.id.slice(-4)}</strong></span>
                  </div>

                  {/* Est Fare */}
                  <div className="text-xs font-bold text-slate-800 flex items-center">
                    <span className="text-slate-400 font-normal mr-1">{t.fareEstimate}:</span>
                    <span className="text-emerald-700">₹{fare}</span>
                  </div>
                </div>

                {/* Primary Action Button: Track Live GPS */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectBus(bus)}
                    className="flex-1 bg-red-700 hover:bg-red-800 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <Navigation className="w-4 h-4 fill-white" />
                    <span>{t.trackLiveBtn}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenReportModal(bus)}
                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs border border-slate-300 transition shrink-0 cursor-pointer"
                    title={t.reportIssueBtn}
                    aria-label="Report onboard issue for bus"
                  >
                    {t.reportIssueBtn.split('/')[0]}
                  </button>
                </div>

              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
