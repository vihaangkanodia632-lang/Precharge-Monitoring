/**
 * ============================================================
 *  Formula Student Precharge Monitor — Dashboard App
 *  Firebase Realtime Database listener + UI state machine
 * ============================================================
 *
 *  ⚠️  SETUP: Replace the firebaseConfig object below with
 *  your project's configuration from the Firebase Console.
 *  (Project Settings → Your Apps → SDK setup and config)
 * ============================================================
 */

// ── Firebase Config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDiVdND6Qrp8RxIkuqYaPYltiI6xce7Jn8",
  authDomain: "precharge-monitoring-2b069.firebaseapp.com",
  databaseURL: "https://precharge-monitoring-2b069-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "precharge-monitoring-2b069",
  storageBucket: "precharge-monitoring-2b069.firebasestorage.app",
  messagingSenderId: "261190354728",
  appId: "1:261190354728:web:0ce7db28fd8e558c74b21d",
  measurementId: "G-E22DDBVWRT"
};
// ── State Metadata ────────────────────────────────────────────
const STATES = [
  {
    index: 0,
    label: "IDLE",
    short: "IDLE",
    desc:  "All relays and signals are OFF. System inactive.",
  },
  {
    index: 1,
    label: "TS Active Request",
    short: "TS REQ",
    desc:  "AIR− contactor closed. Tractive system activation requested.",
  },
  {
    index: 2,
    label: "Precharge Initiated",
    short: "PCR ON",
    desc:  "Precharge relay energised. Inverter capacitors charging through resistor pack.",
  },
  {
    index: 3,
    label: "HW Verification",
    short: "HW CHK",
    desc:  "Timer and comparator signals rising — capacitor voltage climbing toward threshold.",
  },
  {
    index: 4,
    label: "Logic Validation",
    short: "VALID",
    desc:  "AND gate HIGH. All hardware safety parameters confirmed.",
  },
  {
    index: 5,
    label: "Ready to Drive",
    short: "RTD ✓",
    desc:  "AIR+ closed, precharge relay de-energised. HV system fully active.",
  },
];

// ── DOM References ────────────────────────────────────────────
const $connDot      = document.getElementById("conn-dot");
const $connLabel    = document.getElementById("conn-label");
const $faultBanner  = document.getElementById("fault-banner");
const $stateLabel   = document.getElementById("state-label");
const $stateDesc    = document.getElementById("state-desc");
const $pipeline     = document.getElementById("pipeline");
const $timestamp    = document.getElementById("timestamp");
const $compRaw      = document.getElementById("comp-raw");
const $timerRaw     = document.getElementById("timer-raw");
const $compBar      = document.getElementById("comp-bar");
const $timerBar     = document.getElementById("timer-bar");

const ADC_MAX = 4095; // 12-bit

// ── Build Pipeline HTML ───────────────────────────────────────
function buildPipeline() {
  $pipeline.innerHTML = STATES.map((s, i) => `
    <div class="step" id="step-${i}">
      <div class="step-circle" id="circle-${i}">${i}</div>
      <span class="step-label" id="label-${i}">${s.short}</span>
    </div>
  `).join("");
}

// ── Update Pipeline UI ────────────────────────────────────────
function updatePipeline(currentState, fault) {
  STATES.forEach((_, i) => {
    const circle = document.getElementById(`circle-${i}`);
    const label  = document.getElementById(`label-${i}`);
    const step   = document.getElementById(`step-${i}`);

    circle.className = "step-circle";
    label.className  = "step-label";
    step.className   = "step";

    if (fault && i === currentState) {
      circle.classList.add("fault");
      label.classList.add("active");
    } else if (i < currentState) {
      circle.classList.add("completed");
      label.classList.add("active");
      step.classList.add("line-active");
    } else if (i === currentState) {
      circle.classList.add("current");
      label.classList.add("active");
    }
  });
}

// ── Update Signal Cards ───────────────────────────────────────
const SIGNALS = ["airMinus", "prechargeRelay", "timerOk", "compOk", "andGate", "airPlus"];

function updateSignals(data, fault) {
  SIGNALS.forEach(key => {
    const dot  = document.getElementById(`dot-${key}`);
    const card = document.getElementById(`card-${key}`);
    if (!dot || !card) return;

    dot.className  = "signal-dot";
    card.className = "signal-card";

    const active = !!data[key];
    if (fault && active) {
      dot.classList.add("fault");
      card.classList.add("fault");
    } else if (active) {
      dot.classList.add("active");
      card.classList.add("active");
    }
  });
}

