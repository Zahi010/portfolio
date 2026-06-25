/**
 * MISSION CONTROL: ZAHI-01
 * Core Application Logic
 */

// --- Global Error Handler ---
window.onerror = function(msg, url, lineNo, columnNo, error) {
  const errDiv = document.createElement('div');
  errDiv.style.position = 'fixed';
  errDiv.style.top = '50px';
  errDiv.style.left = '50px';
  errDiv.style.background = 'rgba(255,0,0,0.9)';
  errDiv.style.color = 'white';
  errDiv.style.zIndex = '9999';
  errDiv.style.padding = '20px';
  errDiv.style.fontFamily = 'monospace';
  errDiv.innerHTML = `<h2>CRASH REPORT</h2><p>${msg}</p><p>Line: ${lineNo}</p>`;
  document.body.appendChild(errDiv);
  return false;
};

// --- Audio System ---
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
      return false;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return true;
}

function playSound(type) {
  if (!initAudio() || !audioCtx) return;
  const dest = audioCtx.destination;

  if (type === 'boot') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(50, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2.0);
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(audioCtx.currentTime + 2.0);
  } else if (type === 'beep') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } else if (type === 'success') {
    const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + i * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.1 + 0.5);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(audioCtx.currentTime + i * 0.1);
      osc.stop(audioCtx.currentTime + i * 0.1 + 0.5);
    });
  }
}

function startAmbientHum() {
  if (!initAudio() || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 60; // Deep hum
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
}

// --- Boot Sequence ---
const bootLogs = [
  { text: "SYSTEM ONLINE", class: "success", delay: 0.5 },
  { text: "INITIALIZING NETWORK PROTOCOLS...", class: "", delay: 1.0 },
  { text: "ESTABLISHING SECURE CONNECTION...", class: "", delay: 1.5 },
  { text: "WARNING: UNAUTHORIZED ACCESS ATTEMPT BLOCKED", class: "warn", delay: 2.0 },
  { text: "LOADING PROFILE: ZAHI_01", class: "success", delay: 2.5 },
  { text: "ACCESS GRANTED", class: "success", delay: 3.0 }
];

function runBootSequence() {
  if (typeof gsap === 'undefined') {
    alert("GSAP failed to load. Please check your internet connection.");
    return;
  }
  const tl = gsap.timeline();
  
  tl.to(".boot-text", { opacity: 1, duration: 1, ease: "power2.inOut" })
    .to(".boot-subtitle", { opacity: 1, duration: 1 }, "-=0.5");

  const logsContainer = document.getElementById('boot-logs');
  
  bootLogs.forEach(log => {
    const el = document.createElement('div');
    el.className = `log-line ${log.class}`;
    el.innerText = `> ${log.text}`;
    logsContainer.appendChild(el);
    
    tl.to(el, {
      opacity: 1,
      duration: 0.2,
      onStart: () => playSound('beep')
    }, log.delay + 1);
  });

  tl.to(".boot-prompt", { opacity: 1, duration: 0.5 }, "+=0.5");

  // Spacebar to enter
  const handleBootEnter = (e) => {
    if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
      window.removeEventListener('keydown', handleBootEnter);
      enterMissionControl();
    }
  };
  window.addEventListener('keydown', handleBootEnter);
  
  // Allow clicking anywhere on the boot screen as a fallback
  document.getElementById('boot-screen').addEventListener('click', () => {
    window.removeEventListener('keydown', handleBootEnter);
    enterMissionControl();
  }, { once: true });
}

window.enterMissionControl = function enterMissionControl() {
  if (gameState.isBooted) return; // Prevent double trigger
  gameState.isBooted = true;

  playSound('boot');

  // Hide boot screen
  gsap.to("#boot-screen", { opacity: 0, duration: 1.5, onComplete: () => {
    document.getElementById('boot-screen').style.display = 'none';
  }});

  // 1. Lock controls and spawn player in the sky
  gameState.isDropping = true;
  if (playerGroup) {
    playerGroup.position.y = 200;
    playerGroup.visible = false; // Hide for First Person POV
  }

  // 2. Build Warp Tunnel & Follow Light
  buildWarpTunnel();
  
  const dropLight = new THREE.PointLight(0xffffff, 5.0, 50);
  dropLight.position.set(0, 5, 0);
  playerGroup.add(dropLight);

  // 3. Cinematic Drop Sequence
  gsap.to(playerGroup.position, {
    y: 0,
    duration: 2.5,
    ease: "power2.in", // Accelerate downwards (gravity)
    onComplete: () => {
      // Impact!
      startAmbientHum();
      
      // Remove Drop Light
      playerGroup.remove(dropLight);
      
      // Massive Power-On Flash (handled above)
      // Snap Character Upright & Show
      playerGroup.rotation.set(0, playerGroup.rotation.y, 0);
      playerGroup.visible = true;
      
      // Heavy Camera Shake
      gameState.shakeAmount = 4.0;

      // Massive Power-On Flash (shorter duration so it doesn't blind the pulse animation)
      const flash = new THREE.AmbientLight(0xffffff, 50.0);
      scene.add(flash);
      gsap.to(flash, { intensity: 0, duration: 0.5, ease: "power2.out", onComplete: () => {
        scene.remove(flash);
        // Delay the burst until after the flash fades!
        if (gameState.pulses) {
          gameState.pulses.forEach(p => {
            // Find angle of this circuit path
            let angle = Math.atan2(p.points[1].z, p.points[1].x);
            if (angle < 0) angle += Math.PI * 2;
            
            // Stagger pulse start based on angle to create a sweeping wave effect
            let delayDistance = (angle / (Math.PI * 2)) * 30; // 30 units delay
            p.progress = -delayDistance; 
            p.speed = 15; // Consistent speed
          });
        }
      }});

      // Remove Warp Tunnel
      if (gameState.warpTunnel) {
        playerGroup.remove(gameState.warpTunnel);
        gameState.warpTunnel.geometry.dispose();
        gameState.warpTunnel.material.dispose();
        gameState.warpTunnel = null;
      }

      // Unlock Controls
      gameState.isDropping = false;

      // Show HUD
      gsap.to("#hud", { opacity: 1, duration: 1.5 });

      // Power on Environment
      activateEnvironment();
    }
  });
}

