import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { ActiveBus, BusStop, Language, Route } from '../types/transit';
import { translations } from '../utils/translations';
import { BUS_CLASSES } from '../utils/transitData';
import { 
  Bus, 
  MapPin, 
  Navigation, 
  LocateFixed, 
  Layers, 
  Compass, 
  Maximize2, 
  Minimize2, 
  Plus, 
  Minus, 
  Gauge, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Info
} from 'lucide-react';

interface LiveRouteMapProps {
  bus: ActiveBus;
  route: Route;
  language: Language;
  onStopClick?: (stop: BusStop) => void;
}

type MapLayerType = 'google' | 'satellite' | 'geo' | 'night';

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
  bus,
  route,
  language,
  onStopClick,
}) => {
  const t = translations[language];
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const passedPolylineRef = useRef<L.Polyline | null>(null);
  const trafficPolylinesRef = useRef<L.Polyline[]>([]);
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapLayer, setMapLayer] = useState<MapLayerType>('google');
  const [currentZoom, setCurrentZoom] = useState<number>(14);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [showTraffic, setShowTraffic] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState<number>(bus.speedKmH);
  const [interpolatedPos, setInterpolatedPos] = useState<[number, number]>([bus.currentLat, bus.currentLng]);

  // Calculate bus icon scale: when zooming in on satellite map, the bus icon reduces
  // so that high-resolution satellite imagery, lanes, and landmarks aren't obscured
  const calculateBusScale = (layer: MapLayerType, zoom: number): number => {
    if (layer === 'satellite') {
      const baseZoom = 12; // At city overview (<=12), scale is 1.0 (100%)
      if (zoom > baseZoom) {
        // Reduces progressively: 14 -> 76%, 15 -> 64%, 16 -> 52%, 17 -> 40%, 18 -> 28%, 19 -> 22%
        const scale = Math.max(0.22, Math.min(1.0, 1.0 - (zoom - baseZoom) * 0.12));
        return Number(scale.toFixed(2));
      }
      return 1.0;
    }
    return 1.0;
  };

  // Target coordinates for continuous smooth interpolation
  const targetPosRef = useRef<[number, number]>([bus.currentLat, bus.currentLng]);
  const currentPosRef = useRef<[number, number]>([bus.currentLat, bus.currentLng]);
  const animationFrameRef = useRef<number | null>(null);

  const busClassInfo = useMemo(() => {
    return BUS_CLASSES.find((c) => c.id === bus.busClass) || BUS_CLASSES[0];
  }, [bus.busClass]);

  // Next upcoming stop
  const nextStop = useMemo(() => {
    if (bus.currentStopIndex < route.stops.length - 1) {
      return route.stops[bus.currentStopIndex + 1];
    }
    return route.stops[route.stops.length - 1];
  }, [bus.currentStopIndex, route.stops]);

  // Distance to next stop (approx)
  const distanceToNextKm = useMemo(() => {
    if (!nextStop) return 0;
    const dLat = (nextStop.lat - bus.currentLat) * 111;
    const dLng = (nextStop.lng - bus.currentLng) * 111 * Math.cos((bus.currentLat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    return Math.max(0.2, Number(dist.toFixed(1)));
  }, [nextStop, bus.currentLat, bus.currentLng]);

  // Estimated arrival time to next stop
  const etaMinutesToNext = useMemo(() => {
    const speed = Math.max(20, bus.speedKmH);
    const mins = Math.round((distanceToNextKm / speed) * 60);
    return Math.max(1, mins);
  }, [distanceToNextKm, bus.speedKmH]);

  // Tile layer URLs
  const getTileUrl = (type: MapLayerType) => {
    switch (type) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'geo':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
      case 'night':
        return 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png';
      case 'google':
      default:
        // CartoDB Voyager tiles have the authentic Google Maps look & feel (cream land, baby-blue water, clean road network)
        return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }
  };

  const getTileAttribution = (type: MapLayerType) => {
    switch (type) {
      case 'satellite':
        return '&copy; Esri &mdash; DigitalGlobe, GeoEye, Earthstar';
      case 'geo':
        return '&copy; Esri &mdash; National Geographic, DeLorme, NAVTEQ (Geographical Topo)';
      case 'night':
        return '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap';
      case 'google':
      default:
        return 'Map data &copy; OpenStreetMap contributors &copy; CARTO (Google Maps style)';
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [bus.currentLat, bus.currentLng],
        zoom: 14,
        zoomControl: false, // We render custom Google Maps style zoom buttons
        attributionControl: true,
        scrollWheelZoom: false, // Smooth page scrolling without scroll trapping
      });

      const initialTileLayer = L.tileLayer(getTileUrl('google'), {
        attribution: getTileAttribution('google'),
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      tileLayerRef.current = initialTileLayer;
      mapInstanceRef.current = map;

      // When user manually pans/drags the map, pause autoFollow so they can freely explore
      map.on('dragstart', () => {
        setAutoFollow(false);
      });

      // Synchronize currentZoom on zoom / zoomend so bus icon scales dynamically
      map.on('zoom', () => {
        setCurrentZoom(map.getZoom());
      });
      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer when layer type changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const newTileLayer = L.tileLayer(getTileUrl(mapLayer), {
      attribution: getTileAttribution(mapLayer),
      maxZoom: 19,
      subdomains: mapLayer === 'satellite' || mapLayer === 'geo' ? '' : 'abcd',
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTileLayer;
  }, [mapLayer]);

  // Update target coordinates when bus prop updates
  useEffect(() => {
    targetPosRef.current = [bus.currentLat, bus.currentLng];
    setCurrentSpeed(bus.speedKmH);
  }, [bus.currentLat, bus.currentLng, bus.speedKmH]);

  // 60 FPS Sub-second Smooth Interpolation Loop
  useEffect(() => {
    let lastTime = performance.now();

    const animateLoop = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      const [currLat, currLng] = currentPosRef.current;
      const [targetLat, targetLng] = targetPosRef.current;

      // When bus is halted at a stop, snap immediately so it aligns 100% to stop point
      const isStopped = !!bus.isDwellAtStop;
      const lerpSpeed = isStopped ? 1.0 : Math.min(1, delta * 4.5);
      const newLat = currLat + (targetLat - currLat) * lerpSpeed;
      const newLng = currLng + (targetLng - currLng) * lerpSpeed;

      currentPosRef.current = [newLat, newLng];
      setInterpolatedPos([newLat, newLng]);

      // Move the live bus marker and accuracy circle
      if (busMarkerRef.current) {
        busMarkerRef.current.setLatLng([newLat, newLng]);
      }
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([newLat, newLng]);
      }

      // Smooth camera follow if auto-follow is active
      if (autoFollow && mapInstanceRef.current) {
        mapInstanceRef.current.panTo([newLat, newLng], {
          animate: true,
          duration: 0.25,
          easeLinearity: 0.5,
        });
      }

      animationFrameRef.current = requestAnimationFrame(animateLoop);
    };

    animationFrameRef.current = requestAnimationFrame(animateLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [autoFollow, bus.isDwellAtStop]);

  // Create 3D Realistic Bus Model GPS Indicator on Route Line (elongated transit bus styled after image.png)
  const createGoogleMapsBusIcon = (b: ActiveBus, heading: number, zoom = currentZoom, layer = mapLayer) => {
    const isDark = layer === 'satellite' || layer === 'night';
    const tagBg = isDark ? '#0f172a' : '#1e293b';
    const busScale = calculateBusScale(layer, zoom);

    // Color theme according to APSRTC bus class
    let liveryColor = '#10b981'; // Electric AC Mint / Teal
    if (b.busClass === 'metro_express') {
      liveryColor = '#dc2626'; // APSRTC Crimson Red
    } else if (b.busClass === 'metro_deluxe') {
      liveryColor = '#2563eb'; // Royal Blue
    } else if (b.busClass === 'ordinary') {
      liveryColor = '#b45309'; // Amber / Maroon
    }

    const isStopped = !!b.isDwellAtStop;
    const dwellSeconds = b.dwellRemainingSeconds ?? 30;

    const iconHtml = `
      <div class="relative flex items-center justify-center select-none" style="width: 140px; height: 140px; transform: scale(${busScale}); transform-origin: center center; transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);">
        
        <!-- 1. Floating Route & 30s Stop Status Badge -->
        <div class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 pointer-events-none">
          ${
            isStopped
              ? `
              <div class="flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-xl border-2 border-white ring-2 ring-red-500/40 animate-pulse">
                <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
                <span>🛑 30s STOP (${dwellSeconds}s)</span>
              </div>
            `
              : `
              <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-lg border border-slate-700/20 backdrop-blur-md" style="background-color: ${tagBg}; color: #ffffff;">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span class="font-mono text-amber-300 font-extrabold">${b.routeNumber}</span>
                <span class="text-slate-400">•</span>
                <span class="text-white">${b.speedKmH} km/h</span>
              </div>
            `
          }
        </div>

        <!-- 2. Elongated Realistic 3D Bus Model (Rotates to Match Road Heading Exactly, styled after image.png) -->
        <div 
          class="relative w-24 h-24 pointer-events-none transition-transform duration-300 ease-out flex items-center justify-center"
          style="transform: rotate(${heading}deg); transform-origin: center center;"
        >
          <svg viewBox="0 0 120 120" class="w-full h-full overflow-visible">
            <defs>
              <!-- Soft Realistic Ground Drop Shadow Filter (Matches image.png directional soft shadow) -->
              <filter id="busGroundShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3.6"/>
                <feOffset dx="2" dy="5" result="offsetblur"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.45"/>
                </feComponentTransfer>
                <feMerge> 
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>

              <!-- Body Shading Gradient (Clean White / Porcelain Clay with 3D Bevel) -->
              <linearGradient id="busBodyShading" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#cbd5e1"/>
                <stop offset="9%" stop-color="#f1f5f9"/>
                <stop offset="25%" stop-color="#ffffff"/>
                <stop offset="75%" stop-color="#ffffff"/>
                <stop offset="91%" stop-color="#f1f5f9"/>
                <stop offset="100%" stop-color="#94a3b8"/>
              </linearGradient>

              <!-- Dark Panoramic Glass Canopy Gradient -->
              <linearGradient id="busGlassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#080c14"/>
                <stop offset="40%" stop-color="#0f172a"/>
                <stop offset="100%" stop-color="#1e293b"/>
              </linearGradient>

              <!-- Forward Headlight Road Beam Gradient -->
              <linearGradient id="busLightBeam" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%" stop-color="#e0f2fe" stop-opacity="${isStopped ? '0.12' : '0.55'}"/>
                <stop offset="70%" stop-color="#38bdf8" stop-opacity="${isStopped ? '0.04' : '0.18'}"/>
                <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0"/>
              </linearGradient>
            </defs>

            <!-- A. Forward Headlight Road Spill (illuminates asphalt ahead) -->
            <polygon points="60,16 36,-18 84,-18" fill="url(#busLightBeam)"/>

            <!-- B. Soft Realistic Ground Drop Shadow (Anchors elongated bus naturally to map roads) -->
            <rect x="46" y="18" width="28" height="88" rx="12" fill="rgba(15, 23, 42, 0.45)" filter="url(#busGroundShadow)"/>

            <!-- C. Aerodynamic Side Wing Mirrors (Matching image.png near front A-pillars) -->
            <!-- Left Wing Mirror -->
            <path d="M 45 27 C 39 27, 37 29, 38 32 C 39 34, 43 34, 45 31 Z" fill="#ffffff" stroke="#94a3b8" stroke-width="0.6"/>
            <ellipse cx="40.5" cy="31" rx="1.3" ry="2" fill="#0f172a"/>

            <!-- Right Wing Mirror -->
            <path d="M 75 27 C 81 27, 83 29, 82 32 C 81 34, 77 34, 75 31 Z" fill="#ffffff" stroke="#94a3b8" stroke-width="0.6"/>
            <ellipse cx="79.5" cy="31" rx="1.3" ry="2" fill="#0f172a"/>

            <!-- D. Main Elongated Bus Body Shell (Noticeably longer ~3.4:1 transit bus ratio) -->
            <rect x="47" y="16" width="26" height="88" rx="11.5" fill="url(#busBodyShading)" stroke="#94a3b8" stroke-width="0.75"/>

            <!-- E. Class Livery Accent Stripes along coachwork -->
            <path d="M 47.6 30 L 47.6 90" stroke="${liveryColor}" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M 72.4 30 L 72.4 90" stroke="${liveryColor}" stroke-width="2.2" stroke-linecap="round"/>

            <!-- F. Elongated Panoramic Tinted Glass Canopy & Roof Sections -->
            <!-- Front Panoramic Windshield Wrap -->
            <rect x="49.5" y="20" width="21" height="16" rx="6.5" fill="url(#busGlassGrad)" stroke="rgba(255,255,255,0.22)" stroke-width="0.5"/>
            <!-- Front Windshield Specular Gloss Curve -->
            <path d="M 51.5 22 Q 53 28 53 34" stroke="rgba(255,255,255,0.45)" stroke-width="1.1" stroke-linecap="round" fill="none"/>

            <!-- Passenger Middle Cabin Glass Pane -->
            <rect x="50.5" y="38" width="19" height="25" rx="4.5" fill="url(#busGlassGrad)" stroke="rgba(255,255,255,0.18)" stroke-width="0.4"/>
            <!-- Middle Glass Specular Reflection Highlight -->
            <path d="M 52 40 Q 53.5 50 53.5 60" stroke="rgba(255,255,255,0.32)" stroke-width="0.9" stroke-linecap="round" fill="none"/>

            <!-- Passenger Rear Cabin Glass Pane -->
            <rect x="50.5" y="65" width="19" height="24" rx="4.5" fill="url(#busGlassGrad)" stroke="rgba(255,255,255,0.18)" stroke-width="0.4"/>
            <!-- Rear Cabin Specular Highlight -->
            <path d="M 52 67 Q 53.5 76 53.5 86" stroke="rgba(255,255,255,0.32)" stroke-width="0.9" stroke-linecap="round" fill="none"/>

            <!-- Rear Window Glass -->
            <rect x="49.5" y="91" width="21" height="9" rx="4" fill="url(#busGlassGrad)" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>

            <!-- G. Aerodynamic Rooftop AC / Climate Modules (Dual transit pod design) -->
            <!-- Front AC Pod -->
            <rect x="53" y="42" width="14" height="17" rx="3.5" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.6"/>
            <rect x="55" y="43.5" width="10" height="1.6" rx="0.8" fill="${liveryColor}"/>
            <line x1="55" y1="48" x2="65" y2="48" stroke="#94a3b8" stroke-width="0.6"/>
            <line x1="55" y1="51.5" x2="65" y2="51.5" stroke="#94a3b8" stroke-width="0.6"/>
            <line x1="55" y1="55" x2="65" y2="55" stroke="#94a3b8" stroke-width="0.6"/>

            <!-- Rear Air Exhaust Pod -->
            <rect x="53" y="69" width="14" height="16" rx="3.5" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.6"/>
            <line x1="55" y1="73.5" x2="65" y2="73.5" stroke="#94a3b8" stroke-width="0.6"/>
            <line x1="55" y1="77" x2="65" y2="77" stroke="#94a3b8" stroke-width="0.6"/>
            <line x1="55" y1="80.5" x2="65" y2="80.5" stroke="#94a3b8" stroke-width="0.6"/>

            <!-- H. Signature Horizontal Front LED Lightbar (━━) across the front nose -->
            <!-- Outer Glow Strip -->
            <rect x="48.5" y="16.3" width="23" height="2.6" rx="1.3" fill="#38bdf8" opacity="0.85"/>
            <!-- Pure White Luminous Core -->
            <rect x="49.5" y="16.6" width="21" height="2" rx="1" fill="#ffffff"/>

            <!-- I. Rear Wrap-Around Red Taillight Strip (Distinct hallmark seen on vehicles in image.png) -->
            ${
              isStopped
                ? `
                <!-- Brake Light Flare Aura -->
                <ellipse cx="60" cy="104" rx="16" ry="5.5" fill="rgba(239, 68, 68, 0.55)"/>
                <!-- Bright Neon Crimson Brake Strip -->
                <rect x="48.5" y="101.5" width="23" height="3.2" rx="1.6" fill="#ff0033" stroke="#ffffff" stroke-width="0.6"/>
              `
                : `
                <!-- Standard Ruby Red Wrap-around Taillight Strip (as seen in image.png) -->
                <rect x="48.5" y="101.8" width="23" height="2.5" rx="1.25" fill="#ef4444" stroke="#dc2626" stroke-width="0.4"/>
              `
            }

            <!-- J. Front LED Route Destination Indicator (e.g. 10K) -->
            <rect x="53" y="21" width="14" height="4" rx="1" fill="#000000"/>
            <text x="60" y="24.3" font-family="monospace" font-size="3.2" font-weight="900" fill="#fbbf24" text-anchor="middle" dominant-baseline="middle">${b.routeNumber}</text>

            <!-- K. Boarding Door Indicator (Pulsing green on passenger side when halted for 30s) -->
            ${
              isStopped
                ? `
                <rect x="70.5" y="42" width="2.8" height="12" rx="0.8" fill="#10b981" stroke="#ffffff" stroke-width="0.6" class="animate-pulse"/>
              `
                : ''
            }
          </svg>
        </div>

      </div>
    `;

    return L.divIcon({
      html: iconHtml,
      className: 'gmaps-3d-bus-div-icon',
      iconSize: [140, 140],
      iconAnchor: [70, 70],
    });
  };

  // Google Maps Style Transit Station Marker
  const createGoogleMapsStationIcon = (stop: BusStop, index: number, isPassed: boolean, isCurrent: boolean, isNext: boolean) => {
    let bgColor = '#ffffff';
    let borderColor = '#1a73e8'; // Google Blue
    let textColor = '#1a73e8';
    let pulseHtml = '';

    if (isPassed) {
      bgColor = '#f1f3f4';
      borderColor = '#70757a';
      textColor = '#70757a';
    } else if (isCurrent) {
      bgColor = '#ea4335'; // Google Red
      borderColor = '#ffffff';
      textColor = '#ffffff';
      pulseHtml = '<div class="absolute -inset-1 rounded-full bg-red-400/40 animate-ping"></div>';
    } else if (isNext) {
      bgColor = '#34a853'; // Google Green
      borderColor = '#ffffff';
      textColor = '#ffffff';
      pulseHtml = '<div class="absolute -inset-1 rounded-full bg-emerald-400/40 animate-ping"></div>';
    }

    const stopNameText = stop.name[language] || stop.name.en;

    const stationHtml = `
      <div class="relative group cursor-pointer w-5 h-5 flex items-center justify-center">
        ${pulseHtml}
        <div class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] shadow-md border-2 shrink-0 select-none" 
          style="background-color: ${bgColor}; border-color: ${borderColor}; color: ${textColor};"
        >
          ${index + 1}
        </div>
        <!-- Google Maps station label pill -->
        <div class="absolute left-6 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded shadow-md text-[10px] font-semibold whitespace-nowrap pointer-events-none transition-all select-none ${
          isCurrent || isNext ? 'bg-slate-900 text-white font-bold opacity-100 z-20' : 'bg-white/95 text-slate-800 opacity-90 group-hover:opacity-100 group-hover:scale-105 z-10'
        }" style="border: 1px solid rgba(0,0,0,0.12);">
          ${stopNameText}
        </div>
      </div>
    `;

    return L.divIcon({
      html: stationHtml,
      className: 'gmaps-station-div-icon',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  // Render Route Polylines and Stop Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear previous polylines & stop markers
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
    }
    if (passedPolylineRef.current) {
      map.removeLayer(passedPolylineRef.current);
    }
    trafficPolylinesRef.current.forEach((pl) => map.removeLayer(pl));
    trafficPolylinesRef.current = [];

    stopMarkersRef.current.forEach((m) => map.removeLayer(m));
    stopMarkersRef.current = [];

    const latLngs = route.stops.map((s) => [s.lat, s.lng] as [number, number]);

    // 1. Full Route Casing (Dark Google Maps route border)
    const routeBorder = L.polyline(latLngs, {
      color: '#1557b0', // Darker Google Blue casing
      weight: 9,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // 2. Main Google Maps Blue Transit Corridor
    const mainPolyline = L.polyline(latLngs, {
      color: '#1a73e8', // Classic Google Blue
      weight: 6,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    routePolylineRef.current = mainPolyline;

    // 3. Traveled / Passed Segment in Google Gray
    if (bus.currentStopIndex > 0) {
      const passedLatLngs = latLngs.slice(0, bus.currentStopIndex + 1);
      const passedLine = L.polyline(passedLatLngs, {
        color: '#70757a', // Google Gray
        weight: 6,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      passedPolylineRef.current = passedLine;
    }

    // 4. Google Maps Live Traffic Flow Segments along route
    if (showTraffic && latLngs.length > 1) {
      // Create colored sub-segments simulating Google Maps traffic flow
      const trafficLayers: L.Polyline[] = [];
      for (let i = 0; i < latLngs.length - 1; i++) {
        const seg = [latLngs[i], latLngs[i + 1]];
        // Moderate congestion near central hubs, clear flow elsewhere
        let trafficColor = '#0f9d58'; // Fast green
        const stopName = route.stops[i].name.en.toLowerCase();
        if (stopName.includes('complex') || stopName.includes('nad') || stopName.includes('jagadamba')) {
          trafficColor = '#ea4335'; // Heavy red
        } else if (stopName.includes('gajuwaka') || stopName.includes('siripuram') || stopName.includes('maddilapalem')) {
          trafficColor = '#f4b400'; // Moderate amber
        }

        const trafficSeg = L.polyline(seg, {
          color: trafficColor,
          weight: 4,
          opacity: 0.9,
          dashArray: '8, 8',
          className: 'animate-route-chevrons',
        }).addTo(map);
        trafficLayers.push(trafficSeg);
      }
      trafficPolylinesRef.current = trafficLayers;
    }

    // 5. Waypoint Stop Markers
    route.stops.forEach((stop, idx) => {
      const isPassed = idx < bus.currentStopIndex;
      const isCurrent = idx === bus.currentStopIndex;
      const isNext = idx === bus.currentStopIndex + 1;

      const marker = L.marker([stop.lat, stop.lng], {
        icon: createGoogleMapsStationIcon(stop, idx, isPassed, isCurrent, isNext),
        zIndexOffset: isCurrent || isNext ? 100 : 50,
      }).addTo(map);

      marker.on('click', () => {
        setSelectedStop(stop);
        if (onStopClick) onStopClick(stop);
      });

      stopMarkersRef.current.push(marker);
    });

    return () => {
      if (routeBorder) map.removeLayer(routeBorder);
      if (mainPolyline) map.removeLayer(mainPolyline);
    };
  }, [route, bus.currentStopIndex, showTraffic, language, mapLayer]);

  // Update or Create Bus Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const icon = createGoogleMapsBusIcon(
      bus,
      bus.heading || 0,
      currentZoom,
      mapLayer
    );

    if (!busMarkerRef.current) {
      const marker = L.marker([bus.currentLat, bus.currentLng], {
        icon,
        zIndexOffset: 1000, // Top layer
      }).addTo(map);
      busMarkerRef.current = marker;
    } else {
      busMarkerRef.current.setIcon(icon);
    }
  }, [bus.heading, bus.regNumber, bus.speedKmH, bus.routeNumber, bus.isDwellAtStop, bus.dwellRemainingSeconds, bus.busClass, mapLayer, currentZoom]);

  // Adjust Leaflet canvas size when entering / exiting fullscreen
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen]);

  // Re-center on Bus Handler (Google Maps Target Button)
  const handleRecenter = () => {
    setAutoFollow(true);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(currentPosRef.current, 15, {
        animate: true,
        duration: 1.2,
      });
      setCurrentZoom(15);
    }
  };

  // Zoom In / Out
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
      setCurrentZoom(mapInstanceRef.current.getZoom() + 1);
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
      setCurrentZoom(Math.max(1, mapInstanceRef.current.getZoom() - 1));
    }
  };

  // Reset Heading to North (0 deg)
  const handleResetNorth = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(currentPosRef.current, { animate: true });
    }
  };

  return (
    <div className={`relative isolate overflow-hidden rounded-3xl border border-slate-300 shadow-2xl bg-slate-100 ${
      isFullscreen ? 'fixed inset-0 z-[80] rounded-none h-screen w-screen' : 'w-full h-[520px] sm:h-[600px] z-10'
    }`}>
      
      {/* 1. Google Maps Navigation Header (Emerald Green Navigation HUD or Red 30-Second Stop Dwell HUD) */}
      <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-md z-20 select-none">
        {bus.isDwellAtStop ? (
          <div className="bg-[#b91c1c] text-white rounded-2xl p-3.5 shadow-2xl border-2 border-red-400/80 backdrop-blur-md animate-pulse">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-400/40 flex items-center justify-center shrink-0 shadow-inner">
                  <span className="text-xl">🛑</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-red-950 text-red-200 px-2 py-0.5 rounded border border-red-400/30">
                      30-Second Stop Dwell
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      {bus.dwellRemainingSeconds ?? 30}s Remaining
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight mt-0.5">
                    Halted at: {bus.dwellStopName?.[language] || bus.dwellStopName?.en || (nextStop ? nextStop.name[language] || nextStop.name.en : 'Transit Station')}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-red-100 font-medium mt-1">
                    <span>Doors Open • Commuter Boarding</span>
                    <span>•</span>
                    <span className="font-mono text-amber-200 text-[11px] font-bold">
                      0 km/h
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0">
                <div className="w-9 h-9 rounded-full bg-red-950 border-2 border-amber-400 flex items-center justify-center font-mono font-black text-amber-300 text-xs shadow-inner">
                  {bus.dwellRemainingSeconds ?? 30}s
                </div>
                <span className="text-[9px] text-amber-200 uppercase font-bold mt-1">
                  Boarding
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#137333] text-white rounded-2xl p-3.5 shadow-2xl border border-emerald-500/30 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {/* Google Maps Turn / Advance Maneuver Icon */}
                <div className="w-10 h-10 rounded-xl bg-emerald-800/80 border border-emerald-400/40 flex items-center justify-center shrink-0 shadow-inner">
                  <Navigation className="w-6 h-6 text-emerald-200 fill-emerald-300/40 rotate-45" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-900 text-emerald-200 px-2 py-0.5 rounded border border-emerald-400/30">
                      {bus.routeNumber} • {t.nextStop}
                    </span>
                    <span className="text-xs text-emerald-200 font-medium">
                      in {distanceToNextKm} km
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight mt-0.5">
                    {nextStop.name[language] || nextStop.name.en}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-emerald-100/90 font-medium mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-300" />
                      ETA: ~{etaMinutesToNext} min
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-emerald-300" />
                      {bus.speedKmH} km/h
                    </span>
                    <span>•</span>
                    <span className="font-mono text-emerald-200 text-[11px]">
                      {bus.regNumber}
                    </span>
                  </div>
                </div>
              </div>

              {/* GPS Telematics Status Indicator */}
              <div className="hidden sm:flex flex-col items-end shrink-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-900/90 border border-emerald-400/40 text-[10px] font-bold text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  GPS Live
                </span>
                <span className="text-[9px] text-emerald-200 font-mono mt-1">
                  ±2.5m Accuracy
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Floating Google Maps Action Controls (Right Edge) */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 select-none">
        
        {/* Layer Switcher (Google Maps, Satellite, Geographical, Night) */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-1 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setMapLayer('google')}
            className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
              mapLayer === 'google' ? 'bg-[#1a73e8] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Google Maps Default Road Style"
            aria-label="Google Maps Style"
          >
            <span className="text-[11px] font-bold">Map</span>
          </button>
          
          <button
            type="button"
            onClick={() => setMapLayer('satellite')}
            className={`p-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${
              mapLayer === 'satellite' ? 'bg-[#1a73e8] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
            title={`Satellite Aerial Imagery (Bus icon scale: ${Math.round(calculateBusScale('satellite', currentZoom) * 100)}% - auto-reduces when zoomed)`}
            aria-label="Satellite Imagery"
          >
            <span className="text-[11px] font-bold">Sat</span>
            {mapLayer === 'satellite' && (
              <span className="text-[8px] font-mono opacity-90 leading-tight">
                {Math.round(calculateBusScale(mapLayer, currentZoom) * 100)}%
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMapLayer('geo')}
            className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
              mapLayer === 'geo' ? 'bg-[#059669] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Geographical Topographic Map (Elevation & Contours)"
            aria-label="Geographical Map"
          >
            <span className="text-[11px] font-bold">Geo</span>
          </button>

          <button
            type="button"
            onClick={() => setMapLayer('night')}
            className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
              mapLayer === 'night' ? 'bg-[#1a73e8] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Night Navigation Style"
            aria-label="Night Navigation Style"
          >
            <span className="text-[11px] font-bold">Dark</span>
          </button>

          {/* Quick Option at the Satellite Map button to change from Satellite to Geographical Map */}
          <div className="pt-1 mt-0.5 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setMapLayer(mapLayer === 'satellite' ? 'geo' : 'satellite')}
              className={`w-full py-1 px-1 rounded-lg text-[9px] font-extrabold flex flex-col items-center justify-center transition cursor-pointer text-center ${
                mapLayer === 'satellite'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                  : mapLayer === 'geo'
                    ? 'bg-blue-50 text-blue-800 border border-blue-300 hover:bg-blue-100'
                    : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
              title="Quick Toggle: Satellite Map ⇄ Geographical Map"
              aria-label="Quick Toggle between Satellite and Geographical Map"
            >
              <span className="leading-tight">
                {mapLayer === 'satellite' ? '⛰️ To Geo' : '🛰️ To Sat'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Traffic Toggle */}
        <button
          type="button"
          onClick={() => setShowTraffic(!showTraffic)}
          className={`p-2.5 rounded-2xl shadow-xl border border-slate-200 transition cursor-pointer flex items-center justify-center ${
            showTraffic ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
          title={showTraffic ? 'Hide Traffic Flow' : 'Show Google Maps Live Traffic Flow'}
          aria-label="Toggle Live Traffic Flow"
        >
          <span className="text-xs font-black">🚦</span>
        </button>

        {/* Re-center on Bus Button (Google Maps Crosshairs) */}
        <button
          type="button"
          onClick={handleRecenter}
          className={`p-3 rounded-2xl shadow-xl border border-slate-200 transition cursor-pointer flex items-center justify-center ${
            autoFollow 
              ? 'bg-[#1a73e8] text-white ring-2 ring-blue-400' 
              : 'bg-white text-[#1a73e8] hover:bg-blue-50'
          }`}
          title={autoFollow ? 'Camera Centered on Bus (Auto-Follow On)' : 'Re-center camera on bus'}
          aria-label="Re-center camera on bus"
        >
          <LocateFixed className="w-5 h-5" />
        </button>

        {/* Compass Button */}
        <button
          type="button"
          onClick={handleResetNorth}
          className="p-3 bg-white hover:bg-slate-100 text-slate-700 rounded-2xl shadow-xl border border-slate-200 transition cursor-pointer flex items-center justify-center"
          title="Align to North"
          aria-label="Reset North orientation"
        >
          <Compass 
            className="w-5 h-5 text-red-600 transition-transform duration-500" 
            style={{ transform: `rotate(-${bus.heading || 0}deg)` }}
          />
        </button>

        {/* Zoom Controls */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-3 hover:bg-slate-100 text-slate-700 transition cursor-pointer border-b border-slate-100 flex items-center justify-center"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-3 hover:bg-slate-100 text-slate-700 transition cursor-pointer flex items-center justify-center"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-3 bg-white hover:bg-slate-100 text-slate-700 rounded-2xl shadow-xl border border-slate-200 transition cursor-pointer flex items-center justify-center"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Google Maps Navigation'}
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

      </div>

      {/* 3. Bottom Left Speedometer & Real-Time Telematics Pill */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 select-none">
        
        {/* Speedometer Circle */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-2.5 shadow-xl border border-slate-200 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center border border-slate-700 shadow-inner">
            <span className="font-mono text-base font-black text-amber-300 leading-tight">
              {bus.speedKmH}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-300">
              km/h
            </span>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {busClassInfo.title[language] || busClassInfo.title.en}
            </div>
            <div className="text-xs font-extrabold text-slate-900">
              {bus.regNumber}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {autoFollow ? 'Auto-following GPS' : 'Free map exploration'}
            </div>
            {mapLayer === 'satellite' && (
              <div className="text-[9px] text-amber-700 font-bold flex items-center gap-1 mt-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                <span>🛰️ Sat Zoom {currentZoom} • Bus Scale {Math.round(calculateBusScale(mapLayer, currentZoom) * 100)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Re-center nudge button if user panned away */}
        {!autoFollow && (
          <button
            type="button"
            onClick={handleRecenter}
            className="bg-[#1a73e8] hover:bg-blue-700 text-white px-3.5 py-2.5 rounded-2xl shadow-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer animate-bounce"
          >
            <LocateFixed className="w-4 h-4" />
            <span>Re-center on Bus</span>
          </button>
        )}

      </div>

      {/* 4. Bottom Right Google Maps Traffic Legend */}
      <div className="absolute bottom-4 right-4 z-20 hidden md:flex items-center gap-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-slate-200 text-[10px] text-slate-700 font-semibold select-none">
        <span className="text-slate-500">Live Traffic:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-1.5 rounded-full bg-[#0f9d58]"></span>
          Fast
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-1.5 rounded-full bg-[#f4b400]"></span>
          Medium
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-1.5 rounded-full bg-[#ea4335]"></span>
          Heavy
        </span>
      </div>

      {/* 5. Google Maps Place Card / Selected Stop Sheet */}
      {selectedStop && (
        <div className="absolute bottom-16 left-4 right-4 sm:right-auto sm:max-w-sm z-30 bg-white rounded-3xl p-4 shadow-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-[#1a73e8] px-2 py-0.5 rounded-full border border-blue-200">
                APSRTC Transit Stop
              </span>
              <h4 className="font-extrabold text-base text-slate-900 mt-1">
                {selectedStop.name[language] || selectedStop.name.en}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStop(null)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {selectedStop.landmark && (
            <p className="text-xs text-slate-600 mb-2 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span>{selectedStop.landmark[language] || selectedStop.landmark.en}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] font-sans">Distance from Start:</span>
              <strong className="text-slate-800">{selectedStop.distanceFromStartKm} km</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-sans">Stop Sequence:</span>
              <strong className="text-slate-800">Stop #{route.stops.findIndex((s) => s.id === selectedStop.id) + 1} of {route.stops.length}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedStop(null)}
            className="w-full mt-3 py-2 bg-[#1a73e8] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close Stop Sheet
          </button>
        </div>
      )}

      {/* 6. Leaflet Map Container Element */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full z-0" 
        style={{ height: '100%', width: '100%' }}
      />

    </div>
  );
};
