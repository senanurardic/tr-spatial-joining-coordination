let animationStarted = false;
let userNickname = "";
let map = null;
const markerInstances = {};

// ============================
// ANKARA KML GEOMETRY VERTICES
// ============================
const positions = {
    leftNode:  [32.845501, 39.921050], 
    rightNode: [32.858463, 39.923483], 
    mainNode:  [32.858746, 39.913890]  
};

const people = [
    { id: "leftNode", markerType: "grey-letter-dot", initial: "G" },
    { id: "rightNode", markerType: "grey-letter-dot", initial: "M" },
    { id: "mainNode", markerType: "blue-pulse-dot" }
];

function createMarkerElement(person) {
    const clusterEl = document.createElement("div");
    clusterEl.className = "marker-cluster";
    const agentEl = document.createElement("div");
    agentEl.className = "agent-node";

    if (person.markerType === "blue-pulse-dot") {
        const mapsDotContainer = document.createElement("div");
        mapsDotContainer.className = "google-maps-dot-container";
        const breathingPulse = document.createElement("div");
        breathingPulse.className = "google-maps-pulse";
        const solidCore = document.createElement("div");
        solidCore.className = "google-maps-core";
        mapsDotContainer.appendChild(breathingPulse);
        mapsDotContainer.appendChild(solidCore);
        agentEl.appendChild(mapsDotContainer);
        const labelEl = document.createElement("div");
        labelEl.className = "agent-label";
        labelEl.textContent = userNickname || "User";
        agentEl.appendChild(labelEl);
    } 
    else if (person.markerType === "grey-letter-dot") {
        const greyDot = document.createElement("div");
        greyDot.className = "experimental-grey-letter-dot";
        greyDot.textContent = person.initial;
        agentEl.appendChild(greyDot);
    }
    clusterEl.appendChild(agentEl);
    return clusterEl;
}

function initMarkers() {
    if (!map) return;
    people.forEach(person => {
        const marker = new maplibregl.Marker({ element: createMarkerElement(person), anchor: "center" })
        .setLngLat(positions[person.id])
        .addTo(map);
        markerInstances[person.id] = marker;
    });
}

// ============================
// TIMED LINEAR INTERPOLATION ENGINE (CONDITION 2 - SYNCHRONIZED OUT-AND-BACK)
// ============================
const PRE_SEQUENCE_DURATION     = 12 * 1000; // 0 - 12s: Standardized neutral baseline phase
const PAUSE_DURATION            = 4 * 1000;  // 12 - 16s: Pause phase
const APPROACH_DURATION         = 12 * 1000; // 16 - 28s: Movement towards each other (joining)
const COORDINATED_MOVE_DURATION = 12 * 1000; // 28 - 40s: Out-and-back joint movement phase
const TOTAL_ANIMATION_DURATION  = PRE_SEQUENCE_DURATION + PAUSE_DURATION + APPROACH_DURATION + COORDINATED_MOVE_DURATION; // 40s Total

let startTime = null;

const startG = positions.leftNode;
const startM = positions.rightNode;
const startMain = positions.mainNode;

// Target calculation for meeting point
const midLng = (startG[0] + startM[0]) / 2;
const midLat = (startG[1] + startM[1]) / 2; 
const offsetPercent = 0.04; 
const deltaLng = startM[0] - startG[0];
const deltaLat = startM[1] - startG[1];

const targetG = [midLng - (deltaLng * offsetPercent), midLat - (deltaLat * offsetPercent)];
const targetM = [midLng + (deltaLng * offsetPercent), midLat + (deltaLat * offsetPercent)];

// Direction vector for joint out-and-back movement (moving together towards east/north-east and returning)
const jointOffsetLng = 0.0020;
const jointOffsetLat = 0.0015;

const BASELINE_DRIFT_RADIUS = 0.0005;

