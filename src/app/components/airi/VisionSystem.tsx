import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, Play, Pause, RefreshCw, Sparkles, Eye, X, Volume2, Clock, BarChart3 } from "lucide-react";

type VisionState = "focused" | "distracted_phone" | "distracted_away" | "sleepy" | "absent" | "thinking" | "writing" | "reading" | "unknown" | "visitors";

interface Observation {
  state: VisionState;
  confidence: number;
  events: string[];
  timestamp: number;
  speech?: string;
}

interface VisionSystemProps {
  isStudyMode: boolean;
  onDistractionDetected: (type: "Phone Usage" | "Social Media / Game" | "User Absence" | "Yawning / Fatigue" | "Other Person", comment?: string) => void;
  setEmotion: (e: any) => void;
  speakText: (text: string) => void;
  language?: "en" | "te";
}

const MAX_HISTORY = 10;
const SCAN_INTERVAL = 15000;
const MAX_RESPONSE_HISTORY = 10;
const FOCUS_SPEECH_CHANCE = 0;

const RESPONSE_POOLS: Record<string, string[] | { level1: string[]; level2: string[]; level3: string[] }> = {
  focused: [
    "సూపర్ రా... ఇలాగే కంటిన్యూ.",
    "బాగుంది రా... ప్రౌడ్ ఆఫ్ యూ.",
    "చాలా బాగా చేస్తున్నావ్ రా.",
    "ఇలాగే కంటిన్యూ చేయి బ్రో.",
    "సూపర్ కాన్సిస్టెన్సీ రా.",
    "యూ ఆర్ డూయింగ్ గ్రేట్ రా.",
    "అవెసమ్ ఫోకస్... నీకు సెల్యూట్.",
    "కీప్ ఇట్ అప్ అన్నా.",
    "చాలా బాగుంది నీ ప్రోగ్రెస్.",
    "ప్రౌడ్ ఆఫ్ యూ రా.",
    "నైస్... ఇలాగే కంటిన్యూ చేయి.",
    "ఫోకస్ బాగుంది రా.",
    "సూపర్ గా చేస్తున్నావ్.",
    "ఇలాంటి ఫోకస్ చాలు రా జీవితంలో.",
    "గుడ్ జాబ్ రా.",
    "డిసిప్లిన్ బాగుంది రా.",
    "పర్ఫెక్ట్ గా చేస్తున్నావ్ రా.",
    "జింగ్ జింగ్ ఆ రా... కంటిన్యూ.",
    "మీఈఈ సూపర్ రా నువ్వు.",
    "స్టడీ మోడ్ ఆన్ ఫైర్ రా.",
  ],
  distracted_phone: {
    level1: [
      "అరే ఫోన్ పక్కన పెట్టెయ్... ఇంకో 10 నిమిషాలు ఫోకస్ చేద్దాం రా.",
      "ఫోన్ తర్వాత చూడొచ్చులే... ముందు ఇది కంప్లీట్ చేద్దాం.",
      "ఫోన్ ఇప్పుడు వద్దు రా... కొంచెం స్టడీ మీద ఫోకస్ చేద్దాం.",
      "హెయ్... ఫోన్ పక్కన పెట్టు ముందు.",
      "ఫోన్ తర్వాత ఎన్ని సార్లు చూడొచ్చు... ఇప్పుడు చదువు రా.",
      "చాలు రా ఫోన్... కొంచెం చదువు కూడా చూడు.",
      "ఫోన్ నీ టైమ్ తింటుంది... జాగ్రత్త రా.",
      "స్టడీ టైమ్ లో ఫోన్ వద్దు గుర్తుందా?",
      "లవ్ యూ రా... కానీ ఇప్పుడు ఫోన్ పక్కన పెట్టు.",
      "ఫోన్ పక్కన పెట్టు... కాసేపు మనం చదువుదాం.",
    ],
    level2: [
      "ఇంకా ఫోన్ నా? కొంచెం కాన్సెంట్రేట్ చేద్దాం రా.",
      "ఫోన్ నోటిఫికేషన్స్ తర్వాత చూడొచ్చులే.",
      "ఫోన్ చాలా టైమ్ తీస్తుంది రా... వేస్ట్ చేయకు.",
      "నీకు నేనే చెప్పాలా... ఫోన్ దూరంగా పెట్టు.",
      "ప్లీజ్ రా... ముందు ఈ లెస్సేన్ ఫినిష్ చేద్దాం.",
      "మళ్ళీ ఫోన్ నా? నీకు నచ్చిందా ఫోన్ అంటే?",
      "కొంచెం దూరంగా పెట్టు ఫోన్... 20 నిమిషాలు మాత్రం.",
      "ఫోన్ డిస్ట్రాక్షన్ అని తెలుసు కదా నీకు?",
      "నన్ను నమ్ము రా... ఫోన్ పక్కన పెట్టు.",
      "కొంచెం సీరియస్ అవ్వు రా... ఫోన్ చాల్లే.",
    ],
    level3: [
      "నువ్వు చెయ్యగలవు రా... కొంచెం ఇంకా ట్రై చేయి.",
      "ఫోన్ నీ కంట్రోల్ లో ఉండాలి... ఇప్పుడు పక్కన పెట్టు.",
      "నీ టార్గెట్ ఏంటో గుర్తుచేసుకో... ఫోన్ కాదు రా అది.",
      "ప్లీజ్ రా... నీ ఫ్యూచర్ కోసం ఫోన్ పక్కన పెట్టు.",
      "ఫోన్ తర్వాత ఒక గంట చూసుకో... ఇప్పుడు చదువు.",
      "నీకోసమే చెప్తున్నా... ఫోన్ దూరంగా ఉంచు రా.",
      "చాలు రా చాలు... ఫోన్ పెట్టెయ్.",
      "కాస్త కంట్రోల్ రా... ఫోన్ అంత అవసరం లేదు.",
      "నువ్వు బెటర్ రా... ఫోన్ మానేసి చదువు చూడు.",
      "ఫోన్ పక్కన పెట్టేయ్ రా... చదువు ముఖ్యం.",
    ],
  },
  distracted_away: {
    level1: [
      "ఏంటి రా అలా చూస్తున్నావ్? ఫోకస్ చేద్దాం.",
      "అటు ఎందుకు చూస్తున్నావ్? ఇటు చూడు రా.",
      "డిస్ట్రాక్ట్ అయ్యావా? మళ్ళీ స్టార్ట్ చేద్దాం.",
      "ఏం మైండ్ లో? చదువు మీద ఫోకస్ చేయి.",
      "కాన్సెంట్రేషన్ మిస్ అయ్యిందా? మళ్ళీ సెట్ అవ్వు.",
      "అటు చూడకు రా... ఇలా చూడు.",
      "ఫోకస్ ఎక్కడ రా? మనం చదువుదాం.",
    ],
    level2: [
      "అంతే రా... అక్కడే చూస్తూ కూర్చున్నావ్. మళ్ళీ చదువు.",
      "ఏదో ఆలోచనల్లో ఉన్నావ్... పక్కన పెట్టెయ్.",
      "దాన్ని ఎందుకు పట్టుకున్నావ్? పక్కన పెట్టు ముందు.",
      "ఫోకస్ షిఫ్ట్ అవుతుంది రా... స్టడీ మీద పెట్టు.",
      "చదువు మీద ధ్యానం పెట్టు... ఇదే సమయం.",
      "కొంచెం ఇంకా ఫోకస్ చేయి రా... నీకు అవుతుంది.",
    ],
    level3: [
      "థాట్స్ అన్నీ పక్కన పెట్టు... ప్రస్తుతం చదువు ముఖ్యం రా.",
      "మైండ్ డిస్ట్రాక్షన్ వద్దు రా... నీ లక్ష్యం చూడు.",
      "మళ్ళీ మళ్ళీ డిస్ట్రాక్ట్ అవుతున్నావ్... కొంచెం సీరియస్ అవ్వు.",
      "చదువు తప్ప మరేం లేదు రా ఇప్పుడు.",
      "కాన్సంట్రేషన్ పోతుంది రా... మళ్ళీ స్టార్ట్ చేద్దాం.",
      "నీ ఆలోచనలన్నీ పక్కన పెట్టు... ఇప్పుడు చదువు టైం.",
      "ఒకటి తర్వాత ఒకటి... ఇలా ఫోకస్ చేస్తే అన్నీ అవుతాయి.",
    ],
  },
  sleepy: {
    level1: [
      "నిద్ర మీదకు వస్తుందా? లేచి కొంచెం నీళ్ళు తాగి రా.",
      "కొంచెం స్ట్రెచ్ చేసి రా... తర్వాత ఫ్రెష్ గా చదువు.",
      "లేచి ఒక సారి తిరిగి రా... కాస్త ఫ్రెష్ అవుతావ్.",
      "ముఖం కడుక్కుని రా... చాలా ఫ్రెష్ గా ఫీల్ అవుతావ్.",
      "స్ట్రెచ్ చేయి రా... ఇంకా 20 నిమిషాలు మనం చదవాలి.",
    ],
    level2: [
      "కాఫీ తాగి రా... నిద్ర పోతుంది.",
      "నిద్ర వచ్చేస్తుందా? కాసేపు రెస్ట్ తీసుకో.",
      "బ్రేక్ తీసుకో రా... 5 నిమిషాలు వాక్ చేసి రా.",
      "టైర్డ్ గా ఉన్నావా? కాస్త రెస్ట్ తీసుకుని రా.",
      "నీళ్ళు తాగి రా... నిద్ర పారిపోతుంది.",
    ],
    level3: [
      "లేచి నడిచి రా... ఇంకా 30 నిమిషాలు మనం ఫోకస్ చేయాలి.",
      "లే రా... నిద్ర పోకు... ఇంకా చదవాలి.",
      "నీళ్ళు ముఖం మీద కొట్టుకో... ఫ్రెష్ అవ్వు రా.",
      "నిద్ర వస్తే నిలబడి చదువు రా.",
      "చాలు లే... నిద్ర తర్వాత చూసుకోవచ్చు. ఇప్పుడు లే.",
    ],
  },
  absent: [
    "ఎక్కడికి వెళ్ళిపోయావ్ రా? తిరిగి రా.",
    "బ్రేక్ తీసుకున్నావా? రెడీ అయితే కంటిన్యూ చేద్దాం.",
    "వచ్చేస్తావా? లేదంటే నేను నిద్ర పోతా.",
    "వెళ్ళిపోయావా? వచ్చాక చెప్పు రా.",
    "తిరిగి రా రా... ఇంకా చాలా చదవాలి.",
    "బ్రేక్ అయిపోయిందా? సరే కంటిన్యూ చేద్దాం.",
    "ఎక్కడున్నావ్ రా? మిస్ అయ్యావ్ నేనైతే.",
    "తిరిగి వచ్చేస్తావ్? నేను రెడీగా ఉన్నా.",
    "వచ్చావా? బాగుంది... ఇప్పుడు స్టార్ట్ చేద్దాం.",
    "వెయిట్ చేస్తున్నా రా... ఎప్పుడు వస్తావ్?",
  ],
  unknown: {
    level1: [
      "కొంచెం స్క్రీన్ మీద ఫోకస్ చేయి రా.",
      "ఏం చేస్తున్నావ్? ఫోకస్ చేద్దాం.",
      "కొంచెం కాన్సంట్రేషన్ మెయింటెయిన్ చేయి రా.",
    ],
    level2: [
      "అక్కడే చూస్తున్నావ్... బుక్ మీద చూడు రా.",
      "ఏదో చూస్తున్నావ్... దాని పక్కన పెట్టి ఫోకస్ రా.",
    ],
    level3: [
      "మళ్ళీ ఫోకస్ చేద్దాం రా.",
      "లాస్ట్ ఇన్ థాట్స్ అహ్? స్టడీ చేద్దాం రా.",
    ],
  },
  visitors: [
    "ప్లీజ్ లెట్ నవీన్ స్టడీ... అతను చదువుకోనివ్వండి.",
    "హే... నవీన్ చదువుతున్నాడు... ప్లీజ్ డిస్టర్బ్ చేయకండి.",
    "నవీన్ కి స్టడీ టైం... తర్వాత రండి ప్లీజ్.",
    "గైస్... నవీన్ చదువుకునే టైం ఇది. కాస్త సైలెన్స్ ప్లీజ్.",
    "నవీన్ ఫోకస్ గా చదువుతున్నాడు... అతన్ని డిస్టర్బ్ చేయకండి.",
    "అతను చదువుతున్నాడు రా... తర్వాత రండి.",
    "విజిటర్స్ డిటెక్టెడ్... నవీన్ చదువుకోనివ్వండి ప్లీజ్.",
    "ప్లీజ్ లెట్ హిమ్ స్టడీ... థాంక్యూ.",
    "నవీన్ కి ఇప్పుడు స్టడీ టైం... కాస్త సైలెన్స్ ప్లీజ్.",
    "నవీన్ గదిలో ఎవరున్నారు? అతను చదువుతున్నాడు... ప్లీజ్ డోంట్ డిస్టర్బ్.",
  ],
};

