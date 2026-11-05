import React, { useState, useRef } from 'react';
import { 
  ActiveBus, 
  Language, 
  CrowdLevel, 
  HygieneLevel, 
  StaffBehaviorRating, 
  CoPassengerBehavior,
  PassengerReport
} from '../types/transit';
import { translations } from '../utils/translations';
import { validatePassengerReport } from '../utils/transitLogic';
import { 
  X, 
  AlertTriangle, 
  Users, 
  Sparkles, 
  ShieldCheck, 
  HeartHandshake, 
  CheckCircle2, 
  Send,
  Camera,
  Upload,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';

interface PassengerReportModalProps {
  bus: ActiveBus;
  language: Language;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReport: (report: PassengerReport) => void;
  userName?: string;
}

export const PassengerReportModal: React.FC<PassengerReportModalProps> = ({
  bus,
  language,
  isOpen,
  onClose,
  onSubmitReport,
  userName,
}) => {
  const t = translations[language];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>(bus.crowdLevel || 'moderate');
  const [hygiene, setHygiene] = useState<HygieneLevel>('clean');
  const [staffBehavior, setStaffBehavior] = useState<StaffBehaviorRating>('friendly');
  const [coPassengerBehavior, setCoPassengerBehavior] = useState<CoPassengerBehavior>('peaceful');
  const [otherProblems, setOtherProblems] = useState('');
  const [evidenceImageUrl, setEvidenceImageUrl] = useState<string>('');
  const [evidenceImageName, setEvidenceImageName] = useState<string>('');
  const [photoError, setPhotoError] = useState<string>('');
  const [submittedToken, setSubmittedToken] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelection = (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError(
        language === 'te'
          ? 'దయచేసి చెల్లుబాటు అయ్యే చిత్రం ఫైల్ (JPG, PNG, WEBP) ఎంచుకోండి.'
          : language === 'hi'
          ? 'कृपया एक मान्य छवि फ़ाइल (JPG, PNG, WEBP) चुनें।'
          : 'Please select a valid image file (JPG, PNG, WEBP).'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setEvidenceImageUrl(result);
      setEvidenceImageName(file.name);
      setPhotoError('');
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFileSelection(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    handleFileSelection(file);
  };

  const handleRemovePhoto = () => {
    setEvidenceImageUrl('');
    setEvidenceImageName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validatePassengerReport({
      evidenceImageUrl,
      evidenceImageName,
    });

    if (!validation.valid) {
      setPhotoError(t.photoRequiredError);
      return;
    }

    setPhotoError('');
    const token = 'APSRTC-VZ-' + Math.floor(10000 + Math.random() * 90000);

    const report: PassengerReport = {
      id: 'rep-' + Date.now(),
      busId: bus.id,
      busRegNo: bus.regNumber,
      routeNumber: bus.routeNumber,
      timestamp: 'Just now',
      crowdLevel,
      hygiene,
      staffBehavior,
      coPassengerBehavior,
      otherProblems: otherProblems.trim() || undefined,
      evidenceImageUrl,
      evidenceImageName,
      reporterName: userName || (language === 'te' ? 'విశాఖ ప్రయాణికుడు' : language === 'hi' ? 'विशाखा यात्री' : 'Vizag Commuter'),
      ticketId: token,
    };

    onSubmitReport(report);
    setSubmittedToken(token);
  };

  const handleClose = () => {
    setSubmittedToken(null);
    setOtherProblems('');
    setEvidenceImageUrl('');
    setEvidenceImageName('');
    setPhotoError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden relative my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-800 to-amber-700 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-red-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">
                {t.reportTitle}
              </h3>
              <p className="text-xs text-amber-100">
                {t.reportingForBus}: <strong className="font-mono text-amber-300">{bus.routeNumber} ({bus.regNumber})</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {submittedToken ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-300">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-900">
                {t.reportSuccessTitle}
              </h4>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                {t.reportSuccessMessage}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl inline-block">
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                Grievance Reference ID
              </span>
              <span className="text-lg font-mono font-black text-red-700">
                {submittedToken}
              </span>
            </div>

            {evidenceImageUrl && (
              <div className="max-w-xs mx-auto bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 text-left flex items-center gap-3">
                <img
                  src={evidenceImageUrl}
                  alt={evidenceImageName || 'Uploaded onboard issue'}
                  className="w-14 h-14 rounded-xl object-cover border border-emerald-300 shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">
                    ✓ {t.photoUploadedBadge}
                  </span>
                  <span className="text-xs font-semibold text-slate-700 truncate block">
                    {evidenceImageName || 'onboard_evidence.jpg'}
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-6 rounded-xl transition cursor-pointer shadow-sm"
              >
                {t.closeModal}
              </button>
            </div>
          </div>
        ) : (
          /* Report Submission Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            
            {/* Validation Error Alert if user tries to submit without an uploaded image */}
            {photoError && (
              <div
                role="alert"
                data-testid="photo-required-error"
                className="p-3.5 bg-red-50 border-2 border-red-500 rounded-xl text-xs font-bold text-red-800 flex items-start gap-2.5 shadow-sm"
              >
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{photoError}</span>
              </div>
            )}

            {/* 1. Crowd Level */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <Users className="w-4 h-4 text-red-700" />
                <span>{t.categoryCrowd}</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['low', 'moderate', 'standing', 'heavy'] as CrowdLevel[]).map((level) => {
                  const isSelected = crowdLevel === level;
                  let label = t.crowdLow;
                  if (level === 'moderate') label = t.crowdModerate;
                  if (level === 'standing') label = t.crowdStanding;
                  if (level === 'heavy') label = t.crowdHeavy;

                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setCrowdLevel(level)}
                      className={`py-2 px-2.5 rounded-xl border-2 text-xs font-bold transition text-center cursor-pointer ${
                        isSelected
                          ? 'border-red-600 bg-red-50 text-red-900 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Bus Hygiene */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>{t.categoryHygiene}</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['clean', 'moderate', 'dirty', 'critical'] as HygieneLevel[]).map((lvl) => {
                  const isSelected = hygiene === lvl;
                  let label = t.hygieneClean;
                  if (lvl === 'moderate') label = t.hygieneModerate;
                  if (lvl === 'dirty') label = t.hygieneDirty;
                  if (lvl === 'critical') label = t.hygieneCritical;

                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setHygiene(lvl)}
                      className={`py-2 px-2.5 rounded-xl border-2 text-xs font-bold transition text-center cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Staff Behavior (Driver & Conductor) */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>{t.categoryStaff}</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'friendly' as StaffBehaviorRating, label: t.behaviorFriendly },
                  { id: 'satisfactory' as StaffBehaviorRating, label: t.behaviorSatisfactory },
                  { id: 'rude' as StaffBehaviorRating, label: t.behaviorRude },
                  { id: 'rash_driving' as StaffBehaviorRating, label: t.behaviorRashDriving },
                  { id: 'skipped_stop' as StaffBehaviorRating, label: t.behaviorSkippedStop },
                ].map((item) => {
                  const isSelected = staffBehavior === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStaffBehavior(item.id)}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition text-left cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Co-Passenger Behavior */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <HeartHandshake className="w-4 h-4 text-purple-600" />
                <span>{t.categoryCoPassenger}</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'peaceful' as CoPassengerBehavior, label: t.coPassengerPeaceful },
                  { id: 'noisy' as CoPassengerBehavior, label: t.coPassengerNoisy },
                  { id: 'disorderly' as CoPassengerBehavior, label: t.coPassengerDisorderly },
                  { id: 'seat_conflict' as CoPassengerBehavior, label: t.coPassengerSeatConflict },
                ].map((item) => {
                  const isSelected = coPassengerBehavior === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCoPassengerBehavior(item.id)}
                      className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition text-left cursor-pointer ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Other Problems & Grievances */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5 uppercase tracking-wide">
                {t.categoryOther}
              </label>
              <textarea
                value={otherProblems}
                onChange={(e) => setOtherProblems(e.target.value)}
                placeholder={t.otherProblemsPlaceholder}
                rows={2}
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
              />
            </div>

            {/* 6. Mandatory Image Upload to File Report */}
            <div>
              <label
                htmlFor="report-evidence-image-input"
                className="block text-xs font-black text-slate-900 mb-1.5 uppercase tracking-wide flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-red-700" />
                  <span>{t.categoryPhoto}</span>
                  <span className="text-red-600 font-black">*</span>
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                  {language === 'te' ? 'తప్పనిసరి (Mandatory)' : language === 'hi' ? 'अनिवार्य (Mandatory)' : 'Required'}
                </span>
              </label>

              <input
                id="report-evidence-image-input"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                aria-label={t.uploadPhotoLabel}
                className="sr-only"
              />

              {!evidenceImageUrl ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition ${
                    photoError
                      ? 'border-red-500 bg-red-50/70'
                      : 'border-slate-300 hover:border-red-500 bg-slate-50 hover:bg-red-50/30'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-extrabold text-slate-800">
                    {t.uploadPhotoLabel}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t.uploadPhotoHint}
                  </p>
                </div>
              ) : (
                <div
                  data-testid="uploaded-photo-preview"
                  className="p-3 bg-emerald-50/80 border-2 border-emerald-500 rounded-2xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={evidenceImageUrl}
                      alt={evidenceImageName || 'Uploaded onboard issue'}
                      className="w-16 h-16 rounded-xl object-cover border border-emerald-300 shrink-0 shadow-xs"
                    />
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{t.photoUploadedBadge}</span>
                      </span>
                      <p className="text-xs font-bold text-slate-900 truncate mt-1">
                        {evidenceImageName}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.removePhotoBtn}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-1/3 py-3 border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {t.closeModal}
              </button>
              <button
                type="submit"
                className={`w-2/3 font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer text-xs ${
                  evidenceImageUrl
                    ? 'bg-red-700 hover:bg-red-800 text-white'
                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>{t.submitReportBtn}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
