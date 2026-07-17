// ============================
// CALIBRATED MAP CONFIGURATION (ZOOM: 13.6 & CENTER REALIGNED)
// ============================
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    // Optimized center coordinates for averaging the triangle corners of the scene
    center: [32.8540, 39.9195], 
    zoom: 13.6,                
    minZoom: 13.6,             
    maxZoom: 13.6,             
    
    // EXPERIMENTAL CONTROLS: FIXED VIEWPORT MATRIX
    dragPan: false,            
    doubleClickZoom: false,    
    boxZoom: false,            
    keyboard: false,           
    touchZoomRotate: false,    
    
    pixelRatio: window.devicePixelRatio || 2 
});

// ============================
// ORIGINAL KML GEOMETRY VERTICES (triangle corners of the scene)
// ============================
const positions = {
    leftNode:  [32.845501, 39.921050], // G Actor - Left Top Corner
    rightNode: [32.858463, 39.923483], // M Actor - Right Top Corner
    mainNode:  [32.858746, 39.913890]  // Main Actor - Bottom Corner
};

// ============================
// EXPERIMENT SUBJECTS CONFIGURATION
// ============================
const people = [
    { id: "leftNode", markerType: "grey-letter-dot", initial: "G" },
    { id: "rightNode", markerType: "grey-letter-dot", initial: "M" },
    { id: "mainNode", markerType: "blue-pulse-dot" }
];

// ============================
// MARKER RENDER ENGINE
// ============================
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

const markerInstances = {};

function initMarkers() {
    people.forEach(person => {
        const marker = new maplibregl.Marker({
            element: createMarkerElement(person),
            anchor: "center"
        })
        .setLngLat(positions[person.id])
        .addTo(map);

        markerInstances[person.id] = marker;
    });
}

initMarkers();

// ============================
// TIMED LINEAR INTERPOLATION ENGINE
// ============================
const DELAY_DURATION = 5 * 1000;       // 5 seconds stable
const MOVE_DURATION = 25 * 1000;      // 25 seconds linear movement
let startTime = null;

const startG = positions.leftNode;
const startM = positions.rightNode;

// Top corners' midpoint (Meeting axis)
const midLng = (startG[0] + startM[0]) / 2;
const midLat = (startG[1] + startM[1]) / 2; 

// Buffer to prevent overlapping when two actors come side by side
const offsetPercent = 0.04; 
const deltaLng = startM[0] - startG[0];
const deltaLat = startM[1] - startG[1];

const targetG = [midLng - (deltaLng * offsetPercent), midLat - (deltaLat * offsetPercent)];
const targetM = [midLng + (deltaLng * offsetPercent), midLat + (deltaLat * offsetPercent)];

function animateNodes(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    let progress = 0;

    if (elapsed < DELAY_DURATION) {
        progress = 0;
    } else {
        const moveElapsed = elapsed - DELAY_DURATION;
        progress = Math.min(moveElapsed / MOVE_DURATION, 1);
    }

    // Corners to the midpoint (Meeting axis) LERP (Linear Interpolation) calculation
    const currentG_Lng = startG[0] + (targetG[0] - startG[0]) * progress;
    const currentG_Lat = startG[1] + (targetG[1] - startG[1]) * progress;

    const currentM_Lng = startM[0] + (targetM[0] - startM[0]) * progress;
    const currentM_Lat = startM[1] + (targetM[1] - startM[1]) * progress;

    if (markerInstances["leftNode"]) {
        markerInstances["leftNode"].setLngLat([currentG_Lng, currentG_Lat]);
    }
    if (markerInstances["rightNode"]) {
        markerInstances["rightNode"].setLngLat([currentM_Lng, currentM_Lat]);
    }

    if (elapsed < (DELAY_DURATION + MOVE_DURATION)) {
        requestAnimationFrame(animateNodes);
    }
}

map.on('load', () => {
    const mapCanvas = map.getCanvas();
    if (mapCanvas) {
        mapCanvas.style.filter = 'grayscale(0.6) contrast(1.1) brightness(0.95) hue-rotate(25deg)';
    }
    requestAnimationFrame(animateNodes);
});