function buildWarpTunnel() {
  if (!playerGroup) return;
  // A long cylinder of wireframe data that rushes past the player
  const geo = new THREE.CylinderGeometry(8, 8, 300, 16, 20, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x00f3ff,
    wireframe: true,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });
  const tunnel = new THREE.Mesh(geo, mat);
  
  // Attach directly to player so it falls with them
  tunnel.position.set(0, -150, 0); 
  playerGroup.add(tunnel);
  gameState.warpTunnel = tunnel;
}

// --- Three.js Setup ---
const gameState = {
  isBooted: false,
  isInteracting: false,
  visitedTerminals: new Set(),
  keys: { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, Shift: false },
  moveSpeed: 0.05,
  sprintMultiplier: 3.0,
  pitch: 0,
  yaw: 0,
  bobTime: 0,
  isDropping: false,
  shakeAmount: 0
};

let scene, camera, renderer, raycaster;
let nocGroup, nocPackets = [];
const terminals = [];
let clock;

// Player Variables
let playerGroup, mixer, idleAction, walkAction, runAction, activeAction;
let isModelLoaded = false;

function init3D() {
  if (typeof THREE === 'undefined') {
    alert("THREE.js failed to load. Please check your internet connection.");
    return;
  }
  
  clock = new THREE.Clock();
  const container = document.getElementById('canvas-container');
  
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x010306, 0.02);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.7, 15); // Eye level
  
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Lighting (Starts dim)
  const ambient = new THREE.AmbientLight(0x00f3ff, 0.05);
  scene.add(ambient);
  gameState.ambientLight = ambient;

  const dirLight = new THREE.DirectionalLight(0xffffff, 0);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);
  gameState.dirLight = dirLight;

  // Hemisphere light for a cyberpunk two-tone effect
  const hemiLight = new THREE.HemisphereLight(0xff00aa, 0x00f3ff, 0); // pink to cyan
  scene.add(hemiLight);
  gameState.hemiLight = hemiLight;

  // Build Sky
  buildSkybox();

  // Build Room
  buildEnvironment();
  
  // Build Central Hologram
  buildNetworkHologram();

  // Build Terminals
  buildTerminals();

  // Build Player
  buildPlayer();

  // Setup Raycaster
  raycaster = new THREE.Raycaster();

  // Controls & Events
  setupControls();
  window.addEventListener('resize', onWindowResize);

  animate();
}

function buildSkybox() {
  gameState.skyGroup = new THREE.Group();

  // Outer Cyan Grid
  const skyGeo1 = new THREE.SphereGeometry(200, 32, 32);
  const skyMat1 = new THREE.MeshBasicMaterial({ 
    color: 0x00f3ff, wireframe: true, transparent: true, opacity: 0.15, side: THREE.BackSide, fog: false 
  });
  const sky1 = new THREE.Mesh(skyGeo1, skyMat1);
  gameState.skyGroup.add(sky1);

  // Inner Purple Grid (adds parallax depth)
  const skyGeo2 = new THREE.SphereGeometry(180, 24, 24);
  const skyMat2 = new THREE.MeshBasicMaterial({ 
    color: 0xaa00ff, wireframe: true, transparent: true, opacity: 0.1, side: THREE.BackSide, fog: false 
  });
  const sky2 = new THREE.Mesh(skyGeo2, skyMat2);
  gameState.skyGroup.add(sky2);

  // Distant Data Nodes (Stars)
  const starGeo = new THREE.BufferGeometry();
  const starCount = 800;
  const starPos = new Float32Array(starCount * 3);
  for(let i=0; i<starCount; i++) {
    const r = 160 + Math.random() * 30; // Radius between 160 and 190
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    starPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i*3+2] = r * Math.cos(phi);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0x00f3ff, size: 1.5, transparent: true, opacity: 0.8, fog: false });
  const stars = new THREE.Points(starGeo, starMat);
  gameState.skyGroup.add(stars);

  // The "Black Hole Router" Anomaly (reference to the user's project)
  const blackHoleGroup = new THREE.Group();
  blackHoleGroup.position.set(-100, 80, -100); // Looming in the distance
  
  // Event Horizon
  const bhGeo = new THREE.SphereGeometry(15, 32, 32);
  const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
  const blackHole = new THREE.Mesh(bhGeo, bhMat);
  
  // Make it interactive from afar
  blackHole.userData = { isTerminal: true, isAnomaly: true, id: 'anomaly', title: 'ANOMALY DETECTED: BHR PROJECT' };
  terminals.push(blackHole);

  blackHoleGroup.add(blackHole);

  // Accretion Disk (Swirling red data)
  const diskGeo = new THREE.TorusGeometry(22, 2, 16, 100);
  const diskMat = new THREE.MeshBasicMaterial({ color: 0xff0055, wireframe: true, transparent: true, opacity: 0.8, fog: false });
  const disk = new THREE.Mesh(diskGeo, diskMat);
  disk.rotation.x = Math.PI / 2.5;
  blackHoleGroup.add(disk);

  // Warning light aura
  const warningAura = new THREE.PointLight(0xff0055, 2, 100);
  blackHoleGroup.add(warningAura);

  gameState.skyGroup.add(blackHoleGroup);
  gameState.blackHoleDisk = disk;
  gameState.blackHoleGroup = blackHoleGroup;
  gameState.bhAngle = -Math.PI / 4; // Initial angle

  scene.add(gameState.skyGroup);

  // Add extra massive atmospheric details
  buildSkyExtras();
}

