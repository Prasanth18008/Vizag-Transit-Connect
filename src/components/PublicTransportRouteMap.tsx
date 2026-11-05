import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { ActiveBus, BusStop, Language, Route } from '../types/transit';
import { BUS_CLASSES } from '../utils/transitData';
import { 
  Bus, 
  MapPin, 
  Layers, 
  Compass, 
  Maximize2, 
  Minimize2, 
  Plus, 
  Minus, 
  Navigation,
  Eye, 
  EyeOff, 
  Search, 
  X, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  Info,
  ChevronRight,
  TrendingUp,
  Map as MapIcon
} from 'lucide-react';

export type MapLayerType = 'google' | 'satellite' | 'geo' | 'night';

interface PublicTransportRouteMapProps {
  routes: Route[];
  activeBuses: ActiveBus[];
  language: Language;
  onSelectBus: (bus: ActiveBus) => void;
  onSelectRoute?: (route: Route) => void;
  simSpeed?: number;
  onSpeedChange?: (speed: number) => void;
}

interface TransitCorridor {
  id: string;
  name: { en: string; te: string; hi: string };
  badgeText: { en: string; te: string; hi: string };
  color: string;
  routePrefixes: string[];
}

const TRANSIT_CORRIDORS: TransitCorridor[] = [
  {
    id: 'all',
    name: {
      en: 'All Transit Corridors',
      te: 'అన్ని రవాణా కారిడార్లు',
      hi: 'सभी परिवहन गलियारे',
    },
    badgeText: { en: '49 Routes', te: '49 రూట్లు', hi: '49 मार्ग' },
    color: '#1e293b',
    routePrefixes: [],
  },
  {
    id: 'trunk',
    name: {
      en: 'NH-16 & Core City Trunk Lines',
      te: 'NH-16 & సెంట్రల్ ట్రంక్ రూట్లు',
      hi: 'एनएच-16 और मुख्य ट्रंक लाइनें',
    },
    badgeText: { en: 'Core Trunk', te: 'ట్రంక్ లైన్స్', hi: 'ट्रंक' },
    color: '#dc2626', // Red
    routePrefixes: ['10K', '500', '500P', '500Y', '38', '38A', '38B', '36', '400N'],
  },
  {
    id: 'coastal',
    name: {
      en: 'Beach & Coastal Highway Lines',
      te: 'బీచ్ & కోస్టల్ రూట్లు',
      hi: 'तटीय बीच एक्सप्रेस',
    },
    badgeText: { en: 'Coastal / Bhimili', te: 'తీరప్రాంతం', hi: 'तटीय' },
    color: '#0284c7', // Sky Blue
    routePrefixes: ['900', '900K', '52E', '52V/G', '25MR', '25S'],
  },
  {
    id: 'pilgrim',
    name: {
      en: 'Simhachalam Pilgrim & Hill Lines',
      te: 'సింహాచలం కొండ & యాత్రా రూట్లు',
      hi: 'सिंहाचलम तीर्थ मार्ग',
    },
    badgeText: { en: 'Simhachalam', te: 'సింహాచలం', hi: 'तीर्थ' },
    color: '#d97706', // Saffron Amber
    routePrefixes: ['505', '540', '68/68K', '69', '6A/H', '28', '28A/28K', '28R', '28Z/H'],
  },
  {
    id: 'suburban',
    name: {
      en: 'Western Suburbs & Inter-District',
      te: 'పశ్చిమ గ్రామీణ & అంతర్ జిల్లా రూట్లు',
      hi: 'पश्चिमी उपनगरीय एवं अंतर-जिला',
    },
    badgeText: { en: 'Suburban / VZM', te: 'సబర్బన్', hi: 'उपनगरीय' },
    color: '#7c3aed', // Purple
    routePrefixes: ['300C', '300M', '328', '333', '333K', '700', '888'],
  },
  {
    id: 'industrial',
    name: {
      en: 'Old Town, Port & Industrial Corridor',
      te: 'పాత నగరం, పోర్ట్ & పారిశ్రామిక రూట్లు',
      hi: 'पुराना शहर, पोर्ट और औद्योगिक',
    },
    badgeText: { en: 'Port / Gajuwaka', te: 'ఇండస్ట్రియల్', hi: 'औद्योगिक' },
    color: '#059669', // Emerald
    routePrefixes: ['52D', '6B', '744', '77', '77T', '844'],
  },
  {
    id: 'it_north',
    name: {
      en: 'Madhurawada IT & North Corridor',
      te: 'మధురవాడ IT & ఉత్తర కారిడార్',
      hi: 'मधुरवाड़ा आईटी व उत्तरी गलियारा',
    },
    badgeText: { en: 'IT Corridor', te: 'ఐటీ కారిడార్', hi: 'आईटी' },
    color: '#ea580c', // Orange
    routePrefixes: ['222', '25IT', '25J', '25K', '25M', '25E', '25G', '25R', '25D/M', '25D/V'],
  },
];

