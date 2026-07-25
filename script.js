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
// TIMED LINEAR INTERPOLATION ENGINE
// ============================
const PRE_SEQUENCE_DURATION = 12 * 1000; // STANDARDIZED: 12 seconds neutral baseline phase
const DELAY_DURATION = 5 * 1000;         // 5 seconds delay before condition-specific movement
const MOVE_DURATION = 15 * 1000;         // 15 seconds condition-specific movement phase (10s meet + 5s move away)
let startTime = null;

const startG = positions.leftNode;
const startM = positions.rightNode;
const startMain = positions.mainNode;

// Condition 2 Specific Target Calculations: Meeting behavior followed by northward departure
const midLng = (startG[0] + startM[0]) / 2;
const midLat = (startG[1] + startM[1]) / 2; 
const offsetPercent = 0.04; 
const deltaLng = startM[0] - startG[0];
const deltaLat = startM[1] - startG[1];

const targetG = [midLng - (deltaLng * offsetPercent), midLat - (deltaLat * offsetPercent)];
const targetM = [midLng + (deltaLng * offsetPercent), midLat + (deltaLat * offsetPercent)];
const northMoveStep = 0.0035; // Northward departure step for Condition 2 (Ostracism/Exclusion)

// ============================
// STANDARDIZED NEUTRAL BASELINE CONFIGURATION (0-12s)
// ============================
// This identical baseline configuration ensures strict experimental standardization across all conditions.
const BASELINE_DRIFT_RADIUS = 0.0005; // Small spatial boundary ensuring distance stability (approx. 40-50 meters)

function animateNodes(timestamp) {
    if (!animationStarted) return;
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    let currentG_Lng = startG[0]; let currentG_Lat = startG[1];
    let currentM_Lng = startM[0]; let currentM_Lat = startM[1];

    if (elapsed < PRE_SEQUENCE_DURATION) {
        // =========================================================================
        // STANDARDIZED NEUTRAL BASELINE PHASE (0 - 12 Seconds)
        // =========================================================================
        // - Asynchronous localized random drift around initial anchor coordinates.
        // - Identical across Condition 1, Condition 2, and Condition 3.
        // - Communicates ONLY live system activity without relational cues.
        // =========================================================================
        const driftG_X = Math.sin(elapsed / 1800) * BASELINE_DRIFT_RADIUS;
        const driftG_Y = Math.cos(elapsed / 2700) * (BASELINE_DRIFT_RADIUS * 0.8);
        
        const driftM_X = Math.cos(elapsed / 2200) * BASELINE_DRIFT_RADIUS;
        const driftM_Y = Math.sin(elapsed / 3100) * (BASELINE_DRIFT_RADIUS * 0.8);

        currentG_Lng = startG[0] + driftG_X;
        currentG_Lat = startG[1] + driftG_Y;
        currentM_Lng = startM[0] + driftM_X;
        currentM_Lat = startM[1] + driftM_Y;

    } else {
        // =========================================================================
        // CONDITION 2 SPECIFIC MANIPULATION PHASE (12s+ onwards)
        // =========================================================================
        const mainElapsed = elapsed - PRE_SEQUENCE_DURATION;
        if (mainElapsed < DELAY_DURATION) {
            // Retain the final position of the baseline drift during the 5-second waiting delay
            // to prevent visual snapping/teleportation before the main manipulation starts.
            const driftG_X = Math.sin(PRE_SEQUENCE_DURATION / 1800) * BASELINE_DRIFT_RADIUS;
            const driftG_Y = Math.cos(PRE_SEQUENCE_DURATION / 2700) * (BASELINE_DRIFT_RADIUS * 0.8);
            const driftM_X = Math.cos(PRE_SEQUENCE_DURATION / 2200) * BASELINE_DRIFT_RADIUS;
            const driftM_Y = Math.sin(PRE_SEQUENCE_DURATION / 3100) * (BASELINE_DRIFT_RADIUS * 0.8);

            currentG_Lng = startG[0] + driftG_X; 
            currentG_Lat = startG[1] + driftG_Y;
            currentM_Lng = startM[0] + driftM_X; 
            currentM_Lat = startM[1] + driftM_Y;
        } else {
            const moveElapsed = mainElapsed - DELAY_DURATION; 
            if (moveElapsed <= 10000) {
                // First 10 seconds of movement: Node G and Node M move toward each other to meet
                const progress = moveElapsed / 10000;
                currentG_Lng = startG[0] + (targetG[0] - startG[0]) * progress;
                currentG_Lat = startG[1] + (targetG[1] - startG[1]) * progress;
                currentM_Lng = startM[0] + (targetM[0] - startM[0]) * progress;
                currentM_Lat = startM[1] + (targetM[1] - startM[1]) * progress;
            } else {
                // Final 5 seconds of movement: Node G and Node M move northward together, away from the participant
                const northElapsed = moveElapsed - 10000; 
                const progressNorth = Math.min(northElapsed / 5000, 1);
                currentG_Lng = targetG[0];
                currentG_Lat = targetG[1] + (northMoveStep * progressNorth);
                currentM_Lng = targetM[0];
                currentM_Lat = targetM[1] + (northMoveStep * progressNorth);
            }
        }
    }

    if (markerInstances["leftNode"]) markerInstances["leftNode"].setLngLat([currentG_Lng, currentG_Lat]);
    if (markerInstances["rightNode"]) markerInstances["rightNode"].setLngLat([currentM_Lng, currentM_Lat]);

    if (elapsed < (PRE_SEQUENCE_DURATION + DELAY_DURATION + MOVE_DURATION)) {
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
// EXPERIMENT FLOW ENGINE (ORDER INDEPENDENT)
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
// 1. Immediately initiate the UI flow sequence independently of map rendering
startExperimentFlow();

// 2. Attempt map loading inside a protected try-catch block to prevent fatal script errors
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
    console.error("Map initialization failed (Security Shield or Network Error):", error);
}