function buildSkyExtras() {
  gameState.skyExtras = new THREE.Group();
  
  // 1. Planetary Data Rings
  const ringGroup = new THREE.Group();
  const ringGeo1 = new THREE.TorusGeometry(130, 0.2, 16, 100);
  const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.3, fog: false });
  const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
  ring1.rotation.x = Math.PI / 2.2;
  ringGroup.add(ring1);

  const ringGeo2 = new THREE.TorusGeometry(140, 0.5, 16, 100);
  const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xaa00ff, transparent: true, opacity: 0.15, fog: false });
  const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
  ring2.rotation.x = Math.PI / 2.1;
  ringGroup.add(ring2);
  
  gameState.skyExtras.add(ringGroup);
  gameState.planetaryRings = ringGroup;

  // 2. Distant Network Hubs
  gameState.hubs = [];
  const hubGeo = new THREE.IcosahedronGeometry(8, 0);
  const hubMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: true, transparent: true, opacity: 0.4, fog: false });
  for(let i=0; i<3; i++) {
    const hub = new THREE.Mesh(hubGeo, hubMat);
    const angle = (i / 3) * Math.PI * 2;
    hub.position.set(Math.cos(angle) * 150, 40 + Math.random() * 40, Math.sin(angle) * 150);
    gameState.skyExtras.add(hub);
    gameState.hubs.push(hub);
  }

  // 3. Surveillance Satellites
  gameState.satellites = [];
  for(let i=0; i<2; i++) {
    const satGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 4), new THREE.MeshBasicMaterial({ color: 0x555555, fog: false }));
    satGroup.add(body);
    // Solar panels
    const panelGeo = new THREE.PlaneGeometry(8, 2);
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x0077ff, wireframe: true, fog: false });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.rotation.x = Math.PI / 2;
    satGroup.add(panel);
    
    // Laser beam (pointing local -Z)
    const laserMat = new THREE.LineBasicMaterial({ color: 0xff0055, transparent: true, opacity: 0.5, fog: false });
    const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0, 0, -150)]);
    const laser = new THREE.Line(laserGeo, laserMat);
    satGroup.add(laser);

    satGroup.userData = { angle: i * Math.PI, radius: 90, height: 60 };
    gameState.skyExtras.add(satGroup);
    gameState.satellites.push(satGroup);
  }

  // 4. Shooting Data Packets (Meteors)
  gameState.meteors = [];
  const meteorGeo = new THREE.BoxGeometry(0.5, 0.5, 20);
  const meteorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false });
  for(let i=0; i<5; i++) {
    const meteor = new THREE.Mesh(meteorGeo, meteorMat);
    meteor.position.set(0, -1000, 0); // hide initially
    meteor.userData = { active: false, speed: 250 };
    gameState.skyExtras.add(meteor);
    gameState.meteors.push(meteor);
  }

  // 5. Cyber-Auroras (Ribbons)
  gameState.auroras = [];
  const auroraMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
  for(let i=0; i<3; i++) {
    const auroraGeo = new THREE.PlaneGeometry(300, 30, 64, 1);
    const aurora = new THREE.Mesh(auroraGeo, auroraMat);
    aurora.position.set(0, 100 + i * 20, -100 + i * 40);
    // Save original vertices for undulating
    aurora.userData = { 
      vertices: Array.from(auroraGeo.attributes.position.array),
      offset: Math.random() * 100
    };
    gameState.skyExtras.add(aurora);
    gameState.auroras.push(aurora);
  }

  scene.add(gameState.skyExtras);
}

function buildEnvironment() {
  // Floor Grid
  const gridHelper = new THREE.GridHelper(100, 50, 0x00f3ff, 0x002244);
  gridHelper.position.y = 0.01; // slightly above floor
  scene.add(gridHelper);

  const floorGeo = new THREE.PlaneGeometry(100, 100);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x001a33, roughness: 0.1, metalness: 0.8 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  gameState.floorMat = floorMat;

  // Walls (Dark Panels with neon strips)
  const wallGroup = new THREE.Group();
  for(let i=0; i<32; i++) {
    const angle = (i/32) * Math.PI * 2;
    // Main wall panel
    const wallGeo = new THREE.BoxGeometry(4, 15, 0.5);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x011122 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(Math.cos(angle) * 35, 7.5, Math.sin(angle) * 35);
    wall.lookAt(0, 7.5, 0);
    wallGroup.add(wall);

    // Neon strip
    if (i % 2 === 0) {
      const neonGeo = new THREE.BoxGeometry(0.2, 10, 0.6);
      const neonMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.8 });
      const neon = new THREE.Mesh(neonGeo, neonMat);
      neon.position.set(Math.cos(angle) * 34.5, 5, Math.sin(angle) * 34.5);
      neon.lookAt(0, 5, 0);
      wallGroup.add(neon);
    }
  }
  scene.add(wallGroup);

  // Particles (Data Dust)
  buildParticles();

  // Floor Circuits
  buildCircuits();
}

function buildCircuits() {
  gameState.pulses = [];

  const circuitMat = new THREE.LineBasicMaterial({ color: 0x0077ff, transparent: true, opacity: 0.3 });
  const pulseGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });

  const numPaths = 16; // Radial paths
  for (let i = 0; i < numPaths; i++) {
    const angle = (i / numPaths) * Math.PI * 2;
    
    // Create a stepped path (PCB trace style)
    const points = [];
    let r = 2; // start outside core
    let currentX = Math.cos(angle) * r;
    let currentZ = Math.sin(angle) * r;
    points.push(new THREE.Vector3(currentX, 0.05, currentZ)); // Slightly above floor

    const steps = 4;
    for (let s = 0; s < steps; s++) {
      r += 5 + Math.random() * 5;
      
      // Right angle routing
      if (Math.random() > 0.5) {
         currentX = Math.cos(angle) * r;
         points.push(new THREE.Vector3(currentX, 0.05, currentZ));
         currentZ = Math.sin(angle) * r;
         points.push(new THREE.Vector3(currentX, 0.05, currentZ));
      } else {
         currentZ = Math.sin(angle) * r;
         points.push(new THREE.Vector3(currentX, 0.05, currentZ));
         currentX = Math.cos(angle) * r;
         points.push(new THREE.Vector3(currentX, 0.05, currentZ));
      }
    }

    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeo, circuitMat);
    scene.add(line);
    
    // Calculate total path length for animation
    let pathLength = 0;
    const distances = [0];
    for(let p=1; p<points.length; p++) {
       const dist = points[p].distanceTo(points[p-1]);
       pathLength += dist;
       distances.push(pathLength);
    }

    // Add pulses per path
    const numPulses = 1 + Math.floor(Math.random() * 2);
    for(let p=0; p<numPulses; p++) {
       const pulse = new THREE.Mesh(pulseGeo, pulseMat);
       pulse.position.copy(points[0]);
       scene.add(pulse);
       gameState.pulses.push({
          mesh: pulse,
          points: points,
          distances: distances,
          totalLength: pathLength,
          progress: Math.random() * pathLength, // start at random pos
          speed: 4 + Math.random() * 4 // Units per second
       });
    }
  }
}

