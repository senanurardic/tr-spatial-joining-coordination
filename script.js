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

// ============================================================================
// SHARED CROSS-CONDITION MOVEMENT CONFIG
// Phase 3 (16–28s) speed already matches Joining and Control (corrected) here:
// each agent covers a distance equal to (0.5 – offsetPercent) of the actual G-M distance (≈524.06 m)
// in 12 seconds → ≈43.67 m/s. NO CHANGE IS REQUIRED under these conditions.
//
// Phase 4 (28–40 s) DECISION (finalized): The current magnitude (jointOffsetLng=0.0020,
// jointOffsetLat=0.0015) corresponds to a peak displacement of ≈238.8 m and a speed of ≈39.8 m/s
// velocity. This is significantly faster than the slow independent
// drift (~cm/s) in Phase 4 of Control/Joining — HOWEVER, this difference has been INTENTIONALLY
// PRESERVED: it is considered an operational/structural consequence of
// synchronous manipulation (synchronized/joint movement inherently requires greater
// joint displacement). THESE VALUES MUST NOT BE CHANGED.
// It is recommended to document this in the OSF pre-registration: “The higher speed in Phase 4 of the Coordination condition
// is an operational consequence of the synchrony manipulation; noted as a potential
// confound, it is planned to be measured separately via manipulation control
// (perceived synchrony vs. perceived speed/mobility).”
// ============================================================================
const SHARED_APPROACH_PHASE_DURATION_MS = 12000; // 16-28s penceresi, tüm koşullarda aynı

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
        labelEl.textContent = userNickname || "Kullanıcı";
        agentEl.appendChild(labelEl);
        agentEl.setAttribute("role", "img");
        agentEl.setAttribute("aria-label", (userNickname || "Kullanıcı") + " konumu, harita üzerinde");
    } 
    else if (person.markerType === "grey-letter-dot") {
        const greyDot = document.createElement("div");
        greyDot.className = "experimental-grey-letter-dot";
        greyDot.textContent = person.initial;
        agentEl.appendChild(greyDot);
        agentEl.setAttribute("role", "img");
        agentEl.setAttribute("aria-label", "Katılımcı " + person.initial + " konumu, harita üzerinde");
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
// TIMED LINEAR INTERPOLATION ENGINE (COORDINATION CONDITION - SYNCHRONIZED OUT-AND-BACK)
// ============================
const PRE_SEQUENCE_DURATION     = 12 * 1000; // 0 - 12s: Standardized neutral baseline phase
const PAUSE_DURATION            = 4 * 1000;  // 12 - 16s: Pause phase
const APPROACH_DURATION         = 12 * 1000; // 16 - 28s: Movement towards each other (joining)
const COORDINATED_MOVE_DURATION = 12 * 1000; // 28 - 40s: Out-and-back joint movement phase
const TOTAL_ANIMATION_DURATION  = PRE_SEQUENCE_DURATION + PAUSE_DURATION + APPROACH_DURATION + COORDINATED_MOVE_DURATION; // 40s Total
const FINAL_HOLD_DURATION       = 1000; // 40-41s: son karede bekleme

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
// PENDING: bu değerler Faz 4 hız kararına göre güncellenebilir.
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
        // PHASE 1: STANDARDIZED NEUTRAL BASELINE PHASE (0s - 12s)
        const driftG_X = Math.sin(elapsed / 1800) * BASELINE_DRIFT_RADIUS;
        const driftG_Y = Math.cos(elapsed / 2700) * (BASELINE_DRIFT_RADIUS * 0.8);
        const driftM_X = Math.cos(elapsed / 2200) * BASELINE_DRIFT_RADIUS;
        const driftM_Y = Math.sin(elapsed / 3100) * (BASELINE_DRIFT_RADIUS * 0.8);

        currentG_Lng = startG[0] + driftG_X;
        currentG_Lat = startG[1] + driftG_Y;
        currentM_Lng = startM[0] + driftM_X;
        currentM_Lat = startM[1] + driftM_Y;

    } else if (elapsed < (PRE_SEQUENCE_DURATION + PAUSE_DURATION)) {
        // PHASE 2: PAUSE PHASE (12s - 16s)
        currentG_Lng = pausedG[0];
        currentG_Lat = pausedG[1];
        currentM_Lng = pausedM[0];
        currentM_Lat = pausedM[1];

    } else if (elapsed < (PRE_SEQUENCE_DURATION + PAUSE_DURATION + APPROACH_DURATION)) {
        // PHASE 3: APPROACH / JOINING PHASE (16s - 28s)
        const approachElapsed = elapsed - (PRE_SEQUENCE_DURATION + PAUSE_DURATION);
        const progress = approachElapsed / APPROACH_DURATION;

        currentG_Lng = pausedG[0] + (targetG[0] - pausedG[0]) * progress;
        currentG_Lat = pausedG[1] + (targetG[1] - pausedG[1]) * progress;
        currentM_Lng = pausedM[0] + (targetM[0] - pausedM[0]) * progress;
        currentM_Lat = pausedM[1] + (targetM[1] - pausedM[1]) * progress;

    } else {
        // PHASE 4: SYNCHRONIZED OUT-AND-BACK MOVEMENT (28s - 40s)
        const coordElapsed = elapsed - (PRE_SEQUENCE_DURATION + PAUSE_DURATION + APPROACH_DURATION);
        const progressCoord = coordElapsed / COORDINATED_MOVE_DURATION;
        
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
            sendCompletionSignal("normal");
        }, FINAL_HOLD_DURATION);
    }
}

