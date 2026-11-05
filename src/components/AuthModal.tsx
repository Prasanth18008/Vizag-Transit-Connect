import React, { useState } from 'react';
import { Language, UserProfile } from '../types/transit';
import { translations } from '../utils/translations';
import { Bus, ShieldCheck, Phone, User, CheckCircle2, ArrowRight, Zap, Globe } from 'lucide-react';

interface AuthModalProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  language,
  onLanguageChange,
  onLoginSuccess,
}) => {
  const t = translations[language];
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('4821');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 10) {
      setError(language === 'te' ? 'దయచేసి సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి' : language === 'hi' ? 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें' : 'Please enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    setStep('otp');
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.trim().length < 4) {
      setError(language === 'te' ? 'దయచేసి 4 అంకెల ఓటీపీ నమోదు చేయండి' : language === 'hi' ? 'कृपया 4 अंकों का ओटीपी दर्ज करें' : 'Please enter 4-digit OTP code');
      return;
    }

    const newUser: UserProfile = {
      id: 'usr-' + Date.now(),
      name: name.trim() || (language === 'te' ? 'విశాఖ ప్రయాణికుడు' : language === 'hi' ? 'विशाखा यात्री' : 'Vizag Commuter'),
      phone: phone.trim(),
      isLoggedIn: true,
      preferredLanguage: language,
    };

    onLoginSuccess(newUser);
  };

  const handleQuickDemoLogin = () => {
    const demoUser: UserProfile = {
      id: 'demo-user-1',
      name: language === 'te' ? 'సురేష్ వర్మ (గెస్ట్)' : language === 'hi' ? 'सुरेश वर्मा (अतिथि)' : 'Suresh Varma (Guest)',
      phone: '+91 98480 22338',
      isLoggedIn: true,
      preferredLanguage: language,
    };
    onLoginSuccess(demoUser);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Background Graphic Accents */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Language Selector on Login Screen */}
      <div className="mb-6 flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-full px-4 py-1.5 shadow-lg">
        <Globe className="w-4 h-4 text-amber-400" />
        <span className="text-xs text-slate-300 font-medium mr-1">{t.switchLanguage}:</span>
        <button
          type="button"
          onClick={() => onLanguageChange('en')}
          className={`px-2.5 py-0.5 text-xs font-semibold rounded-full transition ${
            language === 'en' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => onLanguageChange('te')}
          className={`px-2.5 py-0.5 text-xs font-semibold rounded-full transition ${
            language === 'te' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
          }`}
        >
          తెలుగు
        </button>
        <button
          type="button"
          onClick={() => onLanguageChange('hi')}
          className={`px-2.5 py-0.5 text-xs font-semibold rounded-full transition ${
            language === 'hi' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
          }`}
        >
          हिन्दी
        </button>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative z-10">
        
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-red-800 via-red-700 to-amber-700 text-white px-6 py-8 relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white text-red-700 flex items-center justify-center shadow-md border-2 border-amber-300">
              <Bus className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <span className="bg-amber-400 text-red-950 text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase">
                APSRTC VISAKHAPATNAM
              </span>
              <h2 className="text-xl font-extrabold text-white">
                {t.appName}
              </h2>
            </div>
          </div>
          <p className="text-xs text-amber-100 font-medium leading-relaxed">
            {t.loginSubtitle}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          
          <div className="text-center">
            <h3 className="text-lg font-bold text-slate-900">
              {t.loginTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'te' 
                ? 'లైవ్ GPS బస్సు ట్రాకింగ్ మరియు ప్రయాణీకుల సహాయ సేవలను పొందండి' 
                : language === 'hi'
                ? 'लाइव जीपीएस बस ट्रैकिंग और ऑन-बोर्ड सुरक्षा रिपोर्ट की सुविधा'
                : 'Sign in to access live 10-second GPS tracking & crowd reports'}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              {error}
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  {t.nameLabel}
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  {t.phoneLabel} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98480 12345"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-mono tracking-wide focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-red-700 to-red-800 hover:from-red-800 hover:to-red-900 text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>{language === 'te' ? 'ఓటీపీ పొందండి (Get OTP)' : language === 'hi' ? 'ओटीपी प्राप्त करें' : 'Continue with OTP'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <span>{language === 'te' ? 'ఓటీపీ పంపబడిన నంబర్' : language === 'hi' ? 'ओटीपी भेजा गया' : 'OTP sent to'}: <strong>+91 {phone}</strong></span>
                <span className="block text-[11px] text-amber-700 mt-0.5">
                  ({language === 'te' ? 'డెమో కోడ్ ఇప్పటికే నింపబడింది: 4821' : language === 'hi' ? 'डेमो कोड पहले से भरा है: 4821' : 'Demo OTP auto-filled: 4821'})
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  {t.otpLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.slice(0, 4))}
                  maxLength={4}
                  className="w-full text-center py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xl font-mono tracking-widest focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-1/3 py-3 px-3 border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs rounded-xl transition"
                >
                  {language === 'te' ? 'నంబర్ మార్చండి' : language === 'hi' ? 'नंबर बदलें' : 'Change No'}
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.signInButton}</span>
                </button>
              </div>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-semibold">
                {language === 'te' ? 'లేదా తక్షణ ప్రవేశం' : language === 'hi' ? 'या तुरंत शुरू करें' : 'or quick trial'}
              </span>
            </div>
          </div>

          {/* Instant 1-Click Quick Demo Sign In */}
          <button
            type="button"
            onClick={handleQuickDemoLogin}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-xl border border-slate-300 hover:border-slate-400 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
            <span>{t.quickDemoButton}</span>
          </button>

          {/* Security & Accessibility footer note */}
          <div className="flex items-start gap-2 pt-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{t.accessibleNotice}</span>
          </div>

        </div>

      </div>

      <div className="mt-6 text-center text-xs text-slate-400">
        APSRTC Visakhapatnam Urban Bus Transport System • 24x7 Control Room: 0891-2746400
      </div>
    </div>
  );
};
