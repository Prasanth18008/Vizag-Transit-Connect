import React from 'react';
import { Language, UserProfile } from '../types/transit';
import { translations } from '../utils/translations';
import { Bus, Radio, Volume2, VolumeX, Eye, LogOut, Globe, Sparkles } from 'lucide-react';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  user: UserProfile | null;
  onLogout: () => void;
  gpsCountdown: number; // 0-10 seconds
  highContrast: boolean;
  onToggleHighContrast: () => void;
  largeText: boolean;
  onToggleLargeText: () => void;
  audioAnnouncements: boolean;
  onToggleAudioAnnouncements: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  user,
  onLogout,
  gpsCountdown,
  highContrast,
  onToggleHighContrast,
  largeText,
  onToggleLargeText,
  audioAnnouncements,
  onToggleAudioAnnouncements,
}) => {
  const t = translations[language];

  return (
    <header className="bg-gradient-to-r from-red-800 via-red-700 to-amber-700 text-white shadow-lg sticky top-0 z-50 border-b-2 border-amber-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & City Transit Branding */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white text-red-700 flex items-center justify-center shadow-md border-2 border-amber-300 shrink-0">
              <Bus className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-red-950 text-[10px] font-extrabold px-2 py-0.5 rounded tracking-wider uppercase">
                  APSRTC
                </span>
                <span className="text-amber-200 text-xs font-semibold tracking-wide">
                  విశాఖపట్నం • VISAKHAPATNAM
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                {t.appName}
              </h1>
              <p className="text-[11px] text-amber-100 hidden sm:block">
                {t.appTagline}
              </p>
            </div>
          </div>

          {/* Right Controls: GPS Heartbeat, Language, Accessibility, User Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* 1-Second Real-Time Live GPS Sync Badge */}
            <div 
              className="hidden md:flex items-center gap-2 bg-red-950/70 border border-amber-400/40 rounded-full px-3 py-1.5 shadow-inner"
              title="APSRTC Satellite GPS live telematics pinging every second (1 Hz real-time)"
            >
              <div className="relative flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="absolute w-5 h-5 rounded-full bg-emerald-400/50 animate-ping"></span>
              </div>
              <span className="text-xs font-medium text-amber-100">
                {t.liveGpsPinging}: <strong className="text-emerald-300 font-mono text-sm">1s Live</strong>
              </span>
            </div>

            {/* Language Selector: English, Telugu, Hindi */}
            <div className="flex items-center bg-red-900/80 rounded-lg p-1 border border-amber-300/30">
              <Globe className="w-4 h-4 text-amber-300 ml-1 mr-1 hidden sm:block" />
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-2 py-1 text-xs font-semibold rounded transition ${
                  language === 'en'
                    ? 'bg-amber-400 text-red-950 shadow-sm'
                    : 'text-amber-100 hover:text-white hover:bg-red-800'
                }`}
                aria-label="Switch language to English"
              >
                English
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('te')}
                className={`px-2 py-1 text-xs font-semibold rounded transition ${
                  language === 'te'
                    ? 'bg-amber-400 text-red-950 shadow-sm'
                    : 'text-amber-100 hover:text-white hover:bg-red-800'
                }`}
                aria-label="భాషను తెలుగులోకి మార్చండి (Telugu)"
              >
                తెలుగు
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('hi')}
                className={`px-2 py-1 text-xs font-semibold rounded transition ${
                  language === 'hi'
                    ? 'bg-amber-400 text-red-950 shadow-sm'
                    : 'text-amber-100 hover:text-white hover:bg-red-800'
                }`}
                aria-label="भाषा को हिन्दी में बदलें (Hindi)"
              >
                हिन्दी
              </button>
            </div>

            {/* Accessibility Buttons (High Contrast, Large Text, Audio) */}
            <div className="hidden sm:flex items-center gap-1 bg-red-900/60 rounded-lg p-1 border border-amber-300/20">
              {/* Contrast */}
              <button
                type="button"
                onClick={onToggleHighContrast}
                className={`p-1.5 rounded transition ${
                  highContrast ? 'bg-amber-400 text-red-950' : 'text-amber-100 hover:text-white hover:bg-red-800'
                }`}
                title={t.highContrast}
                aria-label={t.highContrast}
              >
                <Eye className="w-4 h-4" />
              </button>

              {/* Text Size */}
              <button
                type="button"
                onClick={onToggleLargeText}
                className={`px-2 py-0.5 text-xs font-bold rounded transition ${
                  largeText ? 'bg-amber-400 text-red-950' : 'text-amber-100 hover:text-white hover:bg-red-800'
                }`}
                title={t.largeText}
                aria-label={t.largeText}
              >
                A+
              </button>

              {/* Audio announcements */}
              <button
                type="button"
                onClick={onToggleAudioAnnouncements}
                className={`p-1.5 rounded transition ${
                  audioAnnouncements ? 'bg-emerald-500 text-white' : 'text-amber-100 hover:text-white hover:bg-red-800'
                }`}
                title={audioAnnouncements ? t.announceStop : t.audioMuted}
                aria-label={t.voiceAnnounce}
              >
                {audioAnnouncements ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>

            {/* Logged-in user badge & logout */}
            {user?.isLoggedIn && (
              <div className="flex items-center gap-2">
                <div className="hidden lg:block text-right">
                  <span className="text-[10px] text-amber-200 block uppercase tracking-wider">
                    {t.loggedInAs}
                  </span>
                  <span className="text-xs font-bold text-white max-w-[120px] truncate block">
                    {user.name || user.phone}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="bg-red-950/70 hover:bg-red-900 text-amber-200 hover:text-white p-2 rounded-lg border border-amber-400/30 transition flex items-center gap-1"
                  title={t.logout}
                  aria-label={t.logout}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Mobile GPS indicator bar */}
        <div className="md:hidden py-1.5 border-t border-red-600/60 flex items-center justify-between text-xs text-amber-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{t.liveGpsStatus}</span>
          </div>
          <span className="font-mono text-emerald-300 font-bold">
            {t.liveGpsPinging}: {gpsCountdown}s
          </span>
        </div>

      </div>
    </header>
  );
};