// ============================================================================
// QUALTRICS HANDSHAKE (otomatik yönlendirme + alım onayı kaydı)
// ============================================================================
const SESSION_ID = "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
let qualtricsAckReceived = false;
let hasSentCompletion = false;
let handshakeIntervalId = null;

function sendCompletionSignal(reason) {
    if (hasSentCompletion) return;
    hasSentCompletion = true;

    const payload = {
        type: "MAP_ANIMATION_COMPLETE",
        sessionId: SESSION_ID,
        reason: reason,          // "normal" | "timeout" | "map-load-failed" | "manual-fallback"
        nickname: userNickname,
        timestamp: Date.now()
    };

    let attempts = 0;
    const MAX_ATTEMPTS = 15;
    handshakeIntervalId = setInterval(() => {
        attempts++;
        try {
            if (window.parent) window.parent.postMessage(payload, "*");
        } catch (e) {
            console.warn("postMessage gönderilemedi:", e);
        }
        if (qualtricsAckReceived || attempts >= MAX_ATTEMPTS) {
            clearInterval(handshakeIntervalId);
            if (!qualtricsAckReceived) {
                console.warn("Qualtrics'ten onay (ack) alınamadı. Manuel devam butonu gösteriliyor.");
                showManualContinueFallback();
            }
        }
    }, 400);
}

window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "MAP_ANIMATION_ACK" && event.data.sessionId === SESSION_ID) {
        qualtricsAckReceived = true;
    }
});

function showManualContinueFallback() {
    if (document.getElementById("manual-continue-fallback")) return;
    const wrap = document.createElement("div");
    wrap.id = "manual-continue-fallback";
    wrap.setAttribute("role", "alert");
    wrap.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);" +
        "background:#fff;border:1px solid #ccc;border-radius:8px;padding:14px 18px;" +
        "box-shadow:0 2px 10px rgba(0,0,0,0.15);z-index:9999;text-align:center;font-family:sans-serif;";
    wrap.innerHTML = '<p style="margin:0 0 10px 0;">Bu bölüm tamamlandı. Devam etmek için lütfen aşağıdaki butona tıklayın.</p>';
    const btn = document.createElement("button");
    btn.textContent = "Devam Et";
    btn.setAttribute("aria-label", "Ankete devam et");
    btn.style.cssText = "padding:8px 20px;border:none;border-radius:6px;background:#2b6cb0;color:#fff;font-size:15px;cursor:pointer;";
    btn.addEventListener("click", () => {
        try {
            if (window.parent) {
                window.parent.postMessage({ type: "MAP_ANIMATION_COMPLETE", sessionId: SESSION_ID, reason: "manual-fallback", timestamp: Date.now() }, "*");
            }
        } catch (e) { /* yut */ }
        wrap.remove();
    });
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
}