// Major Key Interchange Hubs across Visakhapatnam
interface InterchangeHub {
  id: string;
  name: { en: string; te: string; hi: string };
  badge: string;
  coords: [number, number];
  icon: string;
  description: { en: string; te: string; hi: string };
}

const MAJOR_INTERCHANGES: InterchangeHub[] = [
  {
    id: 'rtc-complex',
    name: {
      en: 'Dwaraka Bus Station (RTC Complex)',
      te: 'ద్వారకా బస్ స్టేషన్ (RTC కాంప్లెక్స్)',
      hi: 'द्वारका बस स्टेशन (आरटीसी कॉम्प्लेक्स)',
    },
    badge: 'Central Interchange',
    coords: [17.7275, 83.3032],
    icon: '🏢',
    description: {
      en: 'Primary central terminus connecting all city, express, and inter-district routes.',
      te: 'అన్ని సిటీ మరియు జిల్లాల బస్సులు కలిసే ప్రధాన కేంద్ర బస్ స్టేషన్.',
      hi: 'सभी नगर और अंतर-जिला बसों का मुख्य केंद्रीय टर्मिनस।',
    },
  },
  {
    id: 'nad-jn',
    name: {
      en: 'NAD Junction (Multi-Level Interchange)',
      te: 'NAD జంక్షన్ (ఫ్లైఓవర్ కేంద్రం)',
      hi: 'एनएडी जंक्शन (मल्टी-लेवल फ्लाईओवर)',
    },
    badge: 'Airport & West Hub',
    coords: [17.7478, 83.2185],
    icon: '✈️',
    description: {
      en: 'Major western gateway near airport connecting Simhachalam, Gajuwaka, and Pendurthi.',
      te: 'విమానాశ్రయం మరియు సింహాచలం, గాజువాకలను కలిపే ప్రధాన పశ్చిమ రవాణా కేంద్రం.',
      hi: 'हवाई अड्डे के पास पश्चिमी प्रवेश द्वार जो सिंहाचलम और गाजुवाका को जोड़ता है।',
    },
  },
  {
    id: 'maddilapalem',
    name: {
      en: 'Maddilapalem Bus Station',
      te: 'మద్దిలపాలెం బస్ స్టేషన్',
      hi: 'मद्दिलीपालेम बस स्टेशन',
    },
    badge: 'University & East Hub',
    coords: [17.7388, 83.3285],
    icon: '🏥',
    description: {
      en: 'Major transit station serving Andhra University, Coastal Beach road, and Madhurawada.',
      te: 'ఆంధ్రా విశ్వవిద్యాలయం మరియు బీచ్ రోడ్, మధురవాడ మార్గాల కూడలి.',
      hi: 'आंध्र विश्वविद्यालय, समुद्र तट और मधुरवाड़ा को जोड़ने वाला मुख्य केंद्र।',
    },
  },
  {
    id: 'gajuwaka',
    name: {
      en: 'Gajuwaka Bus Station',
      te: 'గాజువాక బస్ స్టేషన్',
      hi: 'गाजुवाका बस स्टेशन',
    },
    badge: 'Steel Plant & Industrial Hub',
    coords: [17.695, 83.211],
    icon: '🏭',
    description: {
      en: 'Heavy transit interchange serving Vizag Steel Plant, BHPV, and industrial workers.',
      te: 'విశాఖ స్టీల్ ప్లాంట్ మరియు పరిశ్రమల ఉద్యోగుల ప్రధాన రవాణా కూడలి.',
      hi: 'विशाखापत्तनम स्टील प्लांट और औद्योगिक कर्मचारियों का प्रमुख केंद्र।',
    },
  },
  {
    id: 'railway-station',
    name: {
      en: 'Visakhapatnam Railway Station',
      te: 'విశాఖపట్నం రైల్వే స్టేషన్',
      hi: 'विशाखापत्तनम रेलवे स्टेशन',
    },
    badge: 'Intermodal Rail Terminal',
    coords: [17.7212, 83.291],
    icon: '🚆',
    description: {
      en: 'Intermodal transfer hub connecting city bus lines to all Indian Railways platforms.',
      te: 'రైలు ప్రయాణికులకు నేరుగా నగర బస్సులను అందించే ఇంటర్‌మోడల్ కూడలి.',
      hi: 'रेल यात्रियों के लिए सभी सिटी बस लाइनों को जोड़ने वाला टर्मिनल।',
    },
  },
  {
    id: 'simhachalam-hills',
    name: {
      en: 'Simhachalam Hill Foothills',
      te: 'సింహాచలం కొండ అడుగు భాగం (బస్ స్టేషన్)',
      hi: 'सिंहाचलम पहाड़ी तलहटी',
    },
    badge: 'Pilgrim Hub',
    coords: [17.768, 83.245],
    icon: '🛕',
    description: {
      en: 'Pilgrimage terminus for Sri Varaha Lakshmi Narasimha Swamy temple visitors.',
      te: 'శ్రీ వరాహ లక్ష్మీ నరసింహ స్వామి దర్శనానికి వచ్చే భక్తుల బస్ స్టేషన్.',
      hi: 'श्री वराह लक्ष्मी नरसिंह स्वामी मंदिर के दर्शनार्थियों का तीर्थ टर्मिनस।',
    },
  },
  {
    id: 'anakapalle-depot',
    name: {
      en: 'Anakapalle RTC Depot',
      te: 'అనకాపల్లి RTC డిపో',
      hi: 'अनकापल्ले आरटीसी डिपो',
    },
    badge: 'Southern Suburb Hub',
    coords: [17.689, 83.004],
    icon: '🏡',
    description: {
      en: 'Southern gateway connecting rural nodes, Jaggayyapet, and highway expresses.',
      te: 'నగరానికి దక్షిణ ద్వారం మరియు పరిసర గ్రామీణ ప్రాంతాల రవాణా కేంద్రం.',
      hi: 'शहर का दक्षिणी प्रवेश द्वार जो ग्रामीण क्षेत्रों और हाईवे को जोड़ता है।',
    },
  },
  {
    id: 'bhimili-beach',
    name: {
      en: 'Bhimunipatnam (Bhimili) Beach',
      te: 'భీమునిపట్నం (భీమిలి) బీచ్',
      hi: 'भीमुनिपटनम (भीमिली) बीच',
    },
    badge: 'Northern Heritage Coast',
    coords: [17.892, 83.454],
    icon: '🏖️',
    description: {
      en: 'Scenic northern coastal terminus along marine drive through Gitam and Rushikonda.',
      te: 'గీతం, రుషికొండ మీదుగా సాగే ఉత్తర తీరప్రాంత పర్యాటక బస్ టెర్మినల్.',
      hi: 'गीतम और रुशिकोंडा से होकर जाने वाला उत्तर तटीय पर्यटन टर्मिनस।',
    },
  },
];

