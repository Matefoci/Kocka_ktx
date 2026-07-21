
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';


const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf9f7f4);
scene.fog = new THREE.Fog(0xf9f7f4, 1.5, 45);


const sun = new THREE.DirectionalLight(0xfff1e0, 0.8);
sun.position.set(4.2, 6.2, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.00015;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 1.6;
sun.shadow.camera.left = -1.6;
sun.shadow.camera.right = 1.6;
sun.shadow.camera.top = 1.6;
sun.shadow.camera.bottom = -1.6;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 20;
scene.add(sun);


const DEFAULT_FOV = 28;
const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(3.5, 1.8, -3.5);
camera.lookAt(0, 0, 0);


function computeAdaptivePixelRatio(basePixelRatio, maxRenderPixels, minPixelRatio) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const requestedPixels = width * height * basePixelRatio * basePixelRatio;

    if (requestedPixels <= maxRenderPixels) return basePixelRatio;

    const scale = Math.sqrt(maxRenderPixels / (width * height));
    return Math.max(minPixelRatio, scale);
}

// 1. Eszköz típusának precízebb azonosítása
const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+ trükk
const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
const isTablet = /iPad|tablet|playbook|silk/i.test(ua) || (isMobileUA && !/Mobile/i.test(ua)) || (isIOS && !/iPhone/i.test(ua));
const isPhone = isMobileUA && !isTablet;

// 2. Hardveres adatok biztonságos lekérése (Fallback-ekkel)
const cores = navigator.hardwareConcurrency || (isIOS ? 4 : 2); // iOS ad magokat, de ha mégsem, feltételezzük a középkategóriát
// iOS nem ad memóriát, így ha undefined, a magok számából tippelünk (ha >=6 magos Apple chip, valószínűleg van 4GB+ RAM)
const memory = navigator.deviceMemory || (isIOS && cores >= 6 ? 4 : 2); 


const dpr = window.devicePixelRatio || 1;

// 3. Többszintű (Tier) kategóriarendszer felállítása
// -1 = Emergency, 0 = Low, 1 = Mid, 2 = High
let tier = 2;

const emergencyDevice =
    memory <= 1 ||
    cores <= 2 ||
    (memory <= 2 && cores <= 2);

if (emergencyDevice) {
    tier = -1;
} else if (memory <= 2 || cores <= 2) {
    tier = 0;
} else if (memory <= 4 || cores <= 4) {
    tier = 1;
}

// Tabletek "leminősítése": a nagy képernyő miatt a Mid-tier beállítások biztonságosabbak számukra
if (isTablet && tier === 2) tier = 1;



const tierNames = {
    [-1]: 'EMERGENCY',
    0: 'LOW',
    1: 'MID',
    2: 'HIGH',
};

// 5. Grafikai profilok dedikálása a szintekhez
const profiles = {
    [-1]: { // EMERGENCY TIER
        pixelRatio: Math.min(dpr, 0.8),
        minPixelRatio: 0.55,
        antialias: true,
        shadows: true,
        shadowMapSize: 256,
        shadowType: THREE.PCFShadowMap,
        exposure: 0.98,
        power: 'low-power',
        renderPixelBudget: 800_000,
        shadowUpdateInterval: 320,
    },
    0: { // LOW TIER
        pixelRatio: Math.min(dpr, 0.9),
        minPixelRatio: 0.65,
        antialias: true,
        shadows: true,
        shadowMapSize: 384,
        shadowType: THREE.PCFShadowMap,
        exposure: 1.0,
        power: 'low-power',
        renderPixelBudget: 900_000,
        shadowUpdateInterval: 240,
    },
    1: { // MID TIER (Tabletek, átlagos mobilok)
        pixelRatio: Math.min(dpr, 1.3),
        minPixelRatio: 0.75,
        antialias: true,
        shadows: true,
        shadowMapSize: 512,
        shadowType: THREE.PCFShadowMap,
        exposure: 1.05,
        power: 'default',
        renderPixelBudget: 1_300_000,
        shadowUpdateInterval: 140,
        
    },
    2: {
        // HIGH TIER (Erős asztali gépek)
        pixelRatio: Math.min(dpr, 1.6),
        minPixelRatio: 0.85,
        antialias: true,
        shadows: true,
        shadowMapSize: 1024,
        shadowType: THREE.PCFShadowMap,
        exposure: 1.12,
        power: 'high-performance',
        renderPixelBudget: 1_800_000,
        shadowUpdateInterval: 100,
       
    }
};