function buildParticles() {
  const particleGeo = new THREE.BufferGeometry();
  const particleCount = 1000;
  const posArray = new Float32Array(particleCount * 3);
  for(let i=0; i<particleCount*3; i++) {
    posArray[i] = (Math.random() - 0.5) * 80; // x
    posArray[i+1] = Math.random() * 20;       // y
    posArray[i+2] = (Math.random() - 0.5) * 80; // z
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const particleMat = new THREE.PointsMaterial({
    size: 0.1,
    color: 0x00f3ff,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  });
  const particleMesh = new THREE.Points(particleGeo, particleMat);
  scene.add(particleMesh);
  gameState.particles = particleMesh;
}

function buildNetworkHologram() {
  nocGroup = new THREE.Group();
  nocGroup.position.set(0, 3, 0);

  // Outer glowing ring
  const ringGeo = new THREE.TorusGeometry(4, 0.05, 16, 100);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, transparent: true, opacity: 0.5 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  nocGroup.add(ring);

  // Inner ring
  const ringGeo2 = new THREE.TorusGeometry(3.5, 0.02, 16, 100);
  const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.5 });
  const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
  ring2.rotation.x = Math.PI / 2;
  nocGroup.add(ring2);

  // Core Router Nodes
  const nodeGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const normalNodeMat = new THREE.MeshBasicMaterial({ color: 0x0077ff, wireframe: true });
  const compromisedNodeMat = new THREE.MeshBasicMaterial({ color: 0xff0055, wireframe: false }); // Black Hole
  
  const nodes = [];
  const radius = 3;
  for(let i=0; i<8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const mesh = new THREE.Mesh(nodeGeo, i === 3 ? compromisedNodeMat : normalNodeMat);
    mesh.position.set(Math.cos(angle) * radius, Math.sin(angle * 2) * 0.5, Math.sin(angle) * radius);
    nocGroup.add(mesh);
    nodes.push(mesh);

    // Connections
    if (i > 0) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([nodes[i-1].position, mesh.position]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.3 });
      nocGroup.add(new THREE.Line(lineGeo, lineMat));
    }
  }
  // Connect last to first
  const lineGeo = new THREE.BufferGeometry().setFromPoints([nodes[7].position, nodes[0].position]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.3 });
  nocGroup.add(new THREE.Line(lineGeo, lineMat));

  // Packets (moving data spheres)
  const packetGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const packetMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
  
  for(let i=0; i<10; i++) {
    const packet = new THREE.Mesh(packetGeo, packetMat);
    packet.userData = { angle: Math.random() * Math.PI * 2, speed: 0.5 + Math.random() * 1.5, radius: radius };
    nocGroup.add(packet);
    nocPackets.push(packet);
  }

  // Central Core Light
  const coreLight = new THREE.PointLight(0x00f3ff, 0, 20);
  coreLight.position.set(0, 0, 0);
  nocGroup.add(coreLight);
  gameState.coreLight = coreLight;

  scene.add(nocGroup);

  // Central Hologram Pedestal
  const baseGeo = new THREE.CylinderGeometry(2, 2.5, 1, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x011122, roughness: 0.5, metalness: 0.8 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.set(0, 0.5, 0);
  scene.add(base);

  // Invisible Hitbox for Interaction
  const coreHitboxGeo = new THREE.CylinderGeometry(3, 3, 5, 16);
  const coreHitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  const coreHitbox = new THREE.Mesh(coreHitboxGeo, coreHitboxMat);
  coreHitbox.position.set(0, 2.5, 0);
  coreHitbox.userData = { isTerminal: true, isAnomaly: true, id: 'about', title: 'SYSTEM ARCHITECT PROFILE' };
  scene.add(coreHitbox);
  terminals.push(coreHitbox);

  // Holographic Nameplate
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'transparent';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 90px "Orbitron", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#00f3ff';
  ctx.shadowColor = '#00f3ff';
  ctx.shadowBlur = 25;
  ctx.fillText('ZAHI AHMED', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '40px "Share Tech Mono", monospace';
  ctx.fillStyle = '#ffaa00';
  ctx.fillText('MISSION CONTROL', canvas.width / 2, canvas.height / 2 + 50);

  const nameTex = new THREE.CanvasTexture(canvas);
  const nameMat = new THREE.MeshBasicMaterial({ 
    map: nameTex, 
    transparent: true, 
    side: THREE.DoubleSide, 
    blending: THREE.AdditiveBlending,
    depthWrite: false 
  });
  const nameGeo = new THREE.PlaneGeometry(8, 2);
  const nameplate = new THREE.Mesh(nameGeo, nameMat);
  nameplate.position.set(0, 3, 0); // Float above the rings
  nocGroup.add(nameplate);
}

function buildTerminals() {
  const terminalData = [
    { id: 'education', title: 'ACADEMIC DATABASE', angle: 0 },
    { id: 'skills', title: 'SYSTEM CAPABILITIES', angle: Math.PI * 0.4 },
    { id: 'projects', title: 'RESEARCH LAB', angle: Math.PI * 0.8 },
    { id: 'experience', title: 'MISSION LOGS', angle: Math.PI * 1.2 },
    { id: 'contact', title: 'COMMUNICATION CENTER', angle: Math.PI * 1.6 }
  ];

  const radius = 15; // Further out

  terminalData.forEach(data => {
    const group = new THREE.Group();
    
    group.position.x = Math.cos(data.angle) * radius;
    group.position.z = Math.sin(data.angle) * radius;
    group.position.y = 0;
    group.lookAt(0, 0, 0);

    // Command Desk Base
    const deskGeo = new THREE.BoxGeometry(4, 1.5, 1.5);
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x011122, roughness: 0.5 });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.y = 0.75;
    group.add(desk);

    // Keyboard panel (angled)
    const kbGeo = new THREE.BoxGeometry(3, 0.1, 1);
    const kbMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, wireframe: true });
    const kb = new THREE.Mesh(kbGeo, kbMat);
    kb.position.set(0, 1.5, 0.5);
    kb.rotation.x = -Math.PI / 8;
    group.add(kb);

    // Screen Hologram
    const screenGeo = new THREE.PlaneGeometry(4, 2.5);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 3, -0.5);
    screen.userData = { isTerminal: true, id: data.id, title: data.title };
    group.add(screen);

    // PointLight for terminal
    const light = new THREE.PointLight(0x00f3ff, 0, 10);
    light.position.set(0, 3, 1);
    group.add(light);
    screen.userData.light = light; // Save reference to turn on later

    // Floating HTML Marker
    const markerEl = document.createElement('div');
    markerEl.className = 'marker';
    markerEl.innerText = data.title;
    markerEl.style.display = 'none'; // hide until booted
    document.getElementById('markers-container').appendChild(markerEl);
    
    // Save 3D position for the marker
    const markerPos = group.position.clone();
    markerPos.y += 6; // Float above the screen

    screen.userData.markerEl = markerEl;
    screen.userData.markerPos = markerPos;

    scene.add(group);
    terminals.push(screen);
  });
}