// ── Update ADC Bars ───────────────────────────────────────────
function updateADC(compRaw, timerRaw) {
  const compPct  = Math.round((compRaw  / ADC_MAX) * 100);
  const timerPct = Math.round((timerRaw / ADC_MAX) * 100);

  $compRaw.textContent  = compRaw;
  $timerRaw.textContent = timerRaw;

  $compBar.style.width  = `${compPct}%`;
  $timerBar.style.width = `${timerPct}%`;

  const threshold = (3476 / ADC_MAX) * 100;
  $compBar.style.background  = compPct  >= threshold ? "#10b981" : "#f59e0b";
  $timerBar.style.background = timerPct >= threshold ? "#10b981" : "#f59e0b";
}

// ── Main data handler ─────────────────────────────────────────
function applyData(data) {
  const stateIdx = data.state    ?? 0;
  const fault    = data.fault    ?? false;
  const compRaw  = data.compRaw  ?? 0;
  const timerRaw = data.timerRaw ?? 0;
  const ts       = data.timestamp;

  const meta = STATES[stateIdx] ?? STATES[0];

  // State headline
  $stateLabel.textContent = meta.label;
  $stateDesc.textContent  = meta.desc;

  // Fault banner
  if (fault) {
    $faultBanner.classList.remove("hidden");
    $faultBanner.classList.add("flex");
    document.body.classList.remove("rtd-active");
  } else {
    $faultBanner.classList.add("hidden");
    $faultBanner.classList.remove("flex");
    if (stateIdx === 5) document.body.classList.add("rtd-active");
    else document.body.classList.remove("rtd-active");
  }

  updatePipeline(stateIdx, fault);
  updateSignals(data, fault);
  updateADC(compRaw, timerRaw);

  // Timestamp
  if (ts !== undefined) {
    const d = new Date(ts * 1000);
    $timestamp.textContent = d.toLocaleTimeString();
  }
}

// ── Firebase Realtime listener ────────────────────────────────
function initFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    const db  = firebase.database();
    const ref = db.ref("/precharge/live");

    ref.on("value", (snap) => {
      setConnected(true);
      const data = snap.val();
      if (data) applyData(data);
    }, (err) => {
      console.error("Firebase listener error:", err);
      setConnected(false);
    });

    // Detect connection state
    db.ref(".info/connected").on("value", (snap) => {
      setConnected(snap.val() === true);
    });

  } catch (err) {
    console.error("Firebase init error:", err);
    setConnected(false);
    showDemoMode();
  }
}

// ── Connection status ─────────────────────────────────────────
function setConnected(connected) {
  $connDot.style.background   = connected ? "#10b981" : "#52525b";
  $connLabel.textContent      = connected ? "Live" : "Disconnected";
  $connLabel.style.color      = connected ? "#10b981" : "#71717a";
}

// ── Demo / Offline simulation ─────────────────────────────────
// Runs a fake sequence so you can see the UI without hardware.
// Comment out showDemoMode() call in initFirebase() once live.
let demoStep = 0;
const DEMO_SEQUENCE = [
  { state:0, fault:false, airMinus:false, prechargeRelay:false, timerOk:false, compOk:false, andGate:false, airPlus:false, compRaw:100,  timerRaw:80 },
  { state:1, fault:false, airMinus:true,  prechargeRelay:false, timerOk:false, compOk:false, andGate:false, airPlus:false, compRaw:200,  timerRaw:150 },
  { state:2, fault:false, airMinus:true,  prechargeRelay:true,  timerOk:false, compOk:false, andGate:false, airPlus:false, compRaw:800,  timerRaw:600 },
  { state:3, fault:false, airMinus:true,  prechargeRelay:true,  timerOk:true,  compOk:true,  andGate:false, airPlus:false, compRaw:3600, timerRaw:3500 },
  { state:4, fault:false, airMinus:true,  prechargeRelay:true,  timerOk:true,  compOk:true,  andGate:true,  airPlus:false, compRaw:3800, timerRaw:3750 },
  { state:5, fault:false, airMinus:true,  prechargeRelay:false, timerOk:true,  compOk:true,  andGate:true,  airPlus:true,  compRaw:3900, timerRaw:3880 },
];

function showDemoMode() {
  $connLabel.textContent = "Demo Mode";
  $connLabel.style.color = "#f59e0b";
  $connDot.style.background = "#f59e0b";

  function tick() {
    const data = { ...DEMO_SEQUENCE[demoStep], timestamp: Math.floor(Date.now() / 1000) };
    applyData(data);
    demoStep = (demoStep + 1) % DEMO_SEQUENCE.length;
  }
  tick();
  setInterval(tick, 1800);
}

// ── Boot ──────────────────────────────────────────────────────
buildPipeline();
initFirebase();