const profile = profiles[tier];

// Költségvetés-ellenőrzés
profile.pixelRatio = computeAdaptivePixelRatio(
    profile.pixelRatio,
    profile.renderPixelBudget,
    profile.minPixelRatio
);

// Renderer inicializálása
const canvas = document.querySelector("#bg");
const container = canvas?.parentElement || document.body;
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: profile.antialias,
    alpha: false,
    powerPreference: profile.power
});

renderer.setPixelRatio(profile.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = profile.exposure;

if (profile.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = profile.shadowType;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
} else {
    renderer.shadowMap.enabled = false;
}


sun.castShadow = profile.shadows;
sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
sun.shadow.radius = tier <= 0 ? 0.8 : 1.6;
sun.shadow.camera.updateProjectionMatrix();


const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath(import.meta.env.BASE_URL + 'basis/');
//ktx2Loader.setTranscoderPath('https://unpkg.com/three/examples/jsm/libs/basis/');
ktx2Loader.detectSupport(renderer);
const loader = new GLTFLoader();
loader.setKTX2Loader(ktx2Loader);


// ----- Debug overlay -----
const fpsOverlay = document.createElement("div");
fpsOverlay.className = "fps-overlay";
fpsOverlay.textContent = "FPS: --";
document.body.appendChild(fpsOverlay);
const debugOverlay = document.createElement("div");
debugOverlay.className = "fps-overlay";
debugOverlay.style.top = "60px";
debugOverlay.style.fontSize = "11px";
debugOverlay.style.whiteSpace = "pre-line";
debugOverlay.textContent = `
Tier: ${tier} (${tierNames[tier]})
Device: ${isIOS ? 'iOS' : isPhone ? 'Phone' : isTablet ? 'Tablet' : 'Desktop'}
Cores: ${cores} | Memory: ${memory}GB
DPR: ${dpr.toFixed(2)} | PixelRatio: ${profile.pixelRatio.toFixed(2)}
Antialias: ${profile.antialias} | Shadows: ${profile.shadows}
ShadowMapSize: ${profile.shadowMapSize} | Power: ${profile.power}
`.trim();
document.body.appendChild(debugOverlay);

let fpsFrames = 0;
let fpsLastUpdate = performance.now();
let shadowDirty = true;
let lastShadowUpdate = 0;
let lastRenderTime = 0;

function updateFpsDisplay(now) {
    fpsFrames += 1;
    if (now - fpsLastUpdate < 300) return;
    const fps = (fpsFrames * 1000) / (now - fpsLastUpdate);
    fpsOverlay.textContent = `FPS: ${Math.round(fps)}`;
    fpsFrames = 0;
    fpsLastUpdate = now;
}

function requestShadowUpdate() {
    shadowDirty = true;
}

function updateShadowMap(now) {
    if (!profile.shadows) return;

    const interval = profile.shadowUpdateInterval;
    if (shadowDirty && (now - lastShadowUpdate >= interval || lastShadowUpdate === 0)) {
        renderer.shadowMap.needsUpdate = true;
        lastShadowUpdate = now;
        shadowDirty = false;
    }
}
// ===== POINT LIGHTS — eredeti 3 =====
const pointLightConfigs = [
    { pos: [3, 1.1, -2.2],   color: 0xffe8cc, intensity: 6 },
    { pos: [3, 1.5, -2],   color: 0xffe8cc, intensity: 3 },
    { pos: [0, 0.1, -3.2],     color: 0xfff4e6, intensity: 4 },
];

const pointLights = pointLightConfigs.map(cfg => {
    const pl = new THREE.PointLight(cfg.color, cfg.intensity, 15, 2);
    pl.position.set(...cfg.pos);
    pl.castShadow = false;
    scene.add(pl);
    return pl;
});

// ===== POINT LIGHTS — a RectAreaLight-ok kiváltására =====
const rectReplacementConfigs = [
    { pos: [-0.5, 2.2, 0.6], color: 0xffffff, intensity: 3.0, distance: 8 },
    { pos: [-1.3, 2.4, 1.6], color: 0xffe8d0, intensity: 3.5, distance: 9 },
    { pos: [1.7, 1.9, 1.0], color: 0xffe8d0, intensity: 2.8, distance: 8 },
];

const rectReplacementLights = rectReplacementConfigs.map(cfg => {
    const pl = new THREE.PointLight(cfg.color, cfg.intensity, cfg.distance, 2);
    pl.position.set(...cfg.pos);
    pl.castShadow = false;
    scene.add(pl);
    return pl;
});


// gizmo

let gizmoGroup;
let axis;

function createRotationGizmo(target){

    gizmoGroup = new THREE.Group();
    target.add(gizmoGroup);


    // Tengely
    axis = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.2, 32),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    axis.position.set(0, 2.6, 0);
    axis.castShadow = false;
    axis.receiveShadow = false;
    gizmoGroup.add(axis);


}