const STATE_COOLDOWNS: Record<string, { min: number; max: number }> = {
  focused: { min: 480000, max: 720000 },
  distracted_phone: { min: 60000, max: 90000 },
  distracted_away: { min: 60000, max: 90000 },
  sleepy: { min: 120000, max: 180000 },
  absent: { min: 30000, max: 30000 },
  unknown: { min: 60000, max: 90000 },
  visitors: { min: 30000, max: 60000 },
};

const DISTRACTION_STATES = new Set(["distracted_phone", "distracted_away", "sleepy", "unknown", "visitors"]);

function isFocused(state: VisionState): boolean {
  return state === "focused" || state === "thinking" || state === "writing" || state === "reading";
}

function getCooldown(state: string): number {
  const cd = STATE_COOLDOWNS[state] || STATE_COOLDOWNS.unknown;
  return cd.min + Math.random() * (cd.max - cd.min);
}

function randomFrom(arr: string[], exclude: Set<string>): string {
  const available = arr.filter(s => !exclude.has(s));
  const pool = available.length > 0 ? available : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

const FOCUSED_STATES = new Set(["focused", "reading", "writing", "thinking"]);

function summarizeObs(obs: Observation[]): { focusPct: number; distractionPct: number; phone: number; sleepy: number; visitors: number; away: number; absent: number } {
  const total = Math.max(obs.length, 1);
  let focus = 0, phone = 0, sleepy = 0, visitors = 0, away = 0, absent = 0;
  for (const o of obs) {
    if (FOCUSED_STATES.has(o.state)) focus++;
    else if (o.state === "distracted_phone") phone++;
    else if (o.state === "sleepy") sleepy++;
    else if (o.state === "visitors") visitors++;
    else if (o.state === "distracted_away") away++;
    else if (o.state === "absent") absent++;
  }
  const distraction = phone + sleepy + visitors + away;
  return {
    focusPct: Math.round((focus / total) * 100),
    distractionPct: Math.round((distraction / total) * 100),
    phone, sleepy, visitors, away, absent,
  };
}

function groupByDate(obs: Observation[]): { label: string; items: Observation[] }[] {
  const groups: { label: string; items: Observation[] }[] = [];
  const today = new Date();
  for (const o of [...obs].reverse().slice(0, 100)) {
    const d = new Date(o.timestamp);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = "Today";
    else {
      const y = new Date(today); y.setDate(today.getDate() - 1);
      label = d.toDateString() === y.toDateString() ? "Yesterday" : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    }
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(o);
    else groups.push({ label, items: [o] });
  }
  return groups;
}

function selectResponse(state: string, distractionCount: number, recent: Set<string>): string {
  const pool = RESPONSE_POOLS[state];
  if (!pool) return randomFrom(RESPONSE_POOLS.distracted_away as string[], recent);

  if (Array.isArray(pool)) return randomFrom(pool, recent);

  let level: keyof typeof pool;
  if (distractionCount <= 1) level = "level1";
  else if (distractionCount <= 3) level = "level2";
  else level = "level3";

  return randomFrom(pool[level] as string[], recent);
}

export default function VisionSystem({ onDistractionDetected, setEmotion, speakText }: VisionSystemProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camState, setCamState] = useState<"init" | "granted" | "denied">("init");
  const [capturing, setCapturing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [auto, setAuto] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [sessionInfo, setSessionInfo] = useState("");

  const lastSpeakRef = useRef<Record<string, number>>({});
  const lastFocusSpeechRef = useRef(0);
  const analyzingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const sessionStartRef = useRef(Date.now());
  const historyRef = useRef<Observation[]>([]);
  const focusedMinutesRef = useRef(0);
  const lastFocusedRef = useRef(Date.now());
  const recentResponsesRef = useRef<Set<string>>(new Set());
  const speechQueueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const distractionCountRef = useRef(0);
  const episodeSpeakCountRef = useRef(0);
  const lastStateRef = useRef<VisionState>("focused");
  const phoneLockRef = useRef(0);
  const PHONE_LOCK_FRAMES = 2;

  const [showHistory, setShowHistory] = useState(false);
  const [persistedObs, setPersistedObs] = useState<Observation[]>([]);
  const [analysisText, setAnalysisText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  // ─── Load persisted observations on mount ──────────────────────────
  useEffect(() => {
    fetch("/api/vision/observations")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPersistedObs(data.map((o: any) => ({
            state: o.state as VisionState,
            confidence: o.confidence,
            events: o.events || [],
            timestamp: new Date(o.timestamp).getTime(),
            speech: o.speech,
          })));
        }
      })
      .catch(() => {});
  }, []);

  // ─── Camera ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!capturing) {
      videoRef.current?.srcObject && (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      return;
    }
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      .then(s => { stream = s; setCamState("granted"); if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => setCamState("denied"));
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [capturing]);

  // ─── Server status ──────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/vision/server-status")
      .then(r => r.json().then(() => setServerStatus("online")).catch(() => setServerStatus("offline")))
      .catch(() => setServerStatus("offline"));
  }, []);

  // ─── Canvas loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let id: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (videoRef.current?.readyState === 4 && !minimized) {
        ctx.save(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.fillStyle = "rgba(245,166,35,0.25)"; ctx.font = "9px monospace";
        ctx.fillText("AIRI VISION", 10, 16);
        const fx = canvas.width / 2 + Math.sin(Date.now() / 1500) * 10;
        const fy = canvas.height / 2 - 5 + Math.cos(Date.now() / 2000) * 5;
        ctx.strokeStyle = "rgba(245,166,35,0.6)"; ctx.lineWidth = 1.5;
        ctx.strokeRect(fx - 35, fy - 45, 70, 90);
      } else if (!minimized) {
        ctx.fillStyle = "#050508"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(245,166,35,0.3)"; ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(camState === "denied" ? "NO CAMERA ACCESS" : "CAMERA: STANDBY", canvas.width / 2, canvas.height / 2);
        ctx.textAlign = "start";
      }
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, [videoRef, minimized, camState]);

  // ─── Speech queue ────────────────────────────────────────────────────
  const processQueue = useCallback(async () => {
    if (speechQueueRef.current.length === 0) { speakingRef.current = false; return; }
    speakingRef.current = true;
    const text = speechQueueRef.current.shift()!;
    try { await speakText(text); } catch (e) { console.error("processQueue:", e); }
    processQueue();
  }, [speakText]);

  useEffect(() => () => { speechQueueRef.current = []; speakingRef.current = false; }, []);

  const enqueueSpeech = useCallback((text: string) => {
    speechQueueRef.current.push(text);
    if (!speakingRef.current) processQueue();
  }, [processQueue]);

  // ─── Track focused minutes ──────────────────────────────────────────
  const trackFocused = useCallback((history: Observation[]) => {
    const last = history[history.length - 1];
    if (!last) return;
    const now = Date.now();
    if (isFocused(last.state)) {
      focusedMinutesRef.current += (now - lastFocusedRef.current) / 60000;
    }
    lastFocusedRef.current = now;
  }, []);

  const formatSessionTime = useCallback((minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  }, []);

  // ─── Select and speak ────────────────────────────────────────────────
  const speak = useCallback((state: string, count: number) => {
    const text = selectResponse(state, count, recentResponsesRef.current);
    recentResponsesRef.current.add(text);
    if (recentResponsesRef.current.size > MAX_RESPONSE_HISTORY) {
      recentResponsesRef.current = new Set([...recentResponsesRef.current].slice(-MAX_RESPONSE_HISTORY));
    }
    lastSpeakRef.current[state] = Date.now();
    if (isFocused(lastStateRef.current)) {
      lastFocusSpeechRef.current = Date.now();
    }
    enqueueSpeech(text);
    return text;
  }, [enqueueSpeech]);

  // ─── Decision engine ──────────────────────────────────────────────────
  const shouldSpeak = useCallback((state: VisionState): boolean => {
    if (state === "unknown") return false;

    if (state === "absent") {
      const now = Date.now();
      const cd = getCooldown("absent");
      return (now - (lastSpeakRef.current["absent"] || 0)) >= cd;
    }

    if (isFocused(state)) return false;

    // Speak on odd-numbered scans (1st, 3rd, 5th...) in same-state streak
    return distractionCountRef.current % 2 === 1;
  }, []);

  // ─── Main scan ───────────────────────────────────────────────────────
  const persistObservation = useCallback(async (state: string, confidence: number, events: string[], speech: string) => {
    const obs = {
      state,
      confidence,
      events,
      timestamp: new Date().toISOString(),
      speech: speech || undefined,
    };
    try {
      const res = await fetch("/api/vision/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obs),
      });
      if (res.ok) {
        setPersistedObs(prev => [...prev, {
          state: state as VisionState,
          confidence,
          events,
          timestamp: Date.now(),
          speech: speech || undefined,
        }].slice(-300));
      }
    } catch {} // silently fail
  }, []);
  const scan = useCallback(async () => {
    if (analyzingRef.current || !videoRef.current || videoRef.current.readyState < 2) return;
    analyzingRef.current = true;
    setBusy(true);

    const c = document.createElement("canvas");
    c.width = 320; c.height = 240;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);

    try {
      const res = await fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: c.toDataURL("image/jpeg") }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json();
      setServerStatus("online");

      const rawState = (data.state || "focused") as VisionState;
      const hasVisitors = (data.events || []).includes("multiple_people");
      let state = hasVisitors ? "visitors" : rawState;

      // Phone state lock: after phone detected, stay on phone for 2 frames
      // to prevent moondream hallucinations during phone-to-desk transition
      if (rawState !== "distracted_phone" && phoneLockRef.current > 0 && lastStateRef.current === "distracted_phone") {
        phoneLockRef.current--;
        state = "distracted_phone";
      } else if (rawState === "distracted_phone") {
        phoneLockRef.current = PHONE_LOCK_FRAMES;
      } else {
        phoneLockRef.current = 0;
      }

      const obs: Observation = {
        state,
        confidence: data.confidence ?? 50,
        events: data.events || [],
        timestamp: Date.now(),
      };

      historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), obs];
      trackFocused(historyRef.current);

      const sessionMinutes = focusedMinutesRef.current + (Date.now() - sessionStartRef.current) / 60000;
      const displaySession = formatSessionTime(sessionMinutes);
      setSessionInfo(displaySession);

      const logStates = historyRef.current.slice(-3).map(o => o.state).join(" → ");
      setLog(`[${new Date().toLocaleTimeString()}] ${state} ${obs.confidence}% · ${displaySession} · ${logStates}`);

      // Track consecutive same-state streak for alternating speech pattern
      if (isFocused(state)) {
        distractionCountRef.current = 0;
        episodeSpeakCountRef.current = 0;
      } else if (state !== "absent") {
        if (lastStateRef.current !== state) {
          episodeSpeakCountRef.current = 0;
        }
        distractionCountRef.current = lastStateRef.current === state ? distractionCountRef.current + 1 : 1;
      }

      lastStateRef.current = state;

      if (!shouldSpeak(state)) {
        persistObservation(obs.state, obs.confidence, obs.events, "");
        setBusy(false); analyzingRef.current = false; return;
      }

      episodeSpeakCountRef.current++;
      const message = speak(state, episodeSpeakCountRef.current);

      setLog(`[${new Date().toLocaleTimeString()}] ${state} ${obs.confidence}% · ${displaySession} · "${message.slice(0, 50)}"`);

      // Map state to props callbacks
      if (state === "absent") {
        setEmotion("angry");
        onDistractionDetected("User Absence", message);
      } else if (isFocused(state)) {
        setEmotion("happy");
      } else if (state === "visitors") {
        setEmotion("distracted");
      } else if (state === "sleepy") {
        setEmotion("sleepy");
        onDistractionDetected("Yawning / Fatigue", message);
      } else if (state === "distracted_phone") {
        setEmotion("distracted");
        onDistractionDetected("Phone Usage", message);
      } else {
        setEmotion("distracted");
        onDistractionDetected("Social Media / Game", message);
      }

      // Persist observation with speech to server
      persistObservation(obs.state, obs.confidence, obs.events, message);
    } catch {
      setServerStatus("offline");
      setLog(`[${new Date().toLocaleTimeString()}] server unavailable`);
    }

    setBusy(false);
    analyzingRef.current = false;
  }, [trackFocused, formatSessionTime, setEmotion, onDistractionDetected, enqueueSpeech, speak, shouldSpeak, persistObservation]);

  useEffect(() => { if (auto && capturing && camState === "granted") {
    scan();
    intervalRef.current = setInterval(scan, SCAN_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }}, [auto, capturing, camState, scan]);

  const testSpeech = useCallback(() => {
    enqueueSpeech("హాయ్... నేను రెడీ!");
  }, [enqueueSpeech]);

  // ─── Render ──────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAnalysisText("");
    try {
      const res = await fetch("/api/vision/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observations: persistedObs.slice(-100) }),
      });
      const data = await res.json();
      setAnalysisText(data.summary || "No analysis available.");
    } catch {
      setAnalysisText("Analysis failed. Is the server running?");
    }
    setAnalyzing(false);
  }, [persistedObs]);

  const clearHistory = useCallback(async () => {
    try {
      await fetch("/api/vision/observations", { method: "DELETE" });
      setPersistedObs([]);
      setAnalysisText("");
    } catch {}
  }, []);
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button onClick={() => setMinimized(false)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer"
          style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.2)", color: "#f5a623", fontFamily:"'M PLUS Rounded 1c', sans-serif" }}>
          <Eye className="h-4 w-4" />
          <span>Surveillance</span>
          {auto && capturing && <span className="w-2 h-2 rounded-full animate-ping" style={{ background: "#f5a623" }} />}
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 flex flex-col rounded-2xl overflow-hidden"
      style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "rgba(245,166,35,0.08)" }}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: "rgba(245,166,35,0.1)" }}>
            <Camera className="h-4 w-4" style={{ color: "#f5a623" }} />
          </div>
          <div>
            <h3 style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, color:"#f0e8d8" }}>Surveillance</h3>
            <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", color:"rgba(155,142,196,0.5)" }}>
              {serverStatus === "online" ? `Ollama AI · 15s${sessionInfo ? ` · ${sessionInfo}` : ""}` : serverStatus === "checking" ? "Connecting…" : "Offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCapturing(!capturing)}
            className="p-1.5 rounded-lg cursor-pointer transition-all hover:scale-105"
            style={{ background: capturing ? "rgba(245,166,35,0.1)" : "transparent", color: capturing ? "#f5a623" : "rgba(155,142,196,0.5)" }}>
            {capturing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => setMinimized(true)}
            className="p-1.5 rounded-lg cursor-pointer opacity-40 hover:opacity-100 transition-all" style={{ color: "rgba(155,142,196,0.5)" }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Camera */}
      <div className="relative" style={{ height: 168 }}>
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />
        <canvas ref={canvasRef} width={320} height={240} className="w-full h-full object-cover" />
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          <span className="px-1.5 py-0.5 rounded text-[7px] font-mono"
            style={{
              background: serverStatus === "online" ? "rgba(245,166,35,0.12)" : "rgba(245,158,11,0.12)",
              color: serverStatus === "online" ? "#f5a623" : "#f59e0b",
              border: `1px solid ${serverStatus === "online" ? "rgba(245,166,35,0.2)" : "rgba(245,158,11,0.2)"}`,
            }}>
            {serverStatus === "online" ? "AI" : serverStatus === "checking" ? "…" : "OFF"}
          </span>
          {busy && <span className="px-1.5 py-0.5 rounded text-[7px] font-mono"
            style={{ background: "rgba(245,166,35,0.12)", color: "#f5a623", border: "1px solid rgba(245,166,35,0.2)" }}>
            SCAN
          </span>}
        </div>
        {camState === "denied" && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(15,12,8,0.9)" }}>
            <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", color:"#f59e0b" }}>⚠️ Camera blocked</span>
          </div>
        )}
      </div>

      {/* Log */}
      {log && (
        <div className="px-3 py-1.5 text-[8px] font-mono truncate" style={{ background: "#0f0c08", color: "#f5a623", borderTop: "1px solid rgba(245,166,35,0.06)" }}>
          &gt; {log}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-1.5 p-2">
        <button onClick={() => setAuto(!auto)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-mono cursor-pointer"
          style={{
            background: auto ? "rgba(245,166,35,0.1)" : "transparent",
            border: auto ? "1px solid rgba(245,166,35,0.2)" : "1px solid rgba(245,166,35,0.08)",
            color: auto ? "#f5a623" : "rgba(155,142,196,0.5)",
          }}>
          <Eye className="h-3 w-3" /> <span>AUTO</span>
        </button>
        <button onClick={scan} disabled={busy || !capturing || camState !== "granted"}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-mono disabled:opacity-40 cursor-pointer"
          style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", color: "#f5a623" }}>
          {busy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          <span>SCAN</span>
        </button>
        <button onClick={testSpeech}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-mono cursor-pointer"
          style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.08)", color: "#f5a623" }}>
          <Volume2 className="h-3 w-3" /> <span>TEST</span>
        </button>
      </div>

      {/* Session History Toggle */}
      <button onClick={() => setShowHistory(!showHistory)}
        className="flex items-center gap-1.5 px-3 py-1.5 w-full text-[8px] font-mono cursor-pointer border-t"
        style={{ background: "rgba(245,166,35,0.03)", borderColor: "rgba(245,166,35,0.06)", color: "rgba(155,142,196,0.5)" }}>
        <Clock className="h-3 w-3" />
        <span>Session History ({persistedObs.length})</span>
        <span className="ml-auto">{showHistory ? "▲" : "▼"}</span>
      </button>

      {showHistory && (() => {
        const summary = summarizeObs(persistedObs);
        const dateGroups = groupByDate(persistedObs);
        return (
          <div className="border-t" style={{ borderColor: "rgba(245,166,35,0.06)", maxHeight: 260, overflow: "auto" }}>
            {/* Summary stats */}
            {persistedObs.length > 0 && (
              <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(245,166,35,0.06)" }}>
                <div className="text-[8px] font-mono mb-1" style={{ color: "rgba(155,142,196,0.5)" }}>FOCUS {summary.focusPct}% · DISTRACTED {summary.distractionPct}%</div>
                <div className="flex gap-2 text-[7px] font-mono">
                  <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>🎯 {summary.focusPct}%</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(245,166,35,0.12)", color: "#f5a623" }}>📱 {summary.phone}x</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>💤 {summary.sleepy}x</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(155,142,196,0.12)", color: "#a78bfa" }}>👥 {summary.visitors}x</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>🚪 {summary.absent}x</span>
                </div>
              </div>
            )}
            <div className="px-3 py-1.5 flex gap-1.5">
              <button onClick={runAnalysis} disabled={analyzing || persistedObs.length === 0}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-mono cursor-pointer"
                style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", color: "#f5a623" }}>
                <BarChart3 className="h-3 w-3" /> {analyzing ? "Analysing..." : "AI Analysis"}
              </button>
              <button onClick={clearHistory}
                className="px-2 py-1 rounded-lg text-[8px] font-mono cursor-pointer"
                style={{ background: "rgba(245,166,35,0.05)", border: "1px solid rgba(245,166,35,0.08)", color: "rgba(155,142,196,0.5)" }}>
                Clear
              </button>
            </div>
            {analysisText && (
              <div className="px-3 py-1.5 text-[8px] font-mono" style={{ color: "#f5a623", borderTop: "1px solid rgba(245,166,35,0.06)" }}>
                &gt; {analysisText}
              </div>
            )}
            <div className="px-3 py-1" style={{ maxHeight: 120, overflowY: "auto" }}>
              {persistedObs.length === 0 ? (
                <div className="text-[7px] font-mono py-2 text-center" style={{ color: "rgba(155,142,196,0.3)" }}>
                  No observations yet
                </div>
              ) : dateGroups.map((g, gi) => (
                <div key={gi}>
                  <div className="text-[7px] font-mono py-0.5 mt-1" style={{ color: "rgba(155,142,196,0.35)" }}>── {g.label} · {g.items.length} scans ──</div>
                  {g.items.map((o, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5 text-[7px] font-mono" style={{ color: "rgba(155,142,196,0.6)" }}>
                      <span style={{ color: "#f5a623", minWidth: 48 }}>{new Date(o.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="px-1 rounded" style={{
                        background: FOCUSED_STATES.has(o.state) ? "rgba(34,197,94,0.15)" :
                          o.state === "distracted_phone" || o.state === "distracted_away" || o.state === "visitors" ? "rgba(245,166,35,0.15)" :
                          o.state === "sleepy" ? "rgba(99,102,241,0.15)" : "rgba(155,142,196,0.1)",
                        color: FOCUSED_STATES.has(o.state) ? "#22c55e" :
                          o.state === "distracted_phone" || o.state === "distracted_away" || o.state === "visitors" ? "#f5a623" :
                          o.state === "sleepy" ? "#6366f1" : "rgba(155,142,196,0.5)",
                      }}>{o.state}</span>
                      <span>{o.confidence}%</span>
                      {o.speech && <span className="truncate" style={{ maxWidth: 100, color: "rgba(245,166,35,0.4)" }}>🗣️ {o.speech.slice(0, 30)}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
