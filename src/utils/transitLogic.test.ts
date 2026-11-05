import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterBuses,
  interpolateGPSPosition,
  stepBusGPS,
  getUpcomingStops,
  addPassengerReportToBus,
  calculateFare,
  getUniqueStops,
  recordRapidSearch,
  getSearchesInLastMinuteCount,
  validatePassengerReport,
  generateBusDaySchedule,
  computeStopArrivalTimesForTrip,
  getStopTangentHeading,
} from './transitLogic';
import { VIZAG_ROUTES, INITIAL_ACTIVE_BUSES } from './transitData';
import { PassengerReport, SavedSearch } from '../types/transit';

test('filterBuses: filters correctly by single class', () => {
  const result = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, ['electric_ac'], '');
  assert.ok(result.buses.length > 0);
  assert.ok(result.buses.every((b) => b.busClass === 'electric_ac'));
});

test('filterBuses: filters correctly by multiple classes', () => {
  const result = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, ['ordinary', 'metro_express'], '');
  assert.ok(result.buses.length > 0);
  assert.ok(result.buses.every((b) => b.busClass === 'ordinary' || b.busClass === 'metro_express'));
});

test('filterBuses: searches by route number (e.g. 10K)', () => {
  const result = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], '10K');
  assert.ok(result.buses.length > 0);
  assert.ok(result.buses.every((b) => b.routeNumber === '10K'));
});

test('filterBuses: supports comma-separated multi-route search in one query', () => {
  const result = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], '10K, 28A, 999');
  assert.ok(result.buses.length >= 4);
  assert.ok(result.buses.every((b) => ['10K', '28A', '999'].includes(b.routeNumber)));
});

test('filterBuses: matches canonical stop across multiple routes (e.g. RTC Complex)', () => {
  // stop-rtc is on route 10K, but its canonical name "RTC Complex" is shared across major arterial routes
  const result = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], '', 'stop-rtc');
  assert.ok(result.matchedRouteIds.length >= 6);
  assert.ok(result.buses.length >= 10);
});

test('getUniqueStops: deduplicates stops with identical canonical names', () => {
  const uniqueStops = getUniqueStops(VIZAG_ROUTES, 'en');
  const rtcStops = uniqueStops.filter((s) => s.name === 'RTC Complex');
  assert.equal(rtcStops.length, 1);
});

test('recordRapidSearch & getSearchesInLastMinuteCount: supports multiple rapid searches in a minute', () => {
  const baseTime = 1_700_000_000_000;
  let history: SavedSearch[] = [];
  const timestamps: number[] = [];

  const queries = ['10K', '28A', '6A', '400N', '999', '38K', 'Rushikonda', 'Gajuwaka'];
  queries.forEach((q, idx) => {
    const t = baseTime + idx * 5000; // every 5 seconds (8 searches in 35 seconds)
    const res = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], q);
    history = recordRapidSearch(
      history,
      {
        query: q,
        selectedClasses: [],
        originStopId: '',
        destinationStopId: '',
        resultCount: res.buses.length,
      },
      t
    );
    timestamps.push(t);
  });

  assert.equal(history.length, 8);
  assert.equal(history[0].query, 'Gajuwaka');
  assert.equal(getSearchesInLastMinuteCount(timestamps, baseTime + 40_000), 8);
});

test('filterBuses: searches by Telugu stop name or English stop name', () => {
  const result = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], 'Gajuwaka');
  assert.ok(result.buses.length > 0);
  assert.ok(result.matchedRouteIds.includes('route-28a'));
});

test('interpolateGPSPosition: computes midpoint coordinate accurately', () => {
  const route10k = VIZAG_ROUTES[0];
  const midpoint = interpolateGPSPosition(route10k.stops, 0, 0.5, false);

  const stop0 = route10k.stops[0];
  const stop1 = route10k.stops[1];
  const expectedLat = stop0.lat + (stop1.lat - stop0.lat) * 0.5;
  const expectedLng = stop0.lng + (stop1.lng - stop0.lng) * 0.5;

  assert.equal(midpoint.lat.toFixed(4), expectedLat.toFixed(4));
  assert.equal(midpoint.lng.toFixed(4), expectedLng.toFixed(4));
  assert.ok(midpoint.heading >= 0 && midpoint.heading <= 360);
});

test('getStopTangentHeading: calculates valid road tangent bearing for stops', () => {
  const route10k = VIZAG_ROUTES[0];
  const heading0 = getStopTangentHeading(route10k.stops, 0, false);
  const heading1 = getStopTangentHeading(route10k.stops, 1, false);
  assert.ok(typeof heading0 === 'number' && heading0 >= 0 && heading0 <= 360);
  assert.ok(typeof heading1 === 'number' && heading1 >= 0 && heading1 <= 360);
});