function activateEnvironment() {
  // Core turns on immediately
  if (gameState.ambientLight) gsap.to(gameState.ambientLight, { intensity: 0.4, duration: 1 });
  if (gameState.coreLight) gsap.to(gameState.coreLight, { intensity: 5.0, duration: 0.5 });
  
  // Terminals turn on SEQUENTIALLY in a sweeping circle matching the pulses!
  terminals.forEach(t => {
    if (t.userData.light && t.parent) {
      // Find angle of terminal
      let angle = Math.atan2(t.parent.position.z, t.parent.position.x);
      if (angle < 0) angle += Math.PI * 2;
      
      // Delay = 0.5 (flash) + 1.0 (travel time to radius 15 at speed 15) + angle stagger
      let angleDelay = (angle / (Math.PI * 2)) * 2.0; // 2 seconds to sweep full circle
      let delay = 0.5 + 1.0 + angleDelay;

      // Sharp POP!
      gsap.to(t.userData.light, { intensity: 2.0, duration: 0.1, delay: delay, onComplete: () => {
         gsap.to(t.userData.light, { intensity: 1.0, duration: 0.5 });
      }});
      
      if (t.material) {
        t.material.opacity = 0; // Start completely off
        gsap.to(t.material, { opacity: 0.8, duration: 0.1, delay: delay, onComplete: () => {
           gsap.to(t.material, { opacity: 0.15, duration: 0.5 });
        }});
      }
    }
  });

  // Global lights fade in slowly afterwards
  if (gameState.dirLight) gsap.to(gameState.dirLight, { intensity: 1.5, duration: 3, delay: 3.5 });
  if (gameState.hemiLight) gsap.to(gameState.hemiLight, { intensity: 0.4, duration: 3, delay: 3.5 });
}

function buildPlayer() {
  playerGroup = new THREE.Group();
  playerGroup.position.set(0, 0, 15); // Start position
  scene.add(playerGroup);

  const loader = new THREE.GLTFLoader();
  loader.load('RobotExpressive.glb', (gltf) => {
    const model = gltf.scene;
    // The RobotExpressive model is slightly large, scaling down
    model.scale.set(0.4, 0.4, 0.4);
    // Face correct direction natively
    model.rotation.y = 0; 
    playerGroup.add(model);

    mixer = new THREE.AnimationMixer(model);
    const animations = gltf.animations;
    
    if (animations && animations.length > 0) {
      idleAction = mixer.clipAction(THREE.AnimationClip.findByName(animations, 'Idle'));
      walkAction = mixer.clipAction(THREE.AnimationClip.findByName(animations, 'Walking'));
      runAction = mixer.clipAction(THREE.AnimationClip.findByName(animations, 'Running'));

      if (idleAction) {
        activeAction = idleAction;
        activeAction.play();
      }
    }

    isModelLoaded = true;
  }, undefined, (error) => {
    console.error("Error loading model:", error);
    // Fallback if model fails: Create a simple placeholder
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), mat);
    box.position.y = 1;
    playerGroup.add(box);
  });
}

function setAction(toAction) {
  if (!toAction || toAction === activeAction) return;
  activeAction.fadeOut(0.2);
  toAction.reset().fadeIn(0.2).play();
  activeAction = toAction;
}

// --- Controls & Interaction ---

const keyMap = {
  'w': 'w', 'W': 'w', 'KeyW': 'w',
  'a': 'a', 'A': 'a', 'KeyA': 'a',
  's': 's', 'S': 's', 'KeyS': 's',
  'd': 'd', 'D': 'd', 'KeyD': 'd',
  'ArrowUp': 'ArrowUp',
  'ArrowDown': 'ArrowDown',
  'ArrowLeft': 'ArrowLeft',
  'ArrowRight': 'ArrowRight',
  'Shift': 'Shift', 'ShiftLeft': 'Shift', 'ShiftRight': 'Shift'
};

