
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e5df);

const hemiLight = new THREE.HemisphereLight(0xf4e9d8, 0x2f3a43, 0.45);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0xfff0d7, 0.12);
scene.add(ambientLight);

scene.fog = new THREE.Fog(0xe9e5df, 1.5, 45);

const sun = new THREE.DirectionalLight(0xfff1e0, 0.95);
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

const fillLight = new THREE.PointLight(0xffe8cc, 4.2, 14, 2);
fillLight.position.set(3.2, 2, -2.4);
fillLight.castShadow = false;
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x8fb1ff, 1.1, 17, 2);
rimLight.position.set(-3.2, 2, 2.8);
rimLight.castShadow = false;
scene.add(rimLight);

const DEFAULT_FOV = 28;
const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(3.5, 1.8, -3.5);
camera.lookAt(0, 0, 0);


// Cél: ne legyen több, mint kb. 1.3 millió ténylegesen renderelt pixel
// (ez a szám finomhangolható — kísérletezz vele a te jelenetedhez)
const MAX_RENDER_PIXELS = 1_300_000;

function computeAdaptivePixelRatio(basePixelRatio) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const requestedPixels = width * height * basePixelRatio * basePixelRatio;

    if (requestedPixels <= MAX_RENDER_PIXELS) {
        return basePixelRatio; // belefér a büdzsébe, mehet az eredeti érték
    }

    // Ha túllépné a büdzsét, arányosan csökkentjük a pixelRatio-t
    const scale = Math.sqrt(MAX_RENDER_PIXELS / (width * height));
    return Math.max(0.6, scale); // ne menjünk 0.6 alá, az már túl elmosódott lenne
}

// Egyszeri, indításkori döntés — eszköz alapján, NEM futásidejű FPS alapján
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// Csak akkor jelöljük "gyengének", ha az API ténylegesen visszaigazolja —
// ha nem elérhető, ne feltételezzünk semmi rosszat
const lowMemory = navigator.deviceMemory ? navigator.deviceMemory <= 2 : false;
const lowCoreCount = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 2 : false;
const isLowEndDevice = lowMemory || lowCoreCount; // csak akkor igaz, ha van konkrét adat rá

const profile = isLowEndDevice
    ? { pixelRatio: 1.0, antialias: false, shadows: false, shadowMapSize: 512, exposure: 1.0 }
    : isMobile
        ? { pixelRatio: 1.15, antialias: true, shadows: true, shadowMapSize: 1024, exposure: 1.05 }
        : { pixelRatio: Math.min(window.devicePixelRatio || 1, 1.75), antialias: true, shadows: true, shadowMapSize: 1024, exposure: 1.12 };

// Felülírjuk a pixelRatio-t a TÉNYLEGES viewport-méret alapján, eszköz-kategóriától függetlenül
profile.pixelRatio = computeAdaptivePixelRatio(profile.pixelRatio);

const canvas = document.querySelector("#bg");
const container = canvas?.parentElement || document.body;
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: profile.antialias,
    alpha: false,
    powerPreference: isLowEndDevice ? 'low-power' : 'high-performance'
});
renderer.setPixelRatio(profile.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = profile.exposure;
renderer.shadowMap.enabled = profile.shadows;
renderer.shadowMap.type = profile.shadows
    ? (isLowEndDevice ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap)
    : THREE.BasicShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

profile.shadows = false;

sun.castShadow = profile.shadows;
sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
sun.shadow.camera.updateProjectionMatrix();


const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath(import.meta.env.BASE_URL + 'basis/');
ktx2Loader.detectSupport(renderer);
const loader = new GLTFLoader();
loader.setKTX2Loader(ktx2Loader);

// ===== KIEGÉSZÍTŐ FÉNYEK =====
const fpsOverlay = document.createElement("div");
fpsOverlay.className = "fps-overlay";
fpsOverlay.textContent = "FPS: --";
document.body.appendChild(fpsOverlay);

let fpsFrames = 0;
let fpsLastUpdate = performance.now();
let shadowDirty = true;
let lastShadowUpdate = 0;

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

    const interval = isLowEndDevice ? 240 : 140;
    if (shadowDirty && (now - lastShadowUpdate >= interval || lastShadowUpdate === 0)) {
        renderer.shadowMap.needsUpdate = true;
        lastShadowUpdate = now;
        shadowDirty = false;
    }
}

 //GUI fényeléshez
/*



const gui = new GUI();

const sunFolder = gui.addFolder('Sun');
sunFolder.add(sun.position, 'x', -10, 10, 0.1);
sunFolder.add(sun.position, 'y', -10, 10, 0.1);
sunFolder.add(sun.position, 'z', -10, 10, 0.1);
sunFolder.add(sun, 'intensity', 0, 10, 0.1);

pointLights.forEach((pl, i) => {
    const f = gui.addFolder(`PointLight ${i}`);
    f.add(pl.position, 'x', -8, 8, 0.1);
    f.add(pl.position, 'y', -8, 8, 0.1);
    f.add(pl.position, 'z', -8, 8, 0.1);
    f.add(pl, 'intensity', 0, 15, 0.1);
});

rectLights.forEach((rl, i) => {
    const f = gui.addFolder(`RectLight ${i}`);
    f.add(rl.position, 'x', -8, 8, 0.1);
    f.add(rl.position, 'y', -8, 8, 0.1);
    f.add(rl.position, 'z', -8, 8, 0.1);
    f.add(rl.rotation, 'x', -Math.PI, Math.PI, 0.01);
    f.add(rl.rotation, 'y', -Math.PI, Math.PI, 0.01);
    f.add(rl, 'intensity', 0, 20, 0.1);
    f.add(rl, 'width', 0.1, 5, 0.1);
    f.add(rl, 'height', 0.1, 5, 0.1);
});

*/

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
        isLowEndDevice ? 1.0 : isMobile ? 1.15 : Math.min(window.devicePixelRatio || 1, 1.75)
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

        // "Mozgásban van" akkor, ha a rotáció/pozíció ténylegesen, érdemben változott
        isMoving = autoRotate || dragging || yDiff > 0.0001 || rotDiff > 0.0001;
    }

    if (isMoving) {
        // Mozgás közben MINDEN frame-ben friss árnyék kell
        renderer.shadowMap.needsUpdate = true;
    } else {
        // Csak álló helyzetben engedjük a ritkított/egyszeri frissítést
        updateShadowMap(performance.now());
    }

    renderer.render(scene, camera);
    updateFpsDisplay(performance.now());
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
//// háttér legyen fényesebb