// ============================================================================
// MAKSİMUM TIMEOUT (katılımcı asla takılı kalmasın)
// ============================================================================
const MAX_EXPERIMENT_TIMEOUT_MS = 90 * 1000;
setTimeout(() => {
    if (!hasSentCompletion) {
        console.warn("Maksimum süre aşıldı, katılımcı otomatik olarak ilerletiliyor.");
        sendCompletionSignal("timeout");
    }
}, MAX_EXPERIMENT_TIMEOUT_MS);

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
    const val = nicknameInput ? nicknameInput.value.trim() : "Katılımcı";
    if (val === "") { alert("Lütfen geçerli bir takma ad girin."); return; }
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
    nicknameInput.setAttribute("aria-label", "Takma adınızı girin");
    nicknameInput.addEventListener("keypress", (e) => { if (e.key === "Enter") handleLoginSubmit(); });
}
if (submitBtn) {
    submitBtn.setAttribute("aria-label", "Takma adı gönder ve devam et");
}

// ============================================================================
// HARİTA YÜKLENEMEZSE AÇIK BİR FALLBACK
// ============================================================================
let mapHasLoaded = false;
let mapLoadFallbackTriggered = false;

function showMapLoadFallback() {
    if (mapLoadFallbackTriggered) return;
    mapLoadFallbackTriggered = true;

    const mapContainer = document.getElementById("map");
    if (mapContainer) mapContainer.style.visibility = "hidden";

    const fallback = document.createElement("div");
    fallback.id = "map-load-fallback";
    fallback.setAttribute("role", "alert");
    fallback.setAttribute("aria-live", "assertive");
    fallback.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;" +
        "display:flex;align-items:center;justify-content:center;background:#f7f7f7;" +
        "font-family:sans-serif;text-align:center;padding:24px;box-sizing:border-box;z-index:5000;";
    fallback.innerHTML =
        '<div style="max-width:420px;">' +
        '<p style="font-size:17px;color:#333;margin-bottom:8px;">Harita şu anda yüklenemedi.</p>' +
        '<p style="font-size:14px;color:#666;">Bağlantınız kontrol ediliyor, lütfen bekleyiniz. Bu ekran otomatik olarak ilerleyecektir.</p>' +
        "</div>";
    document.body.appendChild(fallback);

    if (!animationStarted) {
        animationStarted = true;
        setTimeout(() => {
            sendCompletionSignal("map-load-failed");
        }, TOTAL_ANIMATION_DURATION + FINAL_HOLD_DURATION);
    }
}

const MAP_LOAD_TIMEOUT_MS = 8000;
let mapLoadTimeoutId = null;

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

        mapLoadTimeoutId = setTimeout(() => {
            if (!mapHasLoaded) {
                console.warn("Harita belirlenen süre içinde yüklenmedi (timeout).");
                showMapLoadFallback();
            }
        }, MAP_LOAD_TIMEOUT_MS);

        map.on('load', () => {
            mapHasLoaded = true;
            if (mapLoadTimeoutId) clearTimeout(mapLoadTimeoutId);
            map.getCanvas().style.filter = 'grayscale(0.6) contrast(1.1) brightness(0.95) hue-rotate(25deg)';
        });

        map.on('error', (e) => {
            console.error("Harita hata event'i:", e);
            if (!mapHasLoaded) showMapLoadFallback();
        });
    } else {
        console.warn("MapLibre CDN kütüphanesi yüklenemedi.");
        showMapLoadFallback();
    }
} catch (error) {
    console.error("Harita başlatma hatası:", error);
    showMapLoadFallback();
}
