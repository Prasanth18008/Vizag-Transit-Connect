import React from 'react';
import { Gauge, Zap, FastForward, Play, Clock, Sparkles } from 'lucide-react';
import { Language } from '../types/transit';

interface SpeedControlTableProps {
  simSpeed: number; // 1, 2, or 10
  onSpeedChange: (speed: number) => void;
  language: Language;
}

export const SpeedControlTable: React.FC<SpeedControlTableProps> = ({
  simSpeed,
  onSpeedChange,
  language,
}) => {
  const speedOptions = [
    {
      multiplier: 1,
      label: '1x (Real-Time)',
      badge: 'Normal 1s Tick',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      activeColor: 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/30',
      description: {
        en: '1 second = 1 second of real-world transit GPS',
        te: 'ప్రతి 1 సెకనుకు ప్రత్యక్ష GPS నిజ-సమయ వేగం',
        hi: 'प्रति 1 सेकंड वास्तविक जीपीएस ट्रैकिंग गति',
      },
      tickRate: '1 sec / tick',
      effectiveSpeed: '25 – 45 km/h (Normal Road)',
      icon: Play,
    },
    {
      multiplier: 2,
      label: '2x (Fast Mode)',
      badge: '2x Accelerated',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      activeColor: 'bg-blue-600 text-white border-blue-700 shadow-blue-500/30',
      description: {
        en: '2x accelerated speed for fast corridor preview',
        te: '2 రెట్ల వేగంతో త్వరిత రూట్ ప్రివ్యూ',
        hi: '2 गुना तीव्र गति से त्वरित मार्ग पूर्वावलोकन',
      },
      tickRate: '2 sec / tick',
      effectiveSpeed: '50 – 90 km/h (Express Telematics)',
      icon: Zap,
    },
    {
      multiplier: 10,
      label: '10x (Warp Telematics)',
      badge: '10x Ultra Warp',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      activeColor: 'bg-purple-600 text-white border-purple-700 shadow-purple-500/30',
      description: {
        en: '10x ultra speed to test full-day bus round-trips in seconds',
        te: '10 రెట్ల గరిష్ట వేగం - పూర్తి రోజంతా ప్రయాణాల తనిఖీ',
        hi: '10 गुना उच्च गति - कुछ ही सेकंड में पूरे दिन का फेरा',
      },
      tickRate: '10 sec / tick',
      effectiveSpeed: '250 – 450 km/h (High-speed simulation)',
      icon: FastForward,
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-200">
      {/* Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                {language === 'te'
                  ? 'లైవ్ GPS స్పీడ్ కంట్రోలర్ టేబుల్ (1x • 2x • 10x)'
                  : language === 'hi'
                    ? 'लाइव जीपीएस गति नियंत्रक तालिका (1x • 2x • 10x)'
                    : 'GPS Telematics Simulation Speed Controller'}
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                Active: {simSpeed}x
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'te'
                ? 'బస్సుల GPS కదలిక వేగాన్ని 1x, 2x లేదా 10x వేగంతో నియంత్రించండి'
                : language === 'hi'
                  ? 'बसों के जीपीएस संचलन की गति 1x, 2x या 10x में नियंत्रित करें'
                  : 'Control active bus GPS progression rate and dwell timing across all Vizag routes'}
            </p>
          </div>
        </div>

        {/* Quick button toggle bar */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {speedOptions.map((opt) => (
            <button
              key={opt.multiplier}
              type="button"
              onClick={() => onSpeedChange(opt.multiplier)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                simSpeed === opt.multiplier
                  ? `${opt.activeColor} shadow-md`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
              }`}
            >
              <opt.icon className="w-3.5 h-3.5" />
              <span>{opt.multiplier}x</span>
            </button>
          ))}
        </div>
      </div>

      {/* Speed Control Comparison Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3">Multiplier</th>
              <th className="py-2.5 px-3">Simulation Mode</th>
              <th className="py-2.5 px-3">Telematics Advance</th>
              <th className="py-2.5 px-3">Effective Bus Velocity</th>
              <th className="py-2.5 px-3 text-right">Selection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {speedOptions.map((opt) => {
              const isSelected = simSpeed === opt.multiplier;
              return (
                <tr
                  key={opt.multiplier}
                  onClick={() => onSpeedChange(opt.multiplier)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/70 font-semibold'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                          isSelected
                            ? opt.activeColor
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {opt.multiplier}x
                      </span>
                      <span className="font-extrabold text-slate-900">
                        {opt.label}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-slate-800">
                      {opt.description[language] || opt.description.en}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {opt.tickRate}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                    {opt.effectiveSpeed}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSpeedChange(opt.multiplier);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        isSelected
                          ? `${opt.activeColor} shadow-sm ring-2 ring-indigo-300 ring-offset-1`
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? '✓ Active' : `Set ${opt.multiplier}x`}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Speed Helper Notice */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          {simSpeed === 1
            ? 'Running at 1:1 real-time. Commuters see live bus movement matched to city traffic.'
            : simSpeed === 2
              ? 'Running at 2x accelerated time. Great for previewing next 2-3 stops quickly.'
              : 'Running at 10x warp speed! Complete routes and observe 30s dwell times rapidly.'}
        </span>
        <span className="font-mono text-indigo-600 font-bold">
          Speed Factor: {simSpeed}.0x
        </span>
      </div>
    </div>
  );
};