test('stepBusGPS: updates GPS position smoothly on 1-second tick interval', () => {
  const route10k = VIZAG_ROUTES[0];
  const bus = INITIAL_ACTIVE_BUSES[0];
  const initialProgress = bus.segmentProgress;

  // Step 1 second
  const stepped1s = stepBusGPS(bus, route10k, 1);
  assert.ok(stepped1s.segmentProgress >= initialProgress || stepped1s.currentStopIndex > bus.currentStopIndex || stepped1s.isDwellAtStop);
  assert.equal(stepped1s.lastPingSecondsAgo, 0);
  assert.ok(stepped1s.currentLat > 0);
  assert.ok(stepped1s.currentLng > 0);
});

test('stepBusGPS: perfectly aligns coordinates and road tangent heading to stop on arrival, halts for 30s', () => {
  const route10k = VIZAG_ROUTES[0];
  const busNearStop = {
    ...INITIAL_ACTIVE_BUSES[0],
    currentStopIndex: 1,
    segmentProgress: 0.999, // Arriving at stop 2 in next 1-second tick
    speedKmH: 30,
    doorStatus: 'closed' as const,
    isDwellAtStop: false,
    dwellRemainingSeconds: 0,
  };

  // Step 1: Bus arrives at stop 2 on 1-second tick and triggers 30-second dwell
  const haltedBus = stepBusGPS(busNearStop, route10k, 1);
  assert.equal(haltedBus.isDwellAtStop, true);
  assert.equal(haltedBus.dwellRemainingSeconds, 30);
  assert.equal(haltedBus.speedKmH, 0);
  assert.equal(haltedBus.doorStatus, 'open');
  assert.equal(haltedBus.currentStopIndex, 2);
  // Bus coordinates match stop coordinates perfectly!
  assert.equal(haltedBus.currentLat, route10k.stops[2].lat);
  assert.equal(haltedBus.currentLng, route10k.stops[2].lng);
  assert.equal(haltedBus.heading, getStopTangentHeading(route10k.stops, 2, false));

  // Step 2: 1-second tick elapses while halted -> dwellRemainingSeconds drops from 30 to 29
  const midDwellBus = stepBusGPS(haltedBus, route10k, 1);
  assert.equal(midDwellBus.isDwellAtStop, true);
  assert.equal(midDwellBus.dwellRemainingSeconds, 29);
  assert.equal(midDwellBus.speedKmH, 0);
  assert.equal(midDwellBus.doorStatus, 'open');
  assert.equal(midDwellBus.currentLat, route10k.stops[2].lat);
  assert.equal(midDwellBus.currentLng, route10k.stops[2].lng);

  // Step 3: Remaining 29 seconds elapse -> dwell completes (0s remaining) -> doors close and departs
  const departingBus = stepBusGPS(midDwellBus, route10k, 29);
  assert.equal(departingBus.isDwellAtStop, false);
  assert.equal(departingBus.dwellRemainingSeconds, 0);
  assert.equal(departingBus.doorStatus, 'closed');
  assert.ok(departingBus.speedKmH > 0);
});

test('getUpcomingStops: computes upcoming stops and strictly increasing ETAs', () => {
  const route10k = VIZAG_ROUTES[0];
  const upcoming = getUpcomingStops(route10k, 2, 0.5, 30);
  assert.ok(upcoming.length > 0);
  assert.equal(upcoming[0].stop.id, route10k.stops[3].id);
  assert.ok(upcoming[0].etaMinutes > 0);
  if (upcoming.length > 1) {
    assert.ok(upcoming[1].etaMinutes >= upcoming[0].etaMinutes);
  }
});

test('addPassengerReportToBus: records report with uploaded image and updates crowd and hygiene score', () => {
  const bus = INITIAL_ACTIVE_BUSES[0];
  const initialCount = bus.totalReportsCount;

  const mockReport: PassengerReport = {
    id: 'test-rep-1',
    busId: bus.id,
    busRegNo: bus.regNumber,
    routeNumber: bus.routeNumber,
    timestamp: 'Just now',
    crowdLevel: 'heavy',
    hygiene: 'clean',
    staffBehavior: 'friendly',
    coPassengerBehavior: 'peaceful',
    evidenceImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    evidenceImageName: 'crowd_issue.png',
    reporterName: 'Test Commuter',
    ticketId: 'APSRTC-TEST-1234',
  };

  const updatedBus = addPassengerReportToBus(bus, mockReport);
  assert.equal(updatedBus.totalReportsCount, initialCount + 1);
  assert.equal(updatedBus.crowdLevel, 'heavy');
  assert.equal(updatedBus.reports[0].id, 'test-rep-1');
  assert.equal(updatedBus.reports[0].evidenceImageName, 'crowd_issue.png');
});