function animateNodes(timestamp) {
    if (!animationStarted) return;
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    let currentG_Lng = startG[0]; 
    let currentG_Lat = startG[1];
    let currentM_Lng = startM[0]; 
    let currentM_Lat = startM[1];

    // Static drift endpoint coordinates at t = 12s (used as anchor for smooth transitions)
    const driftG_X_end = Math.sin(PRE_SEQUENCE_DURATION / 1800) * BASELINE_DRIFT_RADIUS;
    const driftG_Y_end = Math.cos(PRE_SEQUENCE_DURATION / 2700) * (BASELINE_DRIFT_RADIUS * 0.8);
    const driftM_X_end = Math.cos(PRE_SEQUENCE_DURATION / 2200) * BASELINE_DRIFT_RADIUS;
    const driftM_Y_end = Math.sin(PRE_SEQUENCE_DURATION / 3100) * (BASELINE_DRIFT_RADIUS * 0.8);

    const pausedG = [startG[0] + driftG_X_end, startG[1] + driftG_Y_end];
    const pausedM = [startM[0] + driftM_X_end, startM[1] + driftM_Y_end];

    if (elapsed < PRE_SEQUENCE_DURATION) {
        // =========================================================================
        // PHASE 1: STANDARDIZED NEUTRAL BASELINE PHASE (0s - 12s)
        // =========================================================================
        const driftG_X = Math.sin(elapsed / 1800) * BASELINE_DRIFT_RADIUS;
        const driftG_Y = Math.cos(elapsed / 2700) * (BASELINE_DRIFT_RADIUS * 0.8);
        const driftM_X = Math.cos(elapsed / 2200) * BASELINE_DRIFT_RADIUS;
        const driftM_Y = Math.sin(elapsed / 3100) * (BASELINE_DRIFT_RADIUS * 0.8);

        currentG_Lng = startG[0] + driftG_X;
        currentG_Lat = startG[1] + driftG_Y;
        currentM_Lng = startM[0] + driftM_X;
        currentM_Lat = startM[1] + driftM_Y;

    } else if (elapsed < (PRE_SEQUENCE_DURATION + PAUSE_DURATION)) {
        // =========================================================================
        // PHASE 2: PAUSE PHASE (12s - 16s)
        // =========================================================================
        currentG_Lng = pausedG[0];
        currentG_Lat = pausedG[1];
        currentM_Lng = pausedM[0];
        currentM_Lat = pausedM[1];

    } else if (elapsed < (PRE_SEQUENCE_DURATION + PAUSE_DURATION + APPROACH_DURATION)) {
        // =========================================================================
        // PHASE 3: APPROACH / JOINING PHASE (16s - 28s)
        // =========================================================================
        const approachElapsed = elapsed - (PRE_SEQUENCE_DURATION + PAUSE_DURATION);
        const progress = approachElapsed / APPROACH_DURATION;

        currentG_Lng = pausedG[0] + (targetG[0] - pausedG[0]) * progress;
        currentG_Lat = pausedG[1] + (targetG[1] - pausedG[1]) * progress;
        currentM_Lng = pausedM[0] + (targetM[0] - pausedM[0]) * progress;
        currentM_Lat = pausedM[1] + (targetM[1] - pausedM[1]) * progress;

    } else {
        // =========================================================================
        // PHASE 4: SYNCHRONIZED OUT-AND-BACK MOVEMENT (28s - 40s)
        // =========================================================================
        // Both agents move together in the exact same direction and return to the meeting point, 
        // using a triangle wave function to guarantee identical speed, displacement, and duration.
        const coordElapsed = elapsed - (PRE_SEQUENCE_DURATION + PAUSE_DURATION + APPROACH_DURATION);
        const progressCoord = coordElapsed / COORDINATED_MOVE_DURATION;
        
        // Triangle wave: goes from 0 to 1 (at halfway, t=6s) and back to 0 (at t=12s)
        const triangleWave = progressCoord <= 0.5 ? (progressCoord * 2) : (2 - progressCoord * 2);

        currentG_Lng = targetG[0] + (jointOffsetLng * triangleWave);
        currentG_Lat = targetG[1] + (jointOffsetLat * triangleWave);
        currentM_Lng = targetM[0] + (jointOffsetLng * triangleWave);
        currentM_Lat = targetM[1] + (jointOffsetLat * triangleWave);
    }

    if (markerInstances["leftNode"]) markerInstances["leftNode"].setLngLat([currentG_Lng, currentG_Lat]);
    if (markerInstances["rightNode"]) markerInstances["rightNode"].setLngLat([currentM_Lng, currentM_Lat]);

    if (elapsed < TOTAL_ANIMATION_DURATION) {
        requestAnimationFrame(animateNodes);
    } else {
        setTimeout(() => {
            if (window.parent) {
                window.parent.postMessage("mapAnimationFinished", "*");
            }
        }, 1000); 
    }
}

// ============================
// EXPERIMENT FLOW ENGINE
// ============================
const flowScreen = document.getElementById("experiment-flow-screen");
const stepConnecting = document.getElementById("step-connecting");
const stepWaiting = document.getElementById("step-waiting");
const stepJoined = document.getElementById("step-joined");
const stepNickname = document.getElementById("step-nickname");
const nicknameInput = document.getElementById("nickname-input");
const submitBtn = document.getElementById("submit-btn");

function startExperimentFlow() {
    setTimeout(() => {
        if (stepConnecting) stepConnecting.classList.add("hidden");
        if (stepWaiting) stepWaiting.classList.remove("hidden");
        setTimeout(() => {
            if (stepWaiting) stepWaiting.classList.add("hidden");
            if (stepJoined) stepJoined.classList.remove("hidden");
            setTimeout(() => {
                if (stepJoined) stepJoined.classList.add("hidden");
                if (stepNickname) stepNickname.classList.remove("hidden");
                if (nicknameInput) nicknameInput.focus();
            }, 3000);
        }, 5000);
    }, 3000);
}

function handleLoginSubmit() {
    const val = nicknameInput ? nicknameInput.value.trim() : "User";
    if (val === "") { alert("Please enter a valid nickname."); return; }
    userNickname = val;
    if (flowScreen) {
        flowScreen.style.opacity = "0";
        flowScreen.style.transform = "scale(0.95)";
    }
    setTimeout(() => {
        if (flowScreen) flowScreen.style.display = "none";
        initMarkers();
        animationStarted = true;
        requestAnimationFrame(animateNodes);
    }, 500);
}

if (submitBtn) submitBtn.addEventListener("click", handleLoginSubmit);
if (nicknameInput) {
    nicknameInput.addEventListener("keypress", (e) => { if (e.key === "Enter") handleLoginSubmit(); });
}

// ============================
// FAIL-SAFE INITIALIZATION BLOCK
// ============================
startExperimentFlow();

try {
    if (typeof maplibregl !== 'undefined') {
        map = new maplibregl.Map({
            container: 'map',
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: [32.8540, 39.9195], 
            zoom: 13.6,                
            minZoom: 13.6,             
            maxZoom: 13.6,             
            dragPan: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoomRotate: false,    
            pixelRatio: window.devicePixelRatio || 2 
        });

        map.on('load', () => {
            map.getCanvas().style.filter = 'grayscale(0.6) contrast(1.1) brightness(0.95) hue-rotate(25deg)';
        });
    } else {
        console.warn("MapLibre CDN library failed to load, but the experimental interface continues running.");
    }
} catch (error) {
    console.error("Map initialization failed:", error);
}