function setupControls() {
  const container = document.getElementById('canvas-container');

  // Request Pointer Lock on click for true FPS feel
  container.addEventListener('click', () => {
    if (gameState.isBooted && !gameState.isInteracting) {
      container.requestPointerLock();
    }
  });

  // Mouse Look
  document.addEventListener('mousemove', (e) => {
    if (gameState.isInteracting || !gameState.isBooted) return;
    
    // Use movementX/Y if pointer is locked, otherwise allow drag-to-look
    if (document.pointerLockElement === container || e.buttons === 1) {
      const deltaX = e.movementX || 0;
      const deltaY = e.movementY || 0;

      // Adjust sensitivity
      gameState.yaw -= deltaX * 0.002;
      gameState.pitch -= deltaY * 0.002;

      // Clamp pitch
      gameState.pitch = Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, gameState.pitch));
    }
  });

  // Keyboard
  window.addEventListener('keydown', (e) => {
    const mapped = keyMap[e.code] || keyMap[e.key];
    if (mapped) gameState.keys[mapped] = true;

    if (e.code === 'Space' && gameState.isBooted) {
      if (!gameState.isInteracting) {
        checkInteraction();
      }
    }

    if (e.code === 'Escape' && gameState.isInteracting) {
      closeTerminal();
    }
  });

  window.addEventListener('keyup', (e) => {
    const mapped = keyMap[e.code] || keyMap[e.key];
    if (mapped) gameState.keys[mapped] = false;
  });

  // UI Close Button
  document.getElementById('close-terminal').addEventListener('click', closeTerminal);
}

function updateMovement() {
  if (gameState.isInteracting || !gameState.isBooted || !playerGroup) return;

  // First Person Camera during drop sequence
  if (gameState.isDropping) {
    camera.position.x = playerGroup.position.x;
    camera.position.y = playerGroup.position.y;
    camera.position.z = playerGroup.position.z;
    // Look straight down the time portal
    camera.lookAt(playerGroup.position.x, playerGroup.position.y - 10, playerGroup.position.z);
    return;
  }

  let speed = gameState.moveSpeed;
  if (gameState.keys.Shift) speed *= gameState.sprintMultiplier;

  // Calculate Forward/Right vectors based on camera yaw
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), gameState.yaw);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), gameState.yaw);

  let moveX = 0, moveZ = 0;
  if (gameState.keys.w || gameState.keys.ArrowUp) { moveX += forward.x; moveZ += forward.z; }
  if (gameState.keys.s || gameState.keys.ArrowDown) { moveX -= forward.x; moveZ -= forward.z; }
  if (gameState.keys.d || gameState.keys.ArrowRight) { moveX += right.x; moveZ += right.z; }
  if (gameState.keys.a || gameState.keys.ArrowLeft) { moveX -= right.x; moveZ -= right.z; }

  // Normalize & Move Player
  if (moveX !== 0 || moveZ !== 0) {
    const len = Math.sqrt(moveX*moveX + moveZ*moveZ);
    moveX = (moveX/len) * speed;
    moveZ = (moveZ/len) * speed;

    playerGroup.position.x += moveX;
    playerGroup.position.z += moveZ;

    // Rotate player to face movement direction
    const targetAngle = Math.atan2(moveX, moveZ);
    // Smooth rotation
    let angleDiff = targetAngle - playerGroup.rotation.y;
    // Normalize angle difference to -PI to PI
    while(angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
    while(angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    playerGroup.rotation.y += angleDiff * 0.15;

    // Head bobbing logic for camera
    gameState.bobTime += speed;

    if (isModelLoaded && walkAction && runAction) {
      if (gameState.keys.Shift) {
        setAction(runAction);
      } else {
        setAction(walkAction);
      }
    }
  } else {
    // Return to idle
    if (isModelLoaded && idleAction) {
      setAction(idleAction);
    }
  }

  // Room boundary collision
  const distFromCenter = Math.sqrt(playerGroup.position.x**2 + playerGroup.position.z**2);
  if (distFromCenter > 28) {
    const angle = Math.atan2(playerGroup.position.z, playerGroup.position.x);
    playerGroup.position.x = Math.cos(angle) * 28;
    playerGroup.position.z = Math.sin(angle) * 28;
  }

  // Central Core Collision
  if (distFromCenter < 3.5) {
    const angle = Math.atan2(playerGroup.position.z, playerGroup.position.x);
    playerGroup.position.x = Math.cos(angle) * 3.5;
    playerGroup.position.z = Math.sin(angle) * 3.5;
  }

  // Terminal Desks Collision
  terminals.forEach(t => {
    if (t.userData.isAnomaly) return; // Skip Black Hole in sky
    
    // The screen is a child of the group. We check collision against the group's position.
    const termPos = t.parent.position; 
    const dx = playerGroup.position.x - termPos.x;
    const dz = playerGroup.position.z - termPos.z;
    const distSq = dx*dx + dz*dz;
    
    if (distSq < 9) { // Collision radius of 3 (3^2 = 9)
      const dist = Math.sqrt(distSq);
      playerGroup.position.x = termPos.x + (dx / dist) * 3;
      playerGroup.position.z = termPos.z + (dz / dist) * 3;
    }
  });

  // Third Person Camera Follow
  const distance = 5.0;
  const heightOffset = 1.5;
  
  // Calculate camera offset
  const offsetX = Math.sin(gameState.yaw) * Math.cos(gameState.pitch) * distance;
  const offsetY = -Math.sin(gameState.pitch) * distance;
  const offsetZ = Math.cos(gameState.yaw) * Math.cos(gameState.pitch) * distance;

  camera.position.x = playerGroup.position.x + offsetX;
  camera.position.y = playerGroup.position.y + heightOffset + offsetY;
  camera.position.z = playerGroup.position.z + offsetZ;

  // Look at player's head
  camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1.5, playerGroup.position.z);

  updateRaycaster();
}

