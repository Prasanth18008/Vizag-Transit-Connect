import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ActiveBus, Language, Route } from '../types/transit';
import { createProceduralBusModel, ProceduralBusInstance } from './ThreeBusBuilder';
import { 
  Compass, 
  Eye, 
  LocateFixed, 
  Volume2, 
  Pause, 
  Play, 
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
  MapPin
} from 'lucide-react';

interface ThreeRouteSceneProps {
  bus: ActiveBus;
  route: Route;
  language: Language;
  onExit3D?: () => void;
}

// Convert Lat/Lng to local meters relative to route origin
function gpsToLocalMeters(lat: number, lng: number, originLat: number, originLng: number): [number, number] {
  const dLat = (lat - originLat) * 111139; // meters per degree latitude
  const dLng = (lng - originLng) * (111139 * Math.cos((originLat * Math.PI) / 180));
  // Scale down so route fits conveniently in Three.js units (1 unit = 10 meters)
  return [dLng * 0.1, -dLat * 0.1]; // X = East, Z = South/North
}

export const ThreeRouteScene: React.FC<ThreeRouteSceneProps> = ({
  bus,
  route,
  language,
  onExit3D,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const busInstanceRef = useRef<ProceduralBusInstance | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [cameraMode, setCameraMode] = useState<'chase' | 'orbit' | 'top'>('chase');
  const [isPaused, setIsPaused] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  // Pre-calculate 3D route points relative to first stop
  const originLat = route.stops[0]?.lat ?? 17.7289;
  const originLng = route.stops[0]?.lng ?? 83.3032;

  const route3DPoints = useMemo(() => {
    return route.stops.map((stop) => {
      const [x, z] = gpsToLocalMeters(stop.lat, stop.lng, originLat, originLng);
      return new THREE.Vector3(x, 0.05, z);
    });
  }, [route.stops, originLat, originLng]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Detect Software WebGL
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Slate-900 sky / evening road
    scene.fog = new THREE.FogExp2(0x0f172a, 0.005);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 15, 30);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Studio Environment Lighting
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Directional Warm Sun Key Light
    const dirLight = new THREE.DirectionalLight(0xffedd5, 1.8);
    dirLight.position.set(30, 45, 25);
    dirLight.castShadow = !isSoftwareGl;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Cool Sky/Ground Hemisphere Fill
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 1.0);
    scene.add(hemiLight);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera above ground
    controls.minDistance = 3;
    controls.maxDistance = 150;
    controlsRef.current = controls;

    // --- 1. Procedural Ground Asphalt Plane ---
    const groundGeo = new THREE.PlaneGeometry(1200, 1200);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // --- 2. 3D Route Corridor Ribbon & Road Waypoints ---
    if (route3DPoints.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(route3DPoints);
      curve.curveType = 'catmullrom';
      curve.tension = 0.2;

      // Road Surface Ribbon (Dark Asphalt)
      const roadGeo = new THREE.TubeGeometry(curve, 200, 1.4, 6, false);
      const roadMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.85,
        metalness: 0.15,
      });
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.position.y = -0.05;
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);

      // Glowing Center Route Guideline (Google Blue)
      const linePoints = curve.getPoints(300);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        linewidth: 3,
      });
      const routeLine = new THREE.Line(lineGeo, lineMat);
      routeLine.position.y = 0.12;
      scene.add(routeLine);
    }

    // --- 3. 3D Waypoint Stop Pillars & Transit Shelters ---
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.5, 12);
    const stagePillarGeo = new THREE.CylinderGeometry(0.35, 0.35, 3.2, 12);

    const normalStopMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    });
    const stageStopMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });

    route.stops.forEach((stop, idx) => {
      const pt = route3DPoints[idx];
      if (!pt) return;

      const isStage = stop.isStageStop;
      const pMesh = new THREE.Mesh(isStage ? stagePillarGeo : pillarGeo, isStage ? stageStopMat : normalStopMat);
      pMesh.position.set(pt.x, isStage ? 1.6 : 1.25, pt.z);
      pMesh.castShadow = true;
      scene.add(pMesh);

      // Top beacon ring
      const ringGeo = new THREE.TorusGeometry(0.6, 0.08, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeo, isStage ? stageStopMat : normalStopMat);
      ringMesh.position.set(pt.x, isStage ? 3.3 : 2.6, pt.z);
      scene.add(ringMesh);
    });

    // --- 4. Procedural 3D Bus Model ---
    const destinationStr = route.destination[language] || route.destination.en || 'BHEEMILI';
    const bus3D = createProceduralBusModel(bus.busClass, bus.routeNumber, destinationStr);
    scene.add(bus3D.group);
    busInstanceRef.current = bus3D;

    // Resizing Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation & Pacing Loop
    let animId = 0;
    let lastTime = performance.now();
    const _targetVec = new THREE.Vector3();
    const _camTargetVec = new THREE.Vector3();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          animId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          animId = window.setTimeout(cb, 80);
        }
      };
      animId = window.setTimeout(poll, 5);
    }

    function tick() {
      const now = performance.now();
      const delta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (busInstanceRef.current) {
        // Update 3D bus model wheels, doors, and lights
        busInstanceRef.current.update(bus.speedKmH, !!bus.isDwellAtStop, delta);
      }

      // Convert current bus GPS to local meters
      const [busX, busZ] = gpsToLocalMeters(bus.currentLat, bus.currentLng, originLat, originLng);
      _targetVec.set(busX, 0, busZ);

      // Smoothly move the 3D bus towards the GPS coordinate
      if (bus3D.group) {
        bus3D.group.position.lerp(_targetVec, Math.min(1, delta * 5));

        // Smooth heading orientation (convert degrees to radians, inverted for Three.js coordinate system)
        const targetRad = -((bus.heading || 0) * Math.PI) / 180 + Math.PI;
        bus3D.group.rotation.y = THREE.MathUtils.damp(bus3D.group.rotation.y, targetRad, 4, delta);
      }

      // Camera Following Logic
      if (cameraMode === 'chase' && bus3D.group) {
        // Behind bus at heading
        const headingRad = bus3D.group.rotation.y;
        const camDistance = 18;
        const camHeight = 9;

        const behindX = bus3D.group.position.x - Math.sin(headingRad) * camDistance;
        const behindZ = bus3D.group.position.z - Math.cos(headingRad) * camDistance;

        _camTargetVec.set(behindX, camHeight, behindZ);
        camera.position.lerp(_camTargetVec, Math.min(1, delta * 3));

        controls.target.lerp(
          new THREE.Vector3(bus3D.group.position.x, 1.2, bus3D.group.position.z),
          Math.min(1, delta * 4)
        );
        controls.update();
      } else if (cameraMode === 'top' && bus3D.group) {
        camera.position.lerp(
          new THREE.Vector3(bus3D.group.position.x, 45, bus3D.group.position.z + 0.1),
          Math.min(1, delta * 3)
        );
        controls.target.lerp(bus3D.group.position, Math.min(1, delta * 4));
        controls.update();
      } else {
        // Orbit mode: let user freely orbit around bus
        controls.target.copy(bus3D.group.position);
        controls.update();
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        animId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animId) {
        cancelAnimationFrame(animId);
        clearTimeout(animId);
      }
      if (busInstanceRef.current) {
        busInstanceRef.current.dispose();
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [bus.busClass, bus.routeNumber, route, originLat, originLng, language]);

  return (
    <div className="relative w-full h-[540px] sm:h-[620px] rounded-3xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900 select-none">
      
      {/* 1. Top HUD: Real-time 3D Telematics Banner */}
      <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-md z-20">
        <div className="bg-slate-900/90 backdrop-blur-md text-white rounded-2xl p-3.5 border border-slate-700 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-red-700 text-white font-black text-xs flex items-center justify-center shadow-md">
                {bus.routeNumber}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                    3D Realistic Bus Model
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {bus.regNumber}
                  </span>
                </div>
                <h4 className="text-sm font-black text-white">
                  {bus.isDwellAtStop ? (
                    <span className="text-amber-300 flex items-center gap-1.5 animate-pulse">
                      <span>🛑</span>
                      <span>Halted at Stop ({bus.dwellRemainingSeconds}s boarding)</span>
                    </span>
                  ) : (
                    <span>Cruising at {bus.speedKmH} km/h</span>
                  )}
                </h4>
              </div>
            </div>

            <div className="flex flex-col items-end text-right">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                bus.isDwellAtStop
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                {bus.isDwellAtStop ? 'Doors Open • Boarding' : 'Doors Closed • En Route'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                Stop #{bus.currentStopIndex + 1} of {route.stops.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Right Camera Angle & View Switcher */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-1.5 border border-slate-700 shadow-xl flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setCameraMode('chase')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              cameraMode === 'chase' ? 'bg-red-700 text-white shadow' : 'text-slate-300 hover:bg-slate-800'
            }`}
            title="Third-person Chase Cam"
          >
            <span>🎥</span>
            <span className="text-[11px]">Chase Cam</span>
          </button>

          <button
            type="button"
            onClick={() => setCameraMode('orbit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              cameraMode === 'orbit' ? 'bg-red-700 text-white shadow' : 'text-slate-300 hover:bg-slate-800'
            }`}
            title="360° Free Orbit View"
          >
            <span>🔄</span>
            <span className="text-[11px]">Orbit 360°</span>
          </button>

          <button
            type="button"
            onClick={() => setCameraMode('top')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              cameraMode === 'top' ? 'bg-red-700 text-white shadow' : 'text-slate-300 hover:bg-slate-800'
            }`}
            title="Top-down Helicopter View"
          >
            <span>🚁</span>
            <span className="text-[11px]">Top Down</span>
          </button>
        </div>

        {onExit3D && (
          <button
            type="button"
            onClick={onExit3D}
            className="px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-white rounded-2xl border border-slate-600 shadow-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>🗺️</span>
            <span>Return to 2D Map</span>
          </button>
        )}
      </div>

      {/* 3. Bottom Center Ergonomic Collapsible Dock (Zero Viewport Occlusion) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-2xl select-none">
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl p-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center shrink-0">
                <span className="text-xs font-black font-mono text-amber-400">
                  {bus.speedKmH}
                </span>
                <span className="text-[8px] uppercase tracking-wider text-slate-400">
                  km/h
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-200 truncate">
                    {route.stops[bus.currentStopIndex]?.name[language] || route.stops[bus.currentStopIndex]?.name.en}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">➔</span>
                  <span className="text-[11px] font-bold text-emerald-400 truncate">
                    {route.stops[Math.min(bus.currentStopIndex + 1, route.stops.length - 1)]?.name[language] ||
                      route.stops[Math.min(bus.currentStopIndex + 1, route.stops.length - 1)]?.name.en}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span>30s Stop Rule Active</span>
                  <span>•</span>
                  <span>Heading: {bus.heading || 0}°</span>
                  <span>•</span>
                  <span>Doors: <strong className={bus.doorStatus === 'open' ? 'text-amber-400' : 'text-slate-300'}>{bus.doorStatus.toUpperCase()}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-slate-400 hidden sm:inline">
                Drag to rotate • Scroll to zoom
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
