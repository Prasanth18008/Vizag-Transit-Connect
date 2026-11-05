import * as THREE from 'three';
import { BusClass } from '../types/transit';

export interface ProceduralBusInstance {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  leftDoor: THREE.Mesh | null;
  rightDoor: THREE.Mesh | null;
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
  ledTexture: THREE.CanvasTexture;
  update: (speedKmH: number, isStopped30s: boolean, deltaSeconds: number) => void;
  dispose: () => void;
}

/**
 * Creates an authentic procedural 3D APSRTC Bus Model (THREE.Group)
 * adhering to the Three.js multi-part composition guidelines.
 */
export function createProceduralBusModel(
  busClass: BusClass = 'electric_ac',
  routeNumber: string = '10K',
  destinationName: string = 'BHEEMILI'
): ProceduralBusInstance {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const headlights: THREE.Mesh[] = [];
  const taillights: THREE.Mesh[] = [];
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];

  // Color theme according to APSRTC class
  let primaryColor = 0x059669; // Green Metro AC Electric
  let secondaryColor = 0xf8fafc; // White roof/trim
  let accentColor = 0x06b6d4; // Cyan highlight

  if (busClass === 'metro_express') {
    primaryColor = 0xb91c1c; // APSRTC Crimson Red
    secondaryColor = 0xfacc15; // Yellow striping
    accentColor = 0xffffff;
  } else if (busClass === 'metro_deluxe') {
    primaryColor = 0x1d4ed8; // Royal Blue
    secondaryColor = 0xe2e8f0; // Silver Gray
    accentColor = 0x38bdf8;
  } else if (busClass === 'ordinary') {
    primaryColor = 0x991b1b; // Classic RTC Maroon
    secondaryColor = 0xfef3c7; // Cream
    accentColor = 0xd97706;
  }

  // --- 1. Primary Silhouette: Main Lower Chassis & Upper Coachwork ---
  const busLength = 4.2;
  const busWidth = 1.6;
  const busHeight = 1.5;

  // Lower Body (colored chassis)
  const bodyGeo = new THREE.BoxGeometry(busWidth, 0.7, busLength);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: 0.28,
    metalness: 0.22,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.55;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);
  disposables.push(bodyGeo, bodyMat);

  // Upper Cabin (White / Cream top body with windows)
  const cabinGeo = new THREE.BoxGeometry(busWidth * 0.96, 0.75, busLength * 0.98);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: secondaryColor,
    roughness: 0.35,
    metalness: 0.1,
  });
  const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
  cabinMesh.position.y = 1.25;
  cabinMesh.castShadow = true;
  group.add(cabinMesh);
  disposables.push(cabinGeo, cabinMat);

  // --- 2. Secondary Read: Windows & Windshields ---
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.08,
    metalness: 0.85,
  });
  disposables.push(glassMat);

  // Front Windshield (curved forward slope)
  const frontWindshieldGeo = new THREE.BoxGeometry(busWidth * 0.92, 0.55, 0.06);
  const frontWindshield = new THREE.Mesh(frontWindshieldGeo, glassMat);
  frontWindshield.position.set(0, 1.22, busLength * 0.49);
  group.add(frontWindshield);
  disposables.push(frontWindshieldGeo);

  // Rear Window
  const rearWindowGeo = new THREE.BoxGeometry(busWidth * 0.88, 0.48, 0.06);
  const rearWindow = new THREE.Mesh(rearWindowGeo, glassMat);
  rearWindow.position.set(0, 1.25, -busLength * 0.49);
  group.add(rearWindow);
  disposables.push(rearWindowGeo);

  // Side Passenger Windows (Left & Right continuous panoramic glazing)
  const sideGlassGeo = new THREE.BoxGeometry(0.04, 0.48, busLength * 0.82);
  const leftSideGlass = new THREE.Mesh(sideGlassGeo, glassMat);
  leftSideGlass.position.set(-busWidth * 0.485, 1.25, 0.05);
  group.add(leftSideGlass);

  const rightSideGlass = new THREE.Mesh(sideGlassGeo, glassMat);
  rightSideGlass.position.set(busWidth * 0.485, 1.25, 0.05);
  group.add(rightSideGlass);
  disposables.push(sideGlassGeo);

  // --- 3. Roof Climate AC Unit (for AC/Deluxe) or Aero Pod ---
  const acPodGeo = new THREE.BoxGeometry(busWidth * 0.65, 0.22, 1.4);
  const acPodMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.15,
  });
  const acPod = new THREE.Mesh(acPodGeo, acPodMat);
  acPod.position.set(0, 1.72, -0.2);
  group.add(acPod);
  disposables.push(acPodGeo, acPodMat);

  // --- 4. Wheels & Undercarriage ---
  const wheelRadius = 0.36;
  const wheelWidth = 0.24;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
  wheelGeo.rotateZ(Math.PI / 2); // Axis along X
  disposables.push(wheelGeo);

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.85,
    metalness: 0.05,
  });
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.25,
    metalness: 0.8,
  });
  disposables.push(tireMat, hubMat);

  const wheelPositions = [
    [-busWidth * 0.48, wheelRadius, busLength * 0.32], // Front Left
    [busWidth * 0.48, wheelRadius, busLength * 0.32],  // Front Right
    [-busWidth * 0.48, wheelRadius, -busLength * 0.3], // Rear Left
    [busWidth * 0.48, wheelRadius, -busLength * 0.3],  // Rear Right
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheelMesh = new THREE.Mesh(wheelGeo, tireMat);
    wheelMesh.position.set(wx, wy, wz);
    wheelMesh.castShadow = true;

    // Small alloy hubcap center
    const hubGeo = new THREE.CylinderGeometry(wheelRadius * 0.45, wheelRadius * 0.45, wheelWidth * 1.05, 12);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeo, hubMat);
    wheelMesh.add(hubMesh);
    disposables.push(hubGeo);

    group.add(wheelMesh);
    wheels.push(wheelMesh);
  });

  // --- 5. Front Headlights & Rear Taillights (Styled after reference images) ---
  // A. Signature Horizontal Front LED Lightbar (━━) spanning the front nose
  const lightbarGeo = new THREE.BoxGeometry(busWidth * 0.84, 0.08, 0.05);
  const lightbarMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  disposables.push(lightbarGeo, lightbarMat);

  const frontLightbar = new THREE.Mesh(lightbarGeo, lightbarMat);
  frontLightbar.position.set(0, 0.48, busLength * 0.505);
  group.add(frontLightbar);
  headlights.push(frontLightbar);

  // B. Aerodynamic Side Wing Mirrors (Left & Right - matching reference images)
  const mirrorArmGeo = new THREE.BoxGeometry(0.18, 0.04, 0.04);
  const mirrorHeadGeo = new THREE.BoxGeometry(0.06, 0.14, 0.18);
  const mirrorBodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.1,
  });
  const mirrorGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.9,
  });
  disposables.push(mirrorArmGeo, mirrorHeadGeo, mirrorBodyMat, mirrorGlassMat);

  // Left Mirror
  const leftMirrorArm = new THREE.Mesh(mirrorArmGeo, mirrorBodyMat);
  leftMirrorArm.position.set(-busWidth * 0.52, 1.15, busLength * 0.38);
  const leftMirrorHead = new THREE.Mesh(mirrorHeadGeo, mirrorBodyMat);
  leftMirrorHead.position.set(-0.1, 0, 0);
  const leftMirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), mirrorGlassMat);
  leftMirrorGlass.rotation.y = -Math.PI / 2;
  leftMirrorGlass.position.set(-0.031, 0, 0);
  leftMirrorHead.add(leftMirrorGlass);
  leftMirrorArm.add(leftMirrorHead);
  group.add(leftMirrorArm);

  // Right Mirror
  const rightMirrorArm = new THREE.Mesh(mirrorArmGeo, mirrorBodyMat);
  rightMirrorArm.position.set(busWidth * 0.52, 1.15, busLength * 0.38);
  const rightMirrorHead = new THREE.Mesh(mirrorHeadGeo, mirrorBodyMat);
  rightMirrorHead.position.set(0.1, 0, 0);
  const rightMirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), mirrorGlassMat);
  rightMirrorGlass.rotation.y = Math.PI / 2;
  rightMirrorGlass.position.set(0.031, 0, 0);
  rightMirrorHead.add(rightMirrorGlass);
  rightMirrorArm.add(rightMirrorHead);
  group.add(rightMirrorArm);

  // C. Rear Continuous Red Taillight Bar (Glows bright ruby when stopped for 30s)
  const taillightGeo = new THREE.BoxGeometry(busWidth * 0.84, 0.08, 0.05);
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x991b1b,
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });
  disposables.push(taillightGeo, taillightMat);

  const rearTaillight = new THREE.Mesh(taillightGeo, taillightMat);
  rearTaillight.position.set(0, 0.58, -busLength * 0.505);
  group.add(rearTaillight);
  taillights.push(rearTaillight);

  // --- 6. Procedural LED Destination Board (Front Top) ---
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glowing LED Dot Matrix Border
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    // LED Amber Text
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 54px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${routeNumber} ${destinationName}`.slice(0, 20), canvas.width / 2, canvas.height / 2);
  }

  const ledTexture = new THREE.CanvasTexture(canvas);
  ledTexture.colorSpace = THREE.SRGBColorSpace;
  disposables.push(ledTexture);

  const ledBoardGeo = new THREE.PlaneGeometry(busWidth * 0.85, 0.26);
  const ledBoardMat = new THREE.MeshBasicMaterial({
    map: ledTexture,
  });
  const ledBoardMesh = new THREE.Mesh(ledBoardGeo, ledBoardMat);
  ledBoardMesh.position.set(0, 1.58, busLength * 0.492);
  group.add(ledBoardMesh);
  disposables.push(ledBoardGeo, ledBoardMat);

  // --- 7. Passenger Doors (Left & Right - can animate opening when stopped 30s) ---
  const doorGeo = new THREE.BoxGeometry(0.02, 1.1, 0.55);
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.3,
  });
  disposables.push(doorGeo, doorMat);

  const rightDoor = new THREE.Mesh(doorGeo, doorMat);
  rightDoor.position.set(busWidth * 0.49, 0.85, busLength * 0.2);
  group.add(rightDoor);

  // --- 8. Contact Grounding Shadow Plane ---
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d');
  if (sCtx) {
    const radGrad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
    radGrad.addColorStop(0, 'rgba(0,0,0,0.55)');
    radGrad.addColorStop(0.5, 'rgba(0,0,0,0.25)');
    radGrad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = radGrad;
    sCtx.fillRect(0, 0, 128, 128);
  }
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  disposables.push(shadowTex);

  const shadowGeo = new THREE.PlaneGeometry(busWidth * 1.5, busLength * 1.25);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.02; // Grounded right beneath wheels
  group.add(shadowMesh);
  disposables.push(shadowGeo, shadowMat);

  // --- 9. 3D Stop Indicator Badge (Holographic "🛑 30s Boarding") above bus when stopped ---
  const stopBadgeCanvas = document.createElement('canvas');
  stopBadgeCanvas.width = 256;
  stopBadgeCanvas.height = 96;
  const bCtx = stopBadgeCanvas.getContext('2d');
  if (bCtx) {
    bCtx.fillStyle = '#b91c1c';
    bCtx.beginPath();
    bCtx.roundRect(4, 4, 248, 88, 16);
    bCtx.fill();
    bCtx.strokeStyle = '#ffffff';
    bCtx.lineWidth = 4;
    bCtx.stroke();
    bCtx.fillStyle = '#ffffff';
    bCtx.font = 'bold 36px sans-serif';
    bCtx.textAlign = 'center';
    bCtx.textBaseline = 'middle';
    bCtx.fillText('🛑 STOPPED 30s', 128, 48);
  }
  const stopBadgeTex = new THREE.CanvasTexture(stopBadgeCanvas);
  stopBadgeTex.colorSpace = THREE.SRGBColorSpace;
  disposables.push(stopBadgeTex);

  const stopBadgeGeo = new THREE.PlaneGeometry(1.6, 0.6);
  const stopBadgeMat = new THREE.MeshBasicMaterial({
    map: stopBadgeTex,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const stopBadgeMesh = new THREE.Mesh(stopBadgeGeo, stopBadgeMat);
  stopBadgeMesh.position.set(0, 2.4, 0);
  group.add(stopBadgeMesh);
  disposables.push(stopBadgeGeo, stopBadgeMat);

  // Animation Update Function
  let doorOpenAmount = 0;
  const update = (speedKmH: number, isStopped30s: boolean, deltaSeconds: number) => {
    // 1. Wheel rotation
    if (speedKmH > 0) {
      // Rotation speed proportional to vehicle velocity
      const angularVel = (speedKmH * 1000) / 3600 / wheelRadius;
      wheels.forEach((w) => {
        w.rotation.x += angularVel * deltaSeconds;
      });
    }

    // 2. Door slide animation during 30-second dwell stop
    const targetDoorOpen = isStopped30s ? 1 : 0;
    doorOpenAmount += (targetDoorOpen - doorOpenAmount) * Math.min(1, deltaSeconds * 6);
    rightDoor.position.z = busLength * 0.2 + doorOpenAmount * 0.35;
    rightDoor.scale.z = 1 - doorOpenAmount * 0.4; // Telescoping effect

    // 3. Stop badge visibility and brake lights
    if (isStopped30s) {
      stopBadgeMat.opacity = Math.min(1, stopBadgeMat.opacity + deltaSeconds * 4);
      taillightMat.emissive.setHex(0xff0000);
      taillightMat.emissiveIntensity = 2.0; // Bright brake lights when stopped
    } else {
      stopBadgeMat.opacity = Math.max(0, stopBadgeMat.opacity - deltaSeconds * 4);
      taillightMat.emissive.setHex(0x991b1b);
      taillightMat.emissiveIntensity = 0.6;
    }
  };

  const dispose = () => {
    disposables.forEach((item) => {
      if ('dispose' in item && typeof item.dispose === 'function') {
        item.dispose();
      }
    });
  };

  return {
    group,
    wheels,
    leftDoor: null,
    rightDoor,
    headlights,
    taillights,
    ledTexture,
    update,
    dispose,
  };
}