// Loader

let cubeStructure = null;
let plane = null;
let nyil = null;

let dragging = false;
let previousX = 0;
let autoRotate = true;
const mouse = new THREE.Vector2();


function applyWoodMaterial(root, tintColor = null, roughnessOverride = null, aoIntensity = 1.0) {
    root.traverse((child) => {
        if (!child.isMesh) return;

        const materials = Array.isArray(child.material) ? child.material : [child.material];

        materials.forEach((mat) => {
            if (mat.map) {
                mat.map.colorSpace = THREE.SRGBColorSpace;
            }

            if (tintColor) {
                mat.color.set(tintColor);
            }

            mat.roughness = roughnessOverride ?? 0.55;
            mat.metalness = 0.0;
            mat.envMapIntensity = 0.12;

            if (mat.aoMap) {
                mat.aoMapIntensity = aoIntensity;

                if (child.geometry && !child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
                    child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
                }
            }

            mat.needsUpdate = true;
        });

        child.castShadow = true;
        child.receiveShadow = true;
    });
}



const LIFT_HEIGHT = 0.1;
const LIFT_SPEED = 0.05;
let baseY = 0;

const modelUrls = [
    /*
    new URL('./models/fKisMeretKocka2.glb', import.meta.url).href,
    new URL('./models/PlaneMeret.glb', import.meta.url).href,
    new URL('./models/Nyil6.glb', import.meta.url).href,

    */

    new URL('./models/kocka-ktx2.glb', import.meta.url).href,
    new URL('./models/plane-ktx2.glb', import.meta.url).href,
    new URL('./models/Nyil6.glb', import.meta.url).href,
];