function updateRaycaster() {
  // Raycast from camera center
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(terminals);

  const prompt = document.getElementById('interaction-prompt');
  const crosshair = document.getElementById('crosshair');

  // Because the camera is further back, increase interaction distance
  if (intersects.length > 0 && (intersects[0].distance < 15 || intersects[0].object.userData.isAnomaly)) {
    const terminal = intersects[0].object;
    // Highlight screen
    if (!terminal.userData.isAnomaly) {
      terminal.material.opacity = 0.4;
      terminal.material.color.setHex(0xffffff);
    }
    
    prompt.style.opacity = 1;
    prompt.innerHTML = `PRESS <span>SPACE</span> TO ACCESS [${terminal.userData.title}]`;
    if (crosshair) crosshair.classList.add('active');
    
    gameState.hoveredTerminal = terminal.userData;
  } else {
    terminals.forEach(t => {
      if (t.material && !t.userData.isAnomaly) {
        t.material.opacity = 0.15;
        t.material.color.setHex(0x00f3ff);
      }
    });
    prompt.style.opacity = 0;
    if (crosshair) crosshair.classList.remove('active');
    gameState.hoveredTerminal = null;
  }
}

function checkInteraction() {
  if (gameState.hoveredTerminal) {
    openTerminal(gameState.hoveredTerminal);
  }
}

function openTerminal(data) {
  gameState.isInteracting = true;
  playSound('beep');

  // Track visited
  gameState.visitedTerminals.add(data.id);
  document.getElementById('terminals-count').innerText = `${gameState.visitedTerminals.size}/7`;

  // UI Updates
  document.getElementById('terminal-title').innerText = data.title;
  
  // Hide all contents, show target
  document.querySelectorAll('.terminal-body > div').forEach(el => el.style.display = 'none');
  const targetContent = document.getElementById(`content-${data.id}`);
  if(targetContent) targetContent.style.display = 'block';

  // Animate Terminal Overlay in
  gsap.to("#terminal-overlay", { opacity: 1, duration: 0.3 });
  gsap.fromTo(".terminal-container", 
    { scale: 0.9, y: 50 }, 
    { scale: 1, y: 0, duration: 0.4, ease: "back.out(1.5)" }
  );
  
  // Animate internal contents if needed
  if (data.id === 'skills') {
    gsap.fromTo(".skill-item", 
      { opacity: 0, x: -20 }, 
      { opacity: 1, x: 0, stagger: 0.05, duration: 0.5, delay: 0.2 }
    );
  }
}

function closeTerminal() {
  playSound('beep');
  gsap.to("#terminal-overlay", { opacity: 0, duration: 0.3, onComplete: () => {
    gameState.isInteracting = false;
    checkMissionComplete();
  }});
  gsap.to(".terminal-container", { scale: 0.9, y: 50, duration: 0.3 });
}

function checkMissionComplete() {
  if (gameState.visitedTerminals.size === 7 && !gameState.missionCompleted) {
    gameState.missionCompleted = true;
    playSound('success');
    
    // Show Final Overlay
    gsap.to("#mission-complete", { opacity: 1, duration: 2, delay: 1, pointerEvents: 'auto' });
  }
}

// --- Animation Loop ---