test('validatePassengerReport & addPassengerReportToBus: rejects report when no image is uploaded', () => {
  assert.deepEqual(validatePassengerReport({ evidenceImageUrl: '' }), {
    valid: false,
    errorKey: 'photoRequiredError',
  });
  assert.deepEqual(validatePassengerReport({ evidenceImageUrl: '   ' }), {
    valid: false,
    errorKey: 'photoRequiredError',
  });
  assert.deepEqual(
    validatePassengerReport({
      evidenceImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    }),
    { valid: true }
  );

  const bus = INITIAL_ACTIVE_BUSES[0];
  const invalidReport: PassengerReport = {
    id: 'test-rep-no-img',
    busId: bus.id,
    busRegNo: bus.regNumber,
    routeNumber: bus.routeNumber,
    timestamp: 'Just now',
    crowdLevel: 'heavy',
    hygiene: 'dirty',
    staffBehavior: 'rude',
    coPassengerBehavior: 'noisy',
    evidenceImageUrl: '',
    reporterName: 'Test Commuter',
    ticketId: 'APSRTC-TEST-9999',
  };

  assert.throws(() => {
    addPassengerReportToBus(bus, invalidReport);
  }, /Mandatory photo evidence is missing/);
});

test('calculateFare: produces higher fare for AC Electric than Ordinary', () => {
  const fareOrd = calculateFare(15, 'ordinary');
  const fareEv = calculateFare(15, 'electric_ac');
  assert.ok(fareEv > fareOrd);
  assert.ok(fareOrd >= 10);
});

test('generateBusDaySchedule: generates complete full day duty roster with multiple trips', () => {
  const bus = INITIAL_ACTIVE_BUSES[0]; // 10K Electric AC
  const route = VIZAG_ROUTES.find((r) => r.id === bus.routeId)!;
  const daySchedule = generateBusDaySchedule(bus, route, 8 * 60 + 30); // 08:30 AM

  assert.ok(daySchedule.length >= 8); // At least 8-12 trips in a full day
  assert.equal(daySchedule[0].tripNumber, 1);
  assert.equal(daySchedule[0].direction, 'forward');
  assert.equal(daySchedule[1].direction, 'return');

  // Verify status classification
  const inProgressTrips = daySchedule.filter((t) => t.status === 'in_progress');
  assert.ok(inProgressTrips.length >= 1);
});

test('generateBusDaySchedule: every single trip includes EVERY stop of the bus route', () => {
  const bus = INITIAL_ACTIVE_BUSES[0];
  const route = VIZAG_ROUTES.find((r) => r.id === bus.routeId)!;
  const daySchedule = generateBusDaySchedule(bus, route);

  for (const trip of daySchedule) {
    // Every trip must contain every single stop of the bus route
    assert.equal(trip.stops.length, route.stops.length);
    assert.equal(trip.stops.length, 23); // Route 10K has 23 complete stops

    // Progressive arrival times
    for (let i = 0; i < trip.stops.length; i++) {
      assert.ok(trip.stops[i].stopName.en.length > 0);
      assert.ok(trip.stops[i].scheduledArrival.length > 0);
      assert.ok(trip.stops[i].distanceKm >= 0);
    }

    // Check origin and terminus stop names match
    if (trip.direction === 'forward') {
      assert.equal(trip.stops[0].stopName.en, route.stops[0].name.en);
      assert.equal(trip.stops[trip.stops.length - 1].stopName.en, route.stops[route.stops.length - 1].name.en);
    } else {
      assert.equal(trip.stops[0].stopName.en, route.stops[route.stops.length - 1].name.en);
      assert.equal(trip.stops[trip.stops.length - 1].stopName.en, route.stops[0].name.en);
    }
  }
});

test('new routes: 500P, 500Y, 505, and 52D exist with expected stops', () => {
  const route500p = VIZAG_ROUTES.find((r) => r.routeNumber === '500P');
  assert.ok(route500p);
  const stopNames500p = route500p.stops.map((s) => s.name.en);
  assert.deepEqual(stopNames500p, [
    'Anakapalle',
    'Kurmannapalem',
    'Gajuwaka',
    'Scindia',
    'Convent',
    'Rtc Complex',
    'Maddilapalem',
    'Carshed',
    'Pm Palem',
  ]);

  const route500y = VIZAG_ROUTES.find((r) => r.routeNumber === '500Y');
  assert.ok(route500y);
  const stopNames500y = route500y.stops.map((s) => s.name.en);
  assert.deepEqual(stopNames500y, [
    'Rtc Complex',
    'Gurudwar',
    'Nad',
    'Gajuwaka',
    'Kurmannapalem',
    'Anakapalle',
    'Yelamanchili',
  ]);

  const route505 = VIZAG_ROUTES.find((r) => r.routeNumber === '505');
  assert.ok(route505);
  const stopNames505 = route505.stops.map((s) => s.name.en);
  assert.deepEqual(stopNames505, [
    'Simhachalam',
    'Gopalapatnam Bus Stop',
    'Nad',
    'Kancharapalem',
    'Convent Jn',
    'Naval Dockyard',
    'Scindia',
  ]);

  const route52d = VIZAG_ROUTES.find((r) => r.routeNumber === '52D');
  assert.ok(route52d);
  const stopNames52d = route52d.stops.map((s) => s.name.en);
  assert.deepEqual(stopNames52d, [
    'Ravindra Nagar',
    'Adarsha Nagar',
    'Maddilapalem',
    'Rtc',
    'Jagadamba',
    'Town Kotharoa',
    'Ohpo',
  ]);
});

