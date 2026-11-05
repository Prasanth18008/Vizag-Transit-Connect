export type Language = 'en' | 'te' | 'hi';

export type BusClass = 'ordinary' | 'metro_express' | 'metro_deluxe' | 'electric_ac';

export interface LocalizedString {
  en: string;
  te: string;
  hi: string;
}

export interface BusStop {
  id: string;
  name: LocalizedString;
  lat: number;
  lng: number;
  distanceFromStartKm: number;
  landmark?: LocalizedString;
  isStageStop?: boolean; // Major fare stage / transit interchange
  stopCode?: string; // APSRTC stage code
}

export interface StopTiming {
  stopId: string;
  stopIndex: number;
  stopName: LocalizedString;
  distanceKm: number;
  scheduledArrival: string;
  elapsedMinutes: number;
  landmark?: LocalizedString;
  isStageStop?: boolean;
}

export interface BusDailyTrip {
  tripNumber: number;
  tripId: string;
  dutyCode: string;
  direction: 'forward' | 'return';
  originName: LocalizedString;
  destinationName: LocalizedString;
  originDepartureTime: string;
  destinationArrivalTime: string;
  durationMinutes: number;
  distanceKm: number;
  status: 'completed' | 'in_progress' | 'scheduled';
  stops: StopTiming[];
}

export interface StaffMember {
  role: 'driver' | 'conductor';
  name: string;
  id: string;
  badgeNo: string;
  phone?: string;
  rating: number;
  depot: string;
  photoUrl?: string;
}

export interface BusClassInfo {
  id: BusClass;
  title: LocalizedString;
  code: string;
  description: LocalizedString;
  fareMultiplier: number;
  color: string;
  bgBadge: string;
  borderBadge: string;
  icon: string;
}

export type CrowdLevel = 'low' | 'moderate' | 'standing' | 'heavy';
export type HygieneLevel = 'clean' | 'moderate' | 'dirty' | 'critical';
export type StaffBehaviorRating = 'friendly' | 'satisfactory' | 'rude' | 'rash_driving' | 'skipped_stop';
export type CoPassengerBehavior = 'peaceful' | 'noisy' | 'disorderly' | 'seat_conflict';

export interface PassengerReport {
  id: string;
  busId: string;
  busRegNo: string;
  routeNumber: string;
  timestamp: string;
  crowdLevel: CrowdLevel;
  hygiene: HygieneLevel;
  staffBehavior: StaffBehaviorRating;
  coPassengerBehavior: CoPassengerBehavior;
  otherProblems?: string;
  evidenceImageUrl: string;
  evidenceImageName?: string;
  reporterName: string;
  ticketId: string;
}

export interface ActiveBus {
  id: string;
  regNumber: string;
  routeId: string;
  routeNumber: string;
  busClass: BusClass;
  depot: LocalizedString;
  driver: StaffMember;
  conductor: StaffMember;
  currentLat: number;
  currentLng: number;
  heading: number; // in degrees
  speedKmH: number;
  lastPingSecondsAgo: number;
  currentStopIndex: number; // index of the stop it just passed or is at
  segmentProgress: number; // 0.0 to 1.0 along current route segment
  isReturning: boolean;
  crowdLevel: CrowdLevel;
  hygieneScore: number; // e.g. 4.5
  totalReportsCount: number;
  doorStatus: 'closed' | 'open';
  airConditioned: boolean;
  departureTimeFormatted: string;
  nextDepartureMinutes: number;
  reports: PassengerReport[];
  dailyDutyCode?: string;
  dutyStartTime?: string;
  dutyEndTime?: string;
  currentTripNumber?: number;
  isDwellAtStop?: boolean; // True when bus is halted at a stop for 30s passenger boarding
  dwellRemainingSeconds?: number; // 30s countdown while halted at stop
  dwellStopName?: LocalizedString;
}

export interface Route {
  id: string;
  routeNumber: string;
  name: LocalizedString;
  origin: LocalizedString;
  destination: LocalizedString;
  availableClasses: BusClass[];
  stops: BusStop[];
  totalDistanceKm: number;
  typicalDurationMinutes: number;
  firstBus: string;
  lastBus: string;
  frequencyMinutes: number;
  platformBay?: LocalizedString;
  depotOrigin?: LocalizedString;
  scheduledDepartures?: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  isLoggedIn: boolean;
  preferredLanguage: Language;
}

export interface SavedSearch {
  id: string;
  query: string;
  selectedClasses: BusClass[];
  originStopId: string;
  destinationStopId: string;
  timestampMs: number;
  label: string;
  resultCount: number;
}