function animate() {
  try {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();

    if (gameState.isBooted) {
      // Animate Model
      if (mixer) mixer.update(dt);

      if (gameState.particles) {
        gameState.particles.rotation.y += 0.05 * dt;

        // Gravitational Pull from Black Hole
        if (gameState.blackHoleGroup && !gameState.isDropping) {
          const positions = gameState.particles.geometry.attributes.position.array;
          const bhPos = new THREE.Vector3();
          gameState.blackHoleGroup.getWorldPosition(bhPos);

          for (let i = 0; i < positions.length; i += 3) {
            const dx = bhPos.x - positions[i];
            const dy = bhPos.y - positions[i + 1];
            const dz = bhPos.z - positions[i + 2];
            
            const distSq = dx*dx + dy*dy + dz*dz;
            
            // If within gravitational range
            if (distSq < 20000) {
              const dist = Math.sqrt(distSq);
              const force = 1500 / distSq; // Pull strength
              
              // Move particle towards black hole
              positions[i] += (dx / dist) * force;
              positions[i+1] += (dy / dist) * force;
              positions[i+2] += (dz / dist) * force;

              // If particle crosses event horizon, respawn it back in the room
              if (distSq < 500) {
                positions[i] = (Math.random() - 0.5) * 80;
                // Avoid spawning high in the sky during drop
                positions[i+1] = Math.random() * 20;
                positions[i+2] = (Math.random() - 0.5) * 80;
              }
            } else {
              // Standard ambient drift
              positions[i+1] += Math.sin(gameState.bobTime + i) * 0.01;
            }
          }
          gameState.particles.geometry.attributes.position.needsUpdate = true;
        }
      }

      if (gameState.skyGroup) {
        // Outer Grid
        gameState.skyGroup.children[0].rotation.y += 0.02 * dt;
        gameState.skyGroup.children[0].rotation.x += 0.01 * dt;
        // Inner Grid
        gameState.skyGroup.children[1].rotation.y -= 0.03 * dt;
        gameState.skyGroup.children[1].rotation.z += 0.015 * dt;
        // Stars
        gameState.skyGroup.children[2].rotation.y += 0.01 * dt;

        // Black Hole Animation
        if (gameState.blackHoleDisk && gameState.blackHoleGroup && !gameState.isDropping) {
          // Spin accretion disk rapidly
          gameState.blackHoleDisk.rotation.z -= 1.5 * dt;
          
          // Slowly orbit the black hole around the facility
          gameState.bhAngle += 0.05 * dt;
          gameState.blackHoleGroup.position.x = Math.cos(gameState.bhAngle) * 120;
          gameState.blackHoleGroup.position.z = Math.sin(gameState.bhAngle) * 120;
          // Bob up and down slightly
          gameState.blackHoleGroup.position.y = 80 + Math.sin(gameState.bhAngle * 2) * 20;
        }
      }

      // Animate Sky Extras
      if (gameState.planetaryRings) {
        gameState.planetaryRings.rotation.y += 0.05 * dt;
        gameState.planetaryRings.rotation.z += 0.02 * dt;
      }

      if (gameState.hubs) {
        gameState.hubs.forEach(hub => {
          hub.rotation.x += 0.1 * dt;
          hub.rotation.y += 0.15 * dt;
        });
      }

      if (gameState.satellites) {
        gameState.satellites.forEach(sat => {
          sat.userData.angle += 0.05 * dt;
          sat.position.x = Math.cos(sat.userData.angle) * sat.userData.radius;
          sat.position.z = Math.sin(sat.userData.angle) * sat.userData.radius;
          sat.position.y = sat.userData.height + Math.sin(sat.userData.angle * 2) * 10;
          // Look slightly ahead of center
          sat.lookAt(Math.cos(sat.userData.angle + 0.5) * 20, 0, Math.sin(sat.userData.angle + 0.5) * 20);
        });
      }

      if (gameState.meteors) {
        gameState.meteors.forEach(meteor => {
          if (!meteor.userData.active) {
            if (Math.random() < 0.01) { // 1% chance per frame to shoot
              meteor.userData.active = true;
              meteor.position.set((Math.random() - 0.5) * 300, 100 + Math.random() * 50, (Math.random() - 0.5) * 300);
              meteor.lookAt(0, 0, 0); // Fly inward
              meteor.rotateY((Math.random() - 0.5) * 0.5); // Add variance
            }
          } else {
            meteor.translateZ(-meteor.userData.speed * dt); // Move forward along local -Z
            if (meteor.position.y < -50 || meteor.position.length() > 400) {
              meteor.userData.active = false;
              meteor.position.set(0, -1000, 0); // hide
            }
          }
        });
      }

      if (gameState.auroras) {
        gameState.auroras.forEach((aurora, index) => {
          const positions = aurora.geometry.attributes.position.array;
          const orig = aurora.userData.vertices;
          for (let i = 0; i < positions.length / 3; i++) {
            const x = orig[i*3];
            const wave = Math.sin(x * 0.05 + gameState.bobTime + aurora.userData.offset) * 10;
            const wave2 = Math.cos(x * 0.02 + gameState.bobTime * 0.5) * 5;
            positions[i*3 + 1] = orig[i*3 + 1] + wave + wave2;
          }
          aurora.geometry.attributes.position.needsUpdate = true;
        });
      }

      // Animate NoC Hologram
      if (nocGroup) {
        nocGroup.rotation.y += 0.2 * dt;
        
        nocPackets.forEach((packet, i) => {
          packet.userData.angle += packet.userData.speed * dt;
          packet.position.x = Math.cos(packet.userData.angle) * packet.userData.radius;
          packet.position.z = Math.sin(packet.userData.angle) * packet.userData.radius;
          packet.position.y = Math.sin(packet.userData.angle * 3 + i) * 0.5;
        });
      }

      // Update HTML Markers
      terminals.forEach(t => {
        if (t.userData.markerEl && t.userData.markerPos) {
          const vector = t.userData.markerPos.clone();
          vector.project(camera);
          
          if (vector.z > 1) { // Behind camera
            t.userData.markerEl.style.display = 'none';
          } else {
            t.userData.markerEl.style.display = 'block';
            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (vector.y * -0.5 + 0.5) * window.innerHeight;
            t.userData.markerEl.style.left = `${x}px`;
            t.userData.markerEl.style.top = `${y}px`;
          }
        }
      });

      updateMovement();

      // Camera Shake Logic (Impact Effect)
      if (gameState.shakeAmount > 0) {
        // Apply roll and pitch shake AFTER lookAt is called by updateMovement
        camera.rotation.z += (Math.random() - 0.5) * gameState.shakeAmount * 0.5;
        camera.rotation.x += (Math.random() - 0.5) * gameState.shakeAmount * 0.2;
        
        gameState.shakeAmount *= 0.9; // Slower decay
        if (gameState.shakeAmount < 0.01) gameState.shakeAmount = 0;
      }

      // Animate Warp Tunnel during drop
      if (gameState.warpTunnel && gameState.isDropping) {
        // Tunnel rushes up past the camera
        gameState.warpTunnel.position.y += 150 * dt; // Faster!
        gameState.warpTunnel.rotation.y += 3 * dt;   
        if (gameState.warpTunnel.position.y > 150) {
          gameState.warpTunnel.position.y = -150;
        }
      }

      // Animate Floor Pulses
      if (gameState.pulses) {
        gameState.pulses.forEach(pulseData => {
          pulseData.progress += pulseData.speed * dt;
          if (pulseData.progress >= pulseData.totalLength) {
            pulseData.progress = 0; // Loop back to start
          }

          // Find current segment
          let isVisible = false;
          for(let i=0; i<pulseData.distances.length-1; i++) {
             if (pulseData.progress >= pulseData.distances[i] && pulseData.progress < pulseData.distances[i+1]) {
               isVisible = true;
               const segLength = pulseData.distances[i+1] - pulseData.distances[i];
               const segProgress = (pulseData.progress - pulseData.distances[i]) / segLength;
               
               const p1 = pulseData.points[i];
               const p2 = pulseData.points[i+1];
               pulseData.mesh.position.x = p1.x + (p2.x - p1.x) * segProgress;
               pulseData.mesh.position.z = p1.z + (p2.z - p1.z) * segProgress;
               break;
             }
          }
          pulseData.mesh.visible = isVisible;
        });
      }
    }

    renderer.render(scene, camera);
  } catch (e) {
    const errDiv = document.createElement('div');
    errDiv.style.position = 'fixed';
    errDiv.style.top = '150px';
    errDiv.style.left = '50px';
    errDiv.style.background = 'rgba(255,0,0,0.9)';
    errDiv.style.color = 'white';
    errDiv.style.zIndex = '9999';
    errDiv.style.padding = '20px';
    errDiv.style.fontFamily = 'monospace';
    errDiv.innerHTML = `<h2>ANIMATE CRASH</h2><p>${e.message}</p><p>${e.stack}</p>`;
    document.body.appendChild(errDiv);
    throw e; // Stop loop
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Init
window.onload = () => {
  init3D();
  runBootSequence();
};