export const PublicTransportRouteMap: React.FC<PublicTransportRouteMapProps> = ({
  routes,
  activeBuses,
  language,
  onSelectBus,
  onSelectRoute,
  simSpeed = 1,
  onSpeedChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routePolylinesRef = useRef<{ [routeId: string]: L.Polyline }>({});
  const busMarkersRef = useRef<{ [busId: string]: L.Marker }>({});
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const interchangeMarkersRef = useRef<L.Marker[]>([]);

  // State
  const [mapLayer, setMapLayer] = useState<MapLayerType>('google');
  const [currentZoom, setCurrentZoom] = useState<number>(12);
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>('all');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedHub, setSelectedHub] = useState<InterchangeHub | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [showLiveBuses, setShowLiveBuses] = useState<boolean>(true);
  const [showStops, setShowStops] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Zoom-based bus scaling on satellite map
  const calculateBusScale = (layer: MapLayerType, zoom: number): number => {
    if (layer === 'satellite') {
      const baseZoom = 12;
      if (zoom > baseZoom) {
        const scale = Math.max(0.22, Math.min(1.0, 1.0 - (zoom - baseZoom) * 0.12));
        return Number(scale.toFixed(2));
      }
      return 1.0;
    }
    return 1.0;
  };

  // Determine corridor for a route
  const getCorridorForRoute = (routeNumber: string): TransitCorridor => {
    for (const corridor of TRANSIT_CORRIDORS) {
      if (corridor.id === 'all') continue;
      if (corridor.routePrefixes.some((prefix) => routeNumber.toUpperCase().includes(prefix.toUpperCase()))) {
        return corridor;
      }
    }
    return TRANSIT_CORRIDORS[1]; // Default to trunk
  };

  // Filter routes based on corridor and search query
  const filteredRoutes = useMemo(() => {
    return routes.filter((r) => {
      // Filter by corridor
      if (selectedCorridorId !== 'all') {
        const corridor = TRANSIT_CORRIDORS.find((c) => c.id === selectedCorridorId);
        if (corridor && !corridor.routePrefixes.some((prefix) => r.routeNumber.toUpperCase().includes(prefix.toUpperCase()))) {
          return false;
        }
      }

      // Filter by search string
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesRouteNo = r.routeNumber.toLowerCase().includes(q);
        const matchesOrigin = r.origin.en.toLowerCase().includes(q) || r.origin.te.toLowerCase().includes(q);
        const matchesDest = r.destination.en.toLowerCase().includes(q) || r.destination.te.toLowerCase().includes(q);
        const matchesStop = r.stops.some((s) => s.name.en.toLowerCase().includes(q) || s.name.te.toLowerCase().includes(q));
        if (!matchesRouteNo && !matchesOrigin && !matchesDest && !matchesStop) {
          return false;
        }
      }

      return true;
    });
  }, [routes, selectedCorridorId, searchFilter]);

  // Selected route object
  const activeRouteObj = useMemo(() => {
    if (!selectedRouteId) return null;
    return routes.find((r) => r.id === selectedRouteId) || null;
  }, [routes, selectedRouteId]);

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
        return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }
  };

  const getTileAttribution = (type: MapLayerType) => {
    switch (type) {
      case 'satellite':
        return '&copy; Esri &mdash; DigitalGlobe, GeoEye, Earthstar';
      case 'geo':
        return '&copy; Esri &mdash; National Geographic, DeLorme (Geographical Topo)';
      case 'night':
        return '&copy; CARTO &copy; OpenStreetMap';
      case 'google':
      default:
        return '&copy; OpenStreetMap contributors &copy; CARTO (Google Maps style)';
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [17.725, 83.285], // Center of Greater Visakhapatnam
        zoom: 12,
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
      });

      const initialLayer = L.tileLayer(getTileUrl('google'), {
        attribution: getTileAttribution('google'),
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      tileLayerRef.current = initialLayer;
      mapInstanceRef.current = map;

      // Track zoom level
      map.on('zoom', () => setCurrentZoom(map.getZoom()));
      map.on('zoomend', () => setCurrentZoom(map.getZoom()));
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const newLayer = L.tileLayer(getTileUrl(mapLayer), {
      attribution: getTileAttribution(mapLayer),
      maxZoom: 19,
      subdomains: mapLayer === 'satellite' || mapLayer === 'geo' ? '' : 'abcd',
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newLayer;
  }, [mapLayer]);

  // Adjust Leaflet on Fullscreen change
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen]);

  // Render Route Polylines
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old route lines
    Object.values(routePolylinesRef.current).forEach((line) => {
      map.removeLayer(line);
    });
    routePolylinesRef.current = {};

    filteredRoutes.forEach((route) => {
      const latLngs = route.stops.map((s) => [s.lat, s.lng] as [number, number]);
      if (latLngs.length < 2) return;

      const corridor = getCorridorForRoute(route.routeNumber);
      const isSelected = selectedRouteId === route.id;
      const isMuted = selectedRouteId !== null && !isSelected;

      const polyline = L.polyline(latLngs, {
        color: isSelected ? '#ffffff' : corridor.color,
        weight: isSelected ? 8 : isMuted ? 2 : 4,
        opacity: isSelected ? 1.0 : isMuted ? 0.25 : 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Create an outline border for selected or active route
      if (isSelected) {
        polyline.bringToFront();
      }

      polyline.bindTooltip(
        `<strong>Route ${route.routeNumber}</strong><br/>${route.origin.en} ➔ ${route.destination.en}<br/><em>${route.stops.length} stops • ${route.totalDistanceKm} km</em>`,
        { sticky: true, className: 'transit-network-tooltip' }
      );

      polyline.on('click', () => {
        setSelectedRouteId(route.id);
        if (onSelectRoute) onSelectRoute(route);
      });

      routePolylinesRef.current[route.id] = polyline;
    });
  }, [filteredRoutes, selectedRouteId]);

  // Render Major Interchange Hubs
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    interchangeMarkersRef.current.forEach((m) => map.removeLayer(m));
    interchangeMarkersRef.current = [];

    MAJOR_INTERCHANGES.forEach((hub) => {
      const isHubSelected = selectedHub?.id === hub.id;
      const hubHtml = `
        <div class="relative group cursor-pointer flex items-center justify-center">
          <div class="w-8 h-8 rounded-2xl bg-white text-slate-900 border-2 shadow-xl flex items-center justify-center font-black text-sm transition-transform duration-200 group-hover:scale-125 ${
            isHubSelected ? 'ring-4 ring-amber-400 border-red-700 bg-amber-50 scale-125' : 'border-slate-800'
          }">
            <span>${hub.icon}</span>
          </div>
          <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-900/90 text-white font-bold text-[9px] shadow-lg whitespace-nowrap pointer-events-none border border-slate-700">
            ${hub.name[language] || hub.name.en}
          </div>
        </div>
      `;

      const hubIcon = L.divIcon({
        html: hubHtml,
        className: 'transit-hub-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(hub.coords, {
        icon: hubIcon,
        zIndexOffset: 300,
      }).addTo(map);

      marker.on('click', () => {
        setSelectedHub(hub);
      });

      interchangeMarkersRef.current.push(marker);
    });
  }, [language, selectedHub]);

  // Render Bus Stops when showStops is enabled or a route is selected
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    stopMarkersRef.current.forEach((m) => map.removeLayer(m));
    stopMarkersRef.current = [];

    if (showStops || selectedRouteId) {
      const routesToDisplay = selectedRouteId
        ? routes.filter((r) => r.id === selectedRouteId)
        : filteredRoutes.slice(0, 5); // Limit to avoid DOM overload

      const renderedStopKeys = new Set<string>();

      routesToDisplay.forEach((r) => {
        r.stops.forEach((stop, idx) => {
          const key = `${stop.lat.toFixed(4)},${stop.lng.toFixed(4)}`;
          if (renderedStopKeys.has(key)) return;
          renderedStopKeys.add(key);

          const stopHtml = `
            <div class="relative group cursor-pointer flex items-center justify-center">
              <div class="w-4 h-4 rounded-full bg-white border-2 border-red-700 shadow flex items-center justify-center text-[8px] font-black text-red-700 group-hover:scale-125 transition-transform">
                ${idx + 1}
              </div>
              <div class="absolute left-5 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-slate-900 text-white rounded text-[9px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-30">
                ${stop.name[language] || stop.name.en}
              </div>
            </div>
          `;

          const stopIcon = L.divIcon({
            html: stopHtml,
            className: 'transit-stop-div-icon',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });

          const marker = L.marker([stop.lat, stop.lng], {
            icon: stopIcon,
            zIndexOffset: 150,
          }).addTo(map);

          stopMarkersRef.current.push(marker);
        });
      });
    }
  }, [showStops, selectedRouteId, filteredRoutes, language]);

  // Render Live Buses on the Network Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Remove old bus markers
    Object.values(busMarkersRef.current).forEach((m) => map.removeLayer(m));
    busMarkersRef.current = {};

    if (!showLiveBuses) return;

    const busScale = calculateBusScale(mapLayer, currentZoom);

    activeBuses.forEach((bus) => {
      // Check if bus's route is within filteredRoutes
      const isRouteVisible = filteredRoutes.some((r) => r.id === bus.routeId);
      if (!isRouteVisible && selectedRouteId !== bus.routeId) return;

      const busClassInfo = BUS_CLASSES.find((c) => c.id === bus.busClass) || BUS_CLASSES[0];
      const isSelectedRoute = selectedRouteId === bus.routeId;

      const busHtml = `
        <div class="relative cursor-pointer flex items-center justify-center select-none" style="transform: scale(${busScale}); transform-origin: center center; transition: transform 0.25s ease-out;">
          <div class="flex flex-col items-center">
            <!-- Badge -->
            <div class="px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-lg border border-white/40 whitespace-nowrap ${
              isSelectedRoute ? 'bg-red-700 ring-2 ring-amber-400' : 'bg-slate-900'
            }">
              <span>${bus.routeNumber}</span>
              <span class="text-amber-300 ml-1">• ${bus.speedKmH}km/h</span>
            </div>
            <!-- Bus Vehicle Icon -->
            <div class="w-8 h-8 rounded-xl bg-white text-red-800 border-2 shadow-xl flex items-center justify-center font-bold text-xs mt-0.5" style="border-color: ${busClassInfo.color};">
              🚌
            </div>
          </div>
        </div>
      `;

      const busIcon = L.divIcon({
        html: busHtml,
        className: 'network-bus-div-icon',
        iconSize: [40, 48],
        iconAnchor: [20, 24],
      });

      const marker = L.marker([bus.currentLat, bus.currentLng], {
        icon: busIcon,
        zIndexOffset: isSelectedRoute ? 600 : 400,
      }).addTo(map);

      marker.on('click', () => {
        onSelectBus(bus);
      });

      marker.bindTooltip(
        `<strong>${bus.routeNumber} (${bus.regNumber})</strong><br/>${busClassInfo.title[language] || busClassInfo.title.en}<br/>Speed: ${bus.speedKmH} km/h • Crowd: ${bus.crowdLevel}`,
        { sticky: true }
      );

      busMarkersRef.current[bus.id] = marker;
    });
  }, [activeBuses, filteredRoutes, selectedRouteId, showLiveBuses, mapLayer, currentZoom, language]);

  // Reset to full Vizag network view
  const handleResetNetworkView = () => {
    setSelectedRouteId(null);
    setSelectedHub(null);
    setSelectedCorridorId('all');
    setSearchFilter('');
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([17.725, 83.285], 12, { animate: true, duration: 1.2 });
    }
  };

  // Zoom to a selected route
  const handleZoomToRoute = (route: Route) => {
    setSelectedRouteId(route.id);
    if (mapInstanceRef.current && route.stops.length > 0) {
      const bounds = L.latLngBounds(route.stops.map((s) => [s.lat, s.lng]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], animate: true });
    }
  };

  return (
    <div className={`relative isolate flex flex-col bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 ${
      isFullscreen ? 'fixed inset-0 z-[90] rounded-none h-screen w-screen' : 'w-full'
    }`}>
      
      {/* 1. Header Toolbar with Network Stats & Corridor Selector */}
      <div className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 p-3 sm:p-4 text-white z-20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Title & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-white shadow-lg border border-amber-400/30">
              <MapIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-red-950 text-amber-300 px-2 py-0.5 rounded border border-red-700/50">
                  APSRTC Transit Network
                </span>
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  {activeBuses.length} Active Fleet Online
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
                <span>{language === 'te' ? 'విశాఖపట్నం ప్రజా రవాణా రూట్ మ్యాప్' : language === 'hi' ? 'विशाखापत्तनम सार्वजनिक परिवहन मार्ग मानचित्र' : 'Visakhapatnam Public Transport Route Map'}</span>
              </h2>
            </div>
          </div>

          {/* Quick Route / Stop Search Box */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder={language === 'te' ? 'రూట్ నంబర్ లేదా స్టాప్ వెతకండి (ఉదా: 500P, 52D)...' : 'Search line or stop (e.g. 500P, 52D, Bhimili)...'}
                className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-400 text-xs rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:border-red-500 shadow-inner"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Toggle Live Buses */}
            <button
              type="button"
              onClick={() => setShowLiveBuses(!showLiveBuses)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                showLiveBuses
                  ? 'bg-emerald-600/90 text-white border-emerald-500 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={showLiveBuses ? 'Hide Live Buses' : 'Show Live Fleet on Map'}
            >
              <Bus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fleet</span>
            </button>

            {/* Toggle Stops */}
            <button
              type="button"
              onClick={() => setShowStops(!showStops)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                showStops
                  ? 'bg-amber-600/90 text-white border-amber-500 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={showStops ? 'Hide Waypoint Stops' : 'Show Every Waypoint Stop'}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stops</span>
            </button>
          </div>
        </div>

        {/* 2. Corridor Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-3 pb-1 scrollbar-none">
          {TRANSIT_CORRIDORS.map((corridor) => (
            <button
              key={corridor.id}
              type="button"
              onClick={() => {
                setSelectedCorridorId(corridor.id);
                setSelectedRouteId(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-2 border ${
                selectedCorridorId === corridor.id
                  ? 'bg-red-700 text-white border-amber-400 shadow-md ring-1 ring-amber-400/50'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: corridor.color === '#1e293b' ? '#ffffff' : corridor.color }}
              ></span>
              <span>{corridor.name[language] || corridor.name.en}</span>
              <span className="text-[10px] opacity-75 font-mono px-1.5 py-0.2 rounded bg-black/30">
                {corridor.badgeText[language] || corridor.badgeText.en}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Interactive Map Canvas */}
      <div className="relative w-full h-[540px] sm:h-[640px]">
        
        {/* Leaflet Container */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Layer Controls (Top Right) */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 select-none">
          
          {/* Layer Selector */}
          <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700 p-1 flex flex-col gap-1 text-white">
            <button
              type="button"
              onClick={() => setMapLayer('google')}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                mapLayer === 'google' ? 'bg-[#1a73e8] text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Google Maps Road Network"
            >
              <span className="text-[11px] font-bold">Map</span>
            </button>

            <button
              type="button"
              onClick={() => setMapLayer('satellite')}
              className={`p-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                mapLayer === 'satellite' ? 'bg-[#1a73e8] text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={`Satellite Aerial Imagery (Bus scale ${Math.round(calculateBusScale('satellite', currentZoom) * 100)}%)`}
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
                mapLayer === 'geo' ? 'bg-[#059669] text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Geographical Topographical Elevation Contours"
            >
              <span className="text-[11px] font-bold">Geo</span>
            </button>

            <button
              type="button"
              onClick={() => setMapLayer('night')}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                mapLayer === 'night' ? 'bg-[#1a73e8] text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Night Dark Theme"
            >
              <span className="text-[11px] font-bold">Dark</span>
            </button>

            {/* Quick Toggle between Satellite and Geographical Map */}
            <div className="pt-1 mt-0.5 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setMapLayer(mapLayer === 'satellite' ? 'geo' : 'satellite')}
                className={`w-full py-1 px-1 rounded-lg text-[9px] font-extrabold flex flex-col items-center justify-center transition cursor-pointer text-center ${
                  mapLayer === 'satellite'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600 hover:bg-emerald-900'
                    : mapLayer === 'geo'
                      ? 'bg-blue-950 text-blue-300 border border-blue-600 hover:bg-blue-900'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="Quick Toggle: Satellite Map ⇄ Geographical Map"
              >
                <span>{mapLayer === 'satellite' ? '⛰️ To Geo' : '🛰️ To Sat'}</span>
              </button>
            </div>
          </div>

          {/* Reset Entire Network View */}
          <button
            type="button"
            onClick={handleResetNetworkView}
            className="p-3 bg-slate-900/95 hover:bg-slate-800 text-white rounded-2xl shadow-xl border border-slate-700 transition cursor-pointer flex items-center justify-center"
            title="Reset to Greater Visakhapatnam Network View"
          >
            <Compass className="w-5 h-5 text-amber-400" />
          </button>

          {/* Zoom In / Out */}
          <div className="bg-slate-900/95 rounded-2xl shadow-xl border border-slate-700 overflow-hidden flex flex-col text-white">
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="p-3 hover:bg-slate-800 text-slate-200 transition cursor-pointer border-b border-slate-800 flex items-center justify-center"
              title="Zoom In"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="p-3 hover:bg-slate-800 text-slate-200 transition cursor-pointer flex items-center justify-center"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-3 bg-slate-900/95 hover:bg-slate-800 text-white rounded-2xl shadow-xl border border-slate-700 transition cursor-pointer flex items-center justify-center"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Network Map'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

        </div>

        {/* Floating Selected Route Card (Bottom Left) */}
        {activeRouteObj && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-30 bg-slate-950/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border-2 border-red-600 text-white animate-fade-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-700 text-white font-black text-xl flex items-center justify-center shadow-lg border border-amber-300 shrink-0">
                  {activeRouteObj.routeNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-red-950 text-red-200 px-2 py-0.5 rounded border border-red-700/60">
                      Line Details
                    </span>
                    <span className="text-xs font-mono text-amber-300">
                      {activeRouteObj.totalDistanceKm} km • {activeRouteObj.stops.length} Stops
                    </span>
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white mt-0.5">
                    {activeRouteObj.origin[language] || activeRouteObj.origin.en} ➔ {activeRouteObj.destination[language] || activeRouteObj.destination.en}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRouteId(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stops Preview Chips */}
            <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between">
              <div className="truncate max-w-[240px]">
                Stops: {activeRouteObj.stops.slice(0, 4).map((s) => s.name[language] || s.name.en).join(' • ')}...
              </div>

              {/* Action Button: find live bus on this route */}
              {(() => {
                const busOnRoute = activeBuses.find((b) => b.routeId === activeRouteObj.id);
                return busOnRoute ? (
                  <button
                    type="button"
                    onClick={() => onSelectBus(busOnRoute)}
                    className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-red-950 font-bold rounded-lg text-xs shadow transition flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>Track Bus ({busOnRoute.regNumber})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold">Active Fleet Running</span>
                );
              })()}
            </div>
          </div>
        )}

        {/* Floating Interchange Hub Modal / Popover */}
        {selectedHub && (
          <div className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-sm z-30 bg-slate-950/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border-2 border-amber-400 text-white animate-fade-in">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400 flex items-center justify-center text-lg">
                  {selectedHub.icon}
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 block">
                    {selectedHub.badge}
                  </span>
                  <h4 className="font-extrabold text-sm text-white leading-tight">
                    {selectedHub.name[language] || selectedHub.name.en}
                  </h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHub(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              {selectedHub.description[language] || selectedHub.description.en}
            </p>

            <div className="pt-2 border-t border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                Converging Bus Lines Passing Through Here:
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {routes
                  .filter((r) =>
                    r.stops.some((s) => {
                      const dLat = Math.abs(s.lat - selectedHub.coords[0]);
                      const dLng = Math.abs(s.lng - selectedHub.coords[1]);
                      return dLat < 0.02 && dLng < 0.02;
                    })
                  )
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleZoomToRoute(r)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-red-700 text-white border border-slate-700 transition cursor-pointer"
                    >
                      Route {r.routeNumber}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Status Pill */}
        <div className="absolute bottom-3 right-3 z-20 hidden sm:flex items-center gap-3 bg-slate-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700 text-[10px] text-slate-300 select-none">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Showing {filteredRoutes.length} of {routes.length} Transit Routes
          </span>
          <span>•</span>
          <span className="font-mono text-amber-300 font-bold">
            Zoom {currentZoom} {mapLayer === 'satellite' ? `(Bus ${Math.round(calculateBusScale(mapLayer, currentZoom) * 100)}%)` : ''}
          </span>
        </div>

      </div>

      {/* 4. Interactive Quick-Route Grid under the map */}
      <div className="bg-slate-950 border-t border-slate-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Quick Route Selection (Click to Highlight Corridor & Stops on Map)
          </span>
          <span className="text-xs text-amber-400 font-mono font-bold">
            {filteredRoutes.length} Lines Available
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-1.5 max-h-32 overflow-y-auto pr-1">
          {filteredRoutes.map((r) => {
            const corridor = getCorridorForRoute(r.routeNumber);
            const isSelected = selectedRouteId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleZoomToRoute(r)}
                className={`px-2 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer text-center flex flex-col items-center border ${
                  isSelected
                    ? 'bg-red-700 text-white border-amber-400 shadow-md ring-2 ring-amber-400/60'
                    : 'bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{r.routeNumber}</span>
                <span
                  className="w-full h-0.5 rounded-full mt-1"
                  style={{ backgroundColor: corridor.color }}
                ></span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
};