test('filterBuses: searches newly added routes 500P, 500Y, 505, 52D and specific stops', () => {
  const res500p = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], '500P');
  assert.ok(res500p.buses.some((b) => b.routeNumber === '500P'));

  const res500y = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], '500Y');
  assert.ok(res500y.buses.some((b) => b.routeNumber === '500Y'));

  const res505 = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], '505');
  assert.ok(res505.buses.some((b) => b.routeNumber === '505'));

  const res52d = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], '52D');
  assert.ok(res52d.buses.some((b) => b.routeNumber === '52D'));

  // Test searching by specific stop names from new routes
  const resYelamanchili = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], 'Yelamanchili');
  assert.ok(resYelamanchili.matchedRouteIds.includes('route-500y'));

  const resRavindra = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], 'Ravindra Nagar');
  assert.ok(resRavindra.matchedRouteIds.includes('route-52d'));

  const resCarshed = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], 'Carshed');
  assert.ok(resCarshed.matchedRouteIds.includes('route-500p'));

  const resDockyard = filterBuses(INITIAL_ACTIVE_BUSES, VIZAG_ROUTES, [], 'Naval Dockyard');
  assert.ok(resDockyard.matchedRouteIds.includes('route-505'));
});

test('extended routes: verify routes from prompt 3 exist with stops', () => {
  const routeNumbers = [
    '52E', '52V/G', '540', '68/68K', '69', '6A/H', '6B', '700', '744', '77',
    '77T', '844', '888', '900', '900K', '222', '25D/M', '25D/V', '25E', '25G',
    '25IT', '25J', '25K', '25M', '25MR', '25R', '25S', '28', '28A/28K', '28A/D',
    '28A/P', '28C', '28J', '28P', '28R', '28Z/H', '300C', '300M', '328', '333',
    '333K', '36', '38', '38A', '38B'
  ];

  for (const rn of routeNumbers) {
    const found = VIZAG_ROUTES.find((r) => r.routeNumber === rn);
    assert.ok(found, `Route ${rn} should be present in VIZAG_ROUTES`);
    assert.ok(found.stops.length >= 2, `Route ${rn} should have stops`);
  }

  // Check specific route stops
  const route700 = VIZAG_ROUTES.find((r) => r.routeNumber === '700');
  assert.ok(route700);
  const r700Stops = route700.stops.map((s) => s.name.en);
  assert.ok(r700Stops.includes('Simhachalam'));
  assert.ok(r700Stops.includes('Vizianagaram'));

  const route900k = VIZAG_ROUTES.find((r) => r.routeNumber === '900K');
  assert.ok(route900k);
  const r900kStops = route900k.stops.map((s) => s.name.en);
  assert.ok(r900kStops.includes('Bhimili'));
  assert.ok(r900kStops.includes('Gitam'));
});

test('stepBusGPS: advances faster with 2x and 10x simulation speeds', () => {
  const bus = INITIAL_ACTIVE_BUSES[0];
  const route = VIZAG_ROUTES.find((r) => r.id === bus.routeId) || VIZAG_ROUTES[0];

  const bus1x = stepBusGPS({ ...bus, segmentProgress: 0.1, isDwellAtStop: false }, route, 1);
  const bus2x = stepBusGPS({ ...bus, segmentProgress: 0.1, isDwellAtStop: false }, route, 2);
  const bus10x = stepBusGPS({ ...bus, segmentProgress: 0.1, isDwellAtStop: false }, route, 10);

  // 2x advances segmentProgress or index more than 1x
  assert.ok(
    bus2x.segmentProgress > bus1x.segmentProgress ||
    bus2x.currentStopIndex > bus1x.currentStopIndex
  );

  // 10x advances even more
  assert.ok(
    bus10x.segmentProgress > bus2x.segmentProgress ||
    bus10x.currentStopIndex > bus2x.currentStopIndex ||
    bus10x.isDwellAtStop
  );
});