Promise.all([
    loader.loadAsync(modelUrls[0]),
    loader.loadAsync(modelUrls[1]),
    loader.loadAsync(modelUrls[2]),
]).then(([kockaGltf, planeGltf, nyilGltf]) => {

    // --- Kocka ---
    scene.add(kockaGltf.scene);
    applyWoodMaterial(kockaGltf.scene);
    cubeStructure = kockaGltf.scene.getObjectByName("KockaNoArray") || kockaGltf.scene;
    baseY = cubeStructure.position.y;
    createRotationGizmo(cubeStructure);
   

    // --- Plane ---
    scene.add(planeGltf.scene);
    applyWoodMaterial(planeGltf.scene, 0xe8dfd0, 0.85); //  0xe8c3b0  0xe8dfd0
    plane = planeGltf.scene.getObjectByName("Plane") || planeGltf.scene;
    plane.receiveShadow = true;
    requestShadowUpdate();


    // --- Nyíl ---
    nyil = nyilGltf.scene.getObjectByName("Nyil") || nyilGltf.scene;
    nyil.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = false;
        child.receiveShadow = false;
    });
    nyil.scale.setScalar(0.1);
    nyil.scale.y = 0.08;
    nyil.position.set(0, 2.8, -1);
    gizmoGroup.add(nyil); 
    nyil.rotation.z += Math.PI; 

    
    renderer.compile(scene, camera);
}).catch((error) => {
    console.error('A modellek betöltése sikertelen:', error);
});


function updateCameraProjection() {
    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    const aspect = width / height;

    renderer.setSize(width, height, false);

    const adaptivePixelRatio = computeAdaptivePixelRatio(
        profile.pixelRatio,
        profile.renderPixelBudget,
        profile.minPixelRatio
    );
    renderer.setPixelRatio(adaptivePixelRatio);


    camera.aspect = aspect;

    if (aspect < 1) {
        const radAngle = DEFAULT_FOV * Math.PI / 180;
        const vFovRad = 2 * Math.atan(Math.tan(radAngle / 2) / aspect);
        camera.fov = vFovRad * 180 / Math.PI;
    } else {
        camera.fov = DEFAULT_FOV;
    }

    camera.updateProjectionMatrix();
    requestShadowUpdate();
}

window.addEventListener("resize", updateCameraProjection);
updateCameraProjection();

// Animation

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();

    let isMoving = false;

    if (cubeStructure) {
        const previousY = cubeStructure.position.y;
        const previousRotation = cubeStructure.rotation.y;

        if (autoRotate) {
            cubeStructure.rotation.y += 0.002;
        }

        const targetY = dragging ? baseY + LIFT_HEIGHT : baseY;
        cubeStructure.position.y += (targetY - cubeStructure.position.y) * LIFT_SPEED;

        const yDiff = Math.abs(cubeStructure.position.y - previousY);
        const rotDiff = Math.abs(cubeStructure.rotation.y - previousRotation);

        isMoving = autoRotate || dragging || yDiff > 0.0001 || rotDiff > 0.0001;
    }

    if (isMoving) {
        // Mozgás közben MINDEN frame-ben friss árnyék kell
        renderer.shadowMap.needsUpdate = true;
    } else {
        // Csak álló helyzetben engedjük a ritkított/egyszeri frissítést
        updateShadowMap(now);
    }

    if (profile.shadowUpdateInterval > 0 && now - lastRenderTime < 1000 / 30 && tier === -1) {
        updateFpsDisplay(now);
        return;
    }

    lastRenderTime = now;
    renderer.render(scene, camera);
    updateFpsDisplay(now);
}

// esemenykezeles

window.addEventListener("mousedown", (e) => {

    if (!cubeStructure) return;

    dragging = true;
    previousX = e.clientX;

});

window.addEventListener("mouseup",()=>{

    dragging = false;

});


window.addEventListener("mousemove",(e)=>{

    if(!dragging) return;

     autoRotate = false;
    const delta = e.clientX - previousX;

    previousX = e.clientX;

    cubeStructure.rotation.y += delta * 0.004;

});

// esemenykezeles — touch (mobil)

window.addEventListener("touchstart", (e) => {


    if (!cubeStructure) return;

    autoRotate = false;
    dragging = true;
    previousX = e.touches[0].clientX;

}, { passive: true });

window.addEventListener("touchend", () => {

    dragging = false;

});

window.addEventListener("touchmove", (e) => {

    if (!dragging) return;

    const delta = e.touches[0].clientX - previousX;

    previousX = e.touches[0].clientX;

    cubeStructure.rotation.y += delta * 0.004;

}, { passive: true });


animate();
