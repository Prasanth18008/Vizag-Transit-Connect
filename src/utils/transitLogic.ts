import { 
  ActiveBus, 
  BusClass, 
  Route, 
  BusStop, 
  PassengerReport, 
  CrowdLevel, 
  HygieneLevel, 
  Language, 
  SavedSearch,
  BusDailyTrip,
  StopTiming
} from '../types/transit';

/**
 * Returns deduplicated list of stops across all routes (grouped by canonical English name)
 */
export function getUniqueStops(routes: Route[], language: Language = 'en'): { id: string; name: string; canonicalName: string }[] {
  const seenCanonical = new Map<string, { id: string; name: string; canonicalName: string }>();
  for (const route of routes) {
    for (const stop of route.stops) {
      const canonical = stop.name.en.trim().toLowerCase();
      if (!seenCanonical.has(canonical)) {
        seenCanonical.set(canonical, {
          id: stop.id,
          name: stop.name[language] || stop.name.en,
          canonicalName: canonical,
        });
      }
    }
  }
  return Array.from(seenCanonical.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Helper to check if a route contains a stop matching the given stopId or canonical stop name
 */
function routeHasStop(route: Route, allRoutes: Route[], stopIdOrName: string): boolean {
  if (!stopIdOrName) return true;
  const targetLower = stopIdOrName.trim().toLowerCase();

  // Find canonical English name if stopIdOrName is a known stop ID
  let canonicalName = targetLower;
  for (const r of allRoutes) {
    const found = r.stops.find((s) => s.id === stopIdOrName);
    if (found) {
      canonicalName = found.name.en.trim().toLowerCase();
      break;
    }
  }

  return route.stops.some(
    (s) =>
      s.id === stopIdOrName ||
      s.name.en.trim().toLowerCase() === canonicalName ||
      s.name.en.trim().toLowerCase().includes(canonicalName) ||
      s.name.te.toLowerCase().includes(targetLower) ||
      s.name.hi.toLowerCase().includes(targetLower)
  );
}

/**
 * Filter buses by a set of selected bus classes (empty means all),
 * single or comma-separated route numbers / stop search queries,
 * and origin/destination stops. Supports unlimited rapid searches per minute.
 */
export function filterBuses(
  buses: ActiveBus[],
  routes: Route[],
  selectedClasses: BusClass[],
  searchQuery: string,
  originStopId?: string,
  destinationStopId?: string
): { buses: ActiveBus[]; matchedRouteIds: string[] } {
  const rawQuery = searchQuery.trim().toLowerCase();
  const queryTerms = rawQuery
    .split(',')
    .map((q) => q.trim())
    .filter(Boolean);

  // Find matching routes first
  const matchingRoutes = routes.filter((route) => {
    // Check origin / destination stop requirements (by ID or canonical stop name)
    if (originStopId && !routeHasStop(route, routes, originStopId)) {
      return false;
    }
    if (destinationStopId && !routeHasStop(route, routes, destinationStopId)) {
      return false;
    }

    if (queryTerms.length === 0) return true;

    return queryTerms.some((term) => {
      // Check route number
      if (route.routeNumber.toLowerCase().includes(term)) return true;

      // Check route name
      if (
        route.name.en.toLowerCase().includes(term) ||
        route.name.te.toLowerCase().includes(term) ||
        route.name.hi.toLowerCase().includes(term)
      ) {
        return true;
      }

      // Check any stop name or landmark
      return route.stops.some(
        (s) =>
          s.name.en.toLowerCase().includes(term) ||
          s.name.te.toLowerCase().includes(term) ||
          s.name.hi.toLowerCase().includes(term) ||
          (s.landmark &&
            (s.landmark.en.toLowerCase().includes(term) ||
              s.landmark.te.toLowerCase().includes(term) ||
              s.landmark.hi.toLowerCase().includes(term)))
      );
    });
  });

  const matchedRouteIds = new Set(matchingRoutes.map((r) => r.id));

  const filteredBuses = buses.filter((bus) => {
    // Route matching
    if (!matchedRouteIds.has(bus.routeId)) {
      // Also check registration number against any query term
      const matchesReg =
        queryTerms.length > 0 &&
        queryTerms.some((term) => bus.regNumber.toLowerCase().includes(term));
      if (!matchesReg) {
        return false;
      }
    }

    // Bus class filtering (if classes are selected, bus must match one of them)
    if (selectedClasses.length > 0 && !selectedClasses.includes(bus.busClass)) {
      return false;
    }

    return true;
  });

  // Sort by next departure minutes ascending
  filteredBuses.sort((a, b) => a.nextDepartureMinutes - b.nextDepartureMinutes);

  return {
    buses: filteredBuses,
    matchedRouteIds: Array.from(matchedRouteIds),
  };
}

/**
 * Records a rapid search in the user's recent search history, keeping up to 12 recent searches
 * and allowing unlimited searches per minute.
 */
export function recordRapidSearch(
  history: SavedSearch[],
  params: {
    query: string;
    selectedClasses: BusClass[];
    originStopId: string;
    destinationStopId: string;
    resultCount: number;
    stopNameLookup?: (stopId: string) => string;
  },
  nowMs: number = Date.now()
): SavedSearch[] {
  const { query, selectedClasses, originStopId, destinationStopId, resultCount, stopNameLookup } = params;
  const trimmedQuery = query.trim();

  // Build human-readable label
  const parts: string[] = [];
  if (trimmedQuery) parts.push(trimmedQuery.toUpperCase());
  if (originStopId) {
    const originName = stopNameLookup ? stopNameLookup(originStopId) : originStopId;
    parts.push(`From: ${originName}`);
  }
  if (destinationStopId) {
    const destName = stopNameLookup ? stopNameLookup(destinationStopId) : destinationStopId;
    parts.push(`To: ${destName}`);
  }
  if (selectedClasses.length > 0) {
    parts.push(`${selectedClasses.length} Class${selectedClasses.length > 1 ? 'es' : ''}`);
  }

  const label = parts.length > 0 ? parts.join(' • ') : 'All Active Routes';

  const newEntry: SavedSearch = {
    id: `srch-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
    query: trimmedQuery,
    selectedClasses: [...selectedClasses],
    originStopId,
    destinationStopId,
    timestampMs: nowMs,
    label,
    resultCount,
  };

  // Deduplicate identical consecutive search config while updating timestamp so rapid repeat searches still count
  const filtered = history.filter(
    (item) =>
      !(
        item.query.toLowerCase() === trimmedQuery.toLowerCase() &&
        item.originStopId === originStopId &&
        item.destinationStopId === destinationStopId &&
        item.selectedClasses.slice().sort().join(',') === selectedClasses.slice().sort().join(',')
      )
  );

  return [newEntry, ...filtered].slice(0, 12);
}

/**
 * Counts how many searches were executed within the last 60 seconds
 */
export function getSearchesInLastMinuteCount(timestampsMs: number[], nowMs: number = Date.now()): number {
  return timestampsMs.filter((t) => nowMs - t <= 60_000 && nowMs >= t).length;
}

/**
 * Calculates current GPS position along a route's stops based on
 * currentStopIndex and segmentProgress (0.0 to 1.0)
 */
export function interpolateGPSPosition(
  stops: BusStop[],
  currentStopIndex: number,
  segmentProgress: number,
  isReturning: boolean = false
): { lat: number; lng: number; heading: number } {
  if (stops.length === 0) {
    return { lat: 17.7289, lng: 83.3032, heading: 0 };
  }

  const effectiveStops = isReturning ? [...stops].reverse() : stops;
  const clampedIdx = Math.max(0, Math.min(currentStopIndex, effectiveStops.length - 1));
  const nextIdx = Math.min(clampedIdx + 1, effectiveStops.length - 1);

  const p1 = effectiveStops[clampedIdx];
  const p2 = effectiveStops[nextIdx];

  const t = Math.max(0, Math.min(1, segmentProgress));
  const lat = p1.lat + (p2.lat - p1.lat) * t;
  const lng = p1.lng + (p2.lng - p1.lng) * t;

  // Heading in degrees
  const dLat = p2.lat - p1.lat;
  const dLng = p2.lng - p1.lng;
  let angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  return { lat, lng, heading: Math.round(angle) };
}

/**
 * Calculates the exact tangent heading (bearing in degrees) of the road at a given stop
 */
export function getStopTangentHeading(stops: BusStop[], stopIndex: number, isReturning: boolean = false): number {
  if (stops.length < 2) return 0;
  const effectiveStops = isReturning ? [...stops].reverse() : stops;
  const idx = Math.max(0, Math.min(stopIndex, effectiveStops.length - 1));
  let p1: BusStop;
  let p2: BusStop;
  if (idx < effectiveStops.length - 1) {
    p1 = effectiveStops[idx];
    p2 = effectiveStops[idx + 1];
  } else if (idx > 0) {
    p1 = effectiveStops[idx - 1];
    p2 = effectiveStops[idx];
  } else {
    return 0;
  }
  const dLat = p2.lat - p1.lat;
  const dLng = p2.lng - p1.lng;
  let angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return Math.round(angle);
}

/**
 * Advance bus GPS position simulation by an elapsed duration (1 second by default).
 * Returns an updated ActiveBus object with new coordinates, progress, and speed.
 */
export function stepBusGPS(bus: ActiveBus, route: Route, elapsedSeconds: number = 1): ActiveBus {
  const stops = route.stops;
  if (stops.length < 2) return bus;

  // 1. Handle Active Dwell Stop (30-second stop at bus stops for passenger boarding)
  if (bus.isDwellAtStop) {
    const currentDwell = bus.dwellRemainingSeconds ?? 30;
    const newDwell = Math.max(0, currentDwell - elapsedSeconds);
    const stopObj = stops[bus.currentStopIndex] || stops[0];
    const tangentHeading = getStopTangentHeading(stops, bus.currentStopIndex, bus.isReturning);

    if (newDwell > 0) {
      // Still halted at the stop: lock coordinates directly to stop with 100% precision
      return {
        ...bus,
        currentLat: stopObj.lat,
        currentLng: stopObj.lng,
        heading: tangentHeading,
        speedKmH: 0,
        doorStatus: 'open',
        isDwellAtStop: true,
        dwellRemainingSeconds: newDwell,
        dwellStopName: stopObj.name,
        lastPingSecondsAgo: 0,
      };
    }

    // 30 seconds dwell time has completed! Doors close, bus resumes departure
    // Begin departure onto the segment towards the next stop
    return {
      ...bus,
      currentLat: stopObj.lat,
      currentLng: stopObj.lng,
      heading: tangentHeading,
      speedKmH: 26, // Resuming road departure speed
      doorStatus: 'closed',
      isDwellAtStop: false,
      dwellRemainingSeconds: 0,
      dwellStopName: undefined,
      segmentProgress: 0.02,
      lastPingSecondsAgo: 0,
    };
  }

  // 2. Bus is cruising along the route segment between stops
  // Typical bus speed between 25 and 45 km/h with realistic micro-variations
  const speedVariation = (Math.sin(Date.now() / 8000 + bus.currentStopIndex) * 6);
  const currentSpeed = Math.max(22, Math.min(50, Math.round(bus.speedKmH + speedVariation * 0.2)));

  // Distance traveled in this tick (km) = (km/h) * (seconds / 3600)
  const distanceTraveledKm = (currentSpeed * elapsedSeconds) / 3600;

  // Distance between current stop and next stop
  const fromStop = stops[bus.currentStopIndex] || stops[0];
  const toStop = stops[Math.min(bus.currentStopIndex + 1, stops.length - 1)] || stops[stops.length - 1];
  const segmentDistanceKm = Math.max(0.4, Math.abs(toStop.distanceFromStartKm - fromStop.distanceFromStartKm));

  // Additional progress fraction = distance / segmentDistance
  const addedProgress = distanceTraveledKm / segmentDistanceKm;
  let newProgress = bus.segmentProgress + addedProgress;
  let newStopIndex = bus.currentStopIndex;
  let newIsReturning = bus.isReturning;

  // Check if bus arrives at the next stop point
  if (newProgress >= 1.0) {
    newStopIndex += 1;
    let reachedTerminal = false;

    // Check if reached terminal stop
    if (newStopIndex >= stops.length - 1) {
      newStopIndex = stops.length - 1;
      reachedTerminal = true;
    }

    const arrivedStop = stops[newStopIndex];
    const stopHeading = getStopTangentHeading(stops, newStopIndex, newIsReturning);

    // Bus has arrived at a stop point! Perfectly align coordinates and road heading
    return {
      ...bus,
      currentLat: arrivedStop.lat,
      currentLng: arrivedStop.lng,
      heading: stopHeading,
      speedKmH: 0,
      doorStatus: 'open',
      isDwellAtStop: true,
      dwellRemainingSeconds: 30, // 30 seconds dwell stop
      dwellStopName: arrivedStop.name,
      currentStopIndex: reachedTerminal ? 0 : newStopIndex,
      segmentProgress: 0,
      isReturning: reachedTerminal ? !newIsReturning : newIsReturning,
      lastPingSecondsAgo: 0,
      nextDepartureMinutes: Math.max(1, bus.nextDepartureMinutes - (elapsedSeconds >= 60 ? Math.floor(elapsedSeconds / 60) : 0)),
    };
  }

  // Bus is in motion between stops
  const { lat, lng, heading } = interpolateGPSPosition(stops, newStopIndex, newProgress, newIsReturning);

  // Update departure / arrival minutes countdown
  const updatedMinutes = Math.max(1, bus.nextDepartureMinutes - (elapsedSeconds >= 60 ? Math.floor(elapsedSeconds / 60) : 0));

  return {
    ...bus,
    currentLat: Number(lat.toFixed(6)),
    currentLng: Number(lng.toFixed(6)),
    heading,
    speedKmH: currentSpeed,
    doorStatus: 'closed',
    isDwellAtStop: false,
    dwellRemainingSeconds: 0,
    currentStopIndex: newStopIndex,
    segmentProgress: Number(newProgress.toFixed(4)),
    isReturning: newIsReturning,
    lastPingSecondsAgo: 0,
    nextDepartureMinutes: updatedMinutes,
  };
}

/**
 * Calculates remaining stops and estimated minutes to next stop
 */
export function getUpcomingStops(
  route: Route,
  currentStopIndex: number,
  segmentProgress: number,
  averageSpeedKmH: number = 30
): { stop: BusStop; etaMinutes: number }[] {
  const result: { stop: BusStop; etaMinutes: number }[] = [];
  const stops = route.stops;

  let cumulativeDistance = 0;
  const currentStop = stops[currentStopIndex] || stops[0];
  const nextStop = stops[currentStopIndex + 1] || stops[stops.length - 1];

  const currentSegmentDistance = Math.abs(nextStop.distanceFromStartKm - currentStop.distanceFromStartKm);
  const remainingInSegment = currentSegmentDistance * (1 - segmentProgress);

  for (let i = currentStopIndex + 1; i < stops.length; i++) {
    const s = stops[i];
    if (i === currentStopIndex + 1) {
      cumulativeDistance += remainingInSegment;
    } else {
      const prevStop = stops[i - 1];
      cumulativeDistance += Math.abs(s.distanceFromStartKm - prevStop.distanceFromStartKm);
    }

    const etaMin = Math.max(1, Math.round((cumulativeDistance / averageSpeedKmH) * 60));
    result.push({
      stop: s,
      etaMinutes: etaMin,
    });
  }

  return result;
}

/**
 * Validates that a passenger report includes a mandatory uploaded image.
 * Without an image, a report cannot be filed.
 */
export function validatePassengerReport(input: {
  evidenceImageUrl?: string | null;
  evidenceImageName?: string | null;
}): { valid: boolean; errorKey?: string } {
  const url = input.evidenceImageUrl ? input.evidenceImageUrl.trim() : '';
  if (!url) {
    return {
      valid: false,
      errorKey: 'photoRequiredError',
    };
  }
  return { valid: true };
}

/**
 * Add a passenger report and recalculate bus crowd and hygiene statistics.
 * Enforces mandatory photo evidence — rejects reports without an uploaded image.
 */
export function addPassengerReportToBus(bus: ActiveBus, report: PassengerReport): ActiveBus {
  const validation = validatePassengerReport({
    evidenceImageUrl: report.evidenceImageUrl,
    evidenceImageName: report.evidenceImageName,
  });
  if (!validation.valid) {
    throw new Error('Mandatory photo evidence is missing: cannot file a report without an uploaded image.');
  }

  const updatedReports = [report, ...(bus.reports || [])];

  // Recalculate crowd level based on latest reports
  const crowdLevel = report.crowdLevel;

  // Recalculate hygiene score: clean = 5.0, moderate = 4.0, dirty = 3.0, critical = 2.0
  const scoreMap: Record<HygieneLevel, number> = {
    clean: 5.0,
    moderate: 4.0,
    dirty: 3.0,
    critical: 2.0,
  };

  const newScore = scoreMap[report.hygiene] || 4.5;
  const currentCount = bus.totalReportsCount || updatedReports.length;
  const newTotalCount = currentCount + 1;
  const updatedHygiene = Number(((bus.hygieneScore * currentCount + newScore) / newTotalCount).toFixed(1));

  return {
    ...bus,
    crowdLevel,
    hygieneScore: Math.min(5.0, Math.max(1.0, updatedHygiene)),
    totalReportsCount: newTotalCount,
    reports: updatedReports,
  };
}

/**
 * Calculate estimated fare in INR based on distance and bus class
 */
export function calculateFare(distanceKm: number, busClass: BusClass): number {
  const baseFares: Record<BusClass, { min: number; perKm: number }> = {
    ordinary: { min: 10, perKm: 1.2 },
    metro_express: { min: 15, perKm: 1.6 },
    metro_deluxe: { min: 20, perKm: 2.2 },
    electric_ac: { min: 25, perKm: 3.0 },
  };

  const config = baseFares[busClass] || baseFares.ordinary;
  const rawFare = config.min + distanceKm * config.perKm;
  // Round to nearest 5 rupees
  return Math.max(config.min, Math.round(rawFare / 5) * 5);
}

/**
 * Parses time string (e.g. "05:30 AM", "08:15 PM") into minutes from midnight (0 - 1439)
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(/[:\s]/);
  let hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10) || 0;
  const meridiem = parts[2] ? parts[2].toUpperCase() : 'AM';

  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  return hour * 60 + minute;
}

/**
 * Formats minutes from midnight (0 - 1439) into "hh:mm AM/PM"
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  let hour = Math.floor(normalized / 60);
  const min = normalized % 60;
  const meridiem = hour >= 12 ? 'PM' : 'AM';

  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;

  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')} ${meridiem}`;
}

/**
 * Computes scheduled arrival times and elapsed minutes for every single stop on a trip
 */
export function computeStopArrivalTimesForTrip(
  stops: BusStop[],
  departureTimeStr: string,
  totalDurationMinutes: number,
  totalDistanceKm: number
): StopTiming[] {
  const baseMinutes = parseTimeToMinutes(departureTimeStr);
  const maxDistance = Math.max(1, totalDistanceKm);
  const duration = Math.max(15, totalDurationMinutes);

  return stops.map((stop, index) => {
    const fraction = stop.distanceFromStartKm / maxDistance;
    const elapsedMinutes = Math.round(fraction * duration);
    const stopMinutes = (baseMinutes + elapsedMinutes) % 1440;
    const scheduledArrival = formatMinutesToTime(stopMinutes);

    return {
      stopId: stop.id,
      stopIndex: index + 1,
      stopName: stop.name,
      distanceKm: Number(stop.distanceFromStartKm.toFixed(1)),
      scheduledArrival,
      elapsedMinutes,
      landmark: stop.landmark,
      isStageStop: stop.isStageStop ?? (index === 0 || index === stops.length - 1 || stop.landmark !== undefined),
    };
  });
}

/**
 * Generates the complete 24-hour daily duty schedule for an APSRTC bus.
 * Includes every single round-trip performed throughout the entire day,
 * and every single intermediate stop on each trip with exact calculated arrival times!
 */
export function generateBusDaySchedule(
  bus: ActiveBus,
  route: Route,
  referenceTimeMinutes?: number
): BusDailyTrip[] {
  const trips: BusDailyTrip[] = [];
  const dutyCode = bus.dailyDutyCode || `DUTY-VZ-${bus.routeNumber}-${bus.id.replace('bus-', '')}`;
  
  // Starting departure for this specific bus
  const firstBusMinutes = parseTimeToMinutes(bus.dutyStartTime || route.firstBus || '05:30 AM');
  const lastBusMinutes = parseTimeToMinutes(bus.dutyEndTime || route.lastBus || '10:30 PM');
  const tripDuration = Math.max(25, route.typicalDurationMinutes || 60);
  const terminalLayover = 20; // 20 minutes layover for passenger interchange & crew break

  // Current operational minute
  const now = new Date();
  const currentMinutes = referenceTimeMinutes !== undefined 
    ? referenceTimeMinutes 
    : now.getHours() * 60 + now.getMinutes();

  let departureMin = firstBusMinutes;
  let tripNum = 1;

  // Forward stops sequence (Origin ➔ Destination)
  const forwardStops = route.stops;

  // Return stops sequence (Destination ➔ Origin) with distances reversed from 0 to totalDistance
  const totalDist = route.totalDistanceKm || 30;
  const returnStops: BusStop[] = [...route.stops].reverse().map((stop) => ({
    ...stop,
    distanceFromStartKm: Number(Math.max(0, totalDist - stop.distanceFromStartKm).toFixed(1)),
  }));

  while (departureMin <= lastBusMinutes && tripNum <= 14) {
    const isForward = tripNum % 2 !== 0;
    const activeStops = isForward ? forwardStops : returnStops;
    const origin = isForward ? route.origin : route.destination;
    const destination = isForward ? route.destination : route.origin;

    const arrivalMin = departureMin + tripDuration;
    const departureStr = formatMinutesToTime(departureMin);
    const arrivalStr = formatMinutesToTime(arrivalMin);

    // Compute every single stop timing for this trip
    const stopTimings = computeStopArrivalTimesForTrip(
      activeStops,
      departureStr,
      tripDuration,
      totalDist
    );

    // Determine status relative to current time and bus active state
    let status: 'completed' | 'in_progress' | 'scheduled' = 'scheduled';
    if (arrivalMin < currentMinutes) {
      status = 'completed';
    } else if (departureMin <= currentMinutes && currentMinutes <= arrivalMin) {
      status = 'in_progress';
    } else {
      status = 'scheduled';
    }

    // If bus active departure time matches this trip or this trip is closest in progress
    if (bus.departureTimeFormatted && departureStr.trim() === bus.departureTimeFormatted.trim()) {
      status = 'in_progress';
    }

    trips.push({
      tripNumber: tripNum,
      tripId: `${dutyCode}-TRIP-${String(tripNum).padStart(2, '0')}`,
      dutyCode,
      direction: isForward ? 'forward' : 'return',
      originName: origin,
      destinationName: destination,
      originDepartureTime: departureStr,
      destinationArrivalTime: arrivalStr,
      durationMinutes: tripDuration,
      distanceKm: totalDist,
      status,
      stops: stopTimings,
    });

    // Advance to next trip after layover
    departureMin = arrivalMin + terminalLayover;
    tripNum += 1;
  }

  // Ensure at least one trip is marked in_progress if active on road
  const hasInProgress = trips.some((t) => t.status === 'in_progress');
  if (!hasInProgress && trips.length > 0) {
    // Find closest upcoming or fallback to trip 1
    const nextScheduled = trips.find((t) => t.status === 'scheduled') || trips[0];
    nextScheduled.status = 'in_progress';
  }

  return trips;
}
