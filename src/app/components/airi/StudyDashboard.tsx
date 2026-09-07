import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Flame, Monitor, AlertTriangle, Plus, Trash, Award, Loader } from "lucide-react";
import type { DistractionLog, StudyGoal, PomodoroState } from "@/types";

interface StudyDashboardProps {
  isStudyMode: boolean;
  setIsStudyMode: (v: boolean) => void;
  distractionLogs: DistractionLog[];
  onAddDistractionLog: (type: "Phone Usage" | "Social Media / Game" | "User Absence" | "Yawning / Fatigue" | "Other Person", comments: string) => void;
  speakText: (text: string) => void;
  setEmotion: (e: any) => void;
  language?: "en" | "te";
}

export default function StudyDashboard({ isStudyMode, setIsStudyMode, distractionLogs, onAddDistractionLog, speakText, setEmotion, language = "en" }: StudyDashboardProps) {
  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [stats, setStats] = useState({ cyclesCompleted: 0, totalFocusMinutes: 0, streak: 0, lastStudyDate: "" });
  const [newGoalText, setNewGoalText] = useState("");
  const [activeApp, setActiveApp] = useState("VS Code");
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [pomodoro, setPomodoro] = useState<PomodoroState>({ minutes: 25, seconds: 0, isActive: false, isBreak: false, cyclesCompleted: 0 });
  const [obsStats, setObsStats] = useState<{ todayFocusPct: number; todayMinutes: number; week: { label: string; pct: number }[] } | null>(null);
  const appList = ["VS Code", "Chrome (Docs)", "Chrome (YouTube)", "Terminal", "Minecraft"];

  useEffect(() => {
    fetch("/api/vision/observations")
      .then(r => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const focusedStates = ["focused", "reading", "writing", "thinking"];
        const now = new Date();
        const days: Date[] = [];
        for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(now.getDate() - i); days.push(d); }
        const week = days.map(d => {
          const key = d.toDateString();
          const obs = data.filter(o => new Date(o.timestamp).toDateString() === key);
          const total = Math.max(obs.length, 1);
          const focus = obs.filter(o => focusedStates.includes(o.state)).length;
          return { label: d.toLocaleDateString([], { weekday: "short" }), pct: Math.round((focus / total) * 100) };
        });
        const todayObs = data.filter(o => new Date(o.timestamp).toDateString() === now.toDateString());
        const todayTotal = Math.max(todayObs.length, 1);
        const todayFocus = todayObs.filter(o => focusedStates.includes(o.state)).length;
        setObsStats({
          todayFocusPct: Math.round((todayFocus / todayTotal) * 100),
          todayMinutes: Math.round(todayObs.length * 15 / 60),
          week,
        });
      })
      .catch(() => {});
  }, []);

  const fetchGoals = () => {
    fetch("/api/goals").then(r => r.json()).then(data => { setGoals(data); setGoalsLoading(false); }).catch(() => setGoalsLoading(false));
  };

  useEffect(() => {
    fetchGoals();
    fetch("/api/study/stats").then(r => r.json()).then(data => setStats(data)).catch(() => {});
    window.addEventListener("goals-updated", fetchGoals);
    return () => window.removeEventListener("goals-updated", fetchGoals);
  }, []);

  const syncGoals = (updated: StudyGoal[]) => {
    setGoals(updated);
    fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goals: updated }),
    }).catch(console.error);
    window.dispatchEvent(new CustomEvent("goals-updated"));
  };

  const syncStats = (updated: typeof stats) => {
    setStats(updated);
    fetch("/api/study/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch(console.error);
  };

  useEffect(() => {
    let timer: any = null;
    if (pomodoro.isActive) {
      timer = setInterval(() => {
        if (pomodoro.seconds > 0) setPomodoro(p => ({ ...p, seconds: p.seconds - 1 }));
        else if (pomodoro.minutes > 0) setPomodoro(p => ({ ...p, minutes: p.minutes - 1, seconds: 59 }));
        else {
          clearInterval(timer);
          const nextBreak = !pomodoro.isBreak;
          const newCycles = pomodoro.cyclesCompleted + (nextBreak ? 1 : 0);
          setPomodoro(p => ({ minutes: nextBreak ? 5 : 25, seconds: 0, isActive: false, isBreak: nextBreak, cyclesCompleted: newCycles }));
          syncStats({ ...stats, cyclesCompleted: newCycles, totalFocusMinutes: stats.totalFocusMinutes + 25, streak: stats.streak + 1, lastStudyDate: new Date().toISOString().split("T")[0] });
          const text = nextBreak
            ? (language === "te" ? "విరామ సమయం! 5 నిమిషాలు విశ్రాంతి తీసుకోండి." : "Break time! Take 5 minutes.")
            : (language === "te" ? "విరామం ముగిసింది! మళ్ళీ దృష్టి పెట్టండి!" : "Break over! Let's focus!");
          speakText(text);
          setEmotion(nextBreak ? "happy" : "studying");
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [pomodoro, speakText, setEmotion]);

  const handleAppChange = (app: string) => {
    setActiveApp(app);
    if (!isStudyMode) return;
    if (app.toLowerCase().includes("youtube") || app.toLowerCase().includes("minecraft")) {
      setEmotion("angry");
      speakText(language === "te" ? `నవీన్, ${app} మూసివేసి దృష్టి పెట్టు!` : `Naveen, close ${app} and focus!`);
      onAddDistractionLog("Social Media / Game", `Opened ${app}`);
    }
  };

  const addGoal = () => {
    if (!newGoalText.trim()) return;
    const updated = [...goals, { id: Date.now().toString(), title: newGoalText, completed: false }];
    syncGoals(updated);
    setNewGoalText("");
  };

  if (goalsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-6 w-6 animate-spin" style={{ color: "#f5a623" }} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 flex flex-col gap-6">
        <div className="p-5 rounded-2xl border" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"#f5a623" }}>Focus Core</span>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: isStudyMode ? "#f5a623" : "rgba(155,142,196,0.2)", boxShadow: isStudyMode ? "0 0 12px rgba(245,166,35,0.5)" : "none" }} />
          </div>
          <button onClick={() => setIsStudyMode(!isStudyMode)}
            className="w-full py-3 rounded-xl text-xs font-bold cursor-pointer"
            style={{ background: isStudyMode ? "rgba(245,166,35,0.12)" : "#f5a623", border: isStudyMode ? "1px solid rgba(245,166,35,0.25)" : "1px solid transparent", color: isStudyMode ? "#f5a623" : "#0d0f1e", fontFamily:"'M PLUS Rounded 1c', sans-serif", letterSpacing:"0.04em" }}>
            {isStudyMode ? "Deactivate Study Mode" : "Activate Study Mode"}
          </button>
        </div>

        <div className="p-5 rounded-2xl border" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
          <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", display:"block", marginBottom:"8px", color:"#f5a623" }}>Pomodoro</span>
          <div className="flex flex-col items-center justify-center py-4 rounded-xl" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
            <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"36px", fontWeight:800, letterSpacing:"0.06em", color:"#f5a623" }}>
              {String(pomodoro.minutes).padStart(2, "0")}:{String(pomodoro.seconds).padStart(2, "0")}
            </span>
            <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", letterSpacing:"0.08em", textTransform:"uppercase", marginTop:"4px", color:"rgba(155,142,196,0.5)" }}>
              {pomodoro.isBreak ? "Break" : "Focus"}
            </span>
            <div className="flex items-center gap-3.5 mt-4">
              <button onClick={() => setPomodoro(p => ({ ...p, isActive: !p.isActive }))}
                className="p-2 rounded-lg cursor-pointer" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
                {pomodoro.isActive ? <Pause className="h-4 w-4" style={{ color: "#f5a623" }} /> : <Play className="h-4 w-4" style={{ color: "#f5a623" }} />}
              </button>
              <button onClick={() => setPomodoro(p => ({ ...p, minutes: p.isBreak ? 5 : 25, seconds: 0, isActive: false }))}
                className="p-2 rounded-lg cursor-pointer" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
                <RotateCcw className="h-4 w-4" style={{ color: "rgba(155,142,196,0.5)" }} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-center">
            <div className="p-2 rounded-lg" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
              <span className="block" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"16px", fontWeight:700, color:"#f0e8d8" }}>{stats.cyclesCompleted}</span>
              <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", color:"rgba(155,142,196,0.5)" }}>Cycles</span>
            </div>
            <div className="p-2 rounded-lg flex items-center justify-center gap-1.5" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
              <Flame className="h-4 w-4" style={{ color: "#f5a623" }} />
              <div>
                <span className="block" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"16px", fontWeight:700, color:"#f0e8d8" }}>{stats.streak} Days</span>
                <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", color:"rgba(155,142,196,0.5)" }}>Streak</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl border" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
          <p className="flex items-center gap-1.5 mb-3" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"rgba(155,142,196,0.6)" }}>
            <Flame className="h-4 w-4" style={{ color: "#f5a623" }} />
            Focus Streak
          </p>
          {obsStats ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="text-center">
                  <span className="block" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"26px", fontWeight:800, color: obsStats.todayFocusPct >= 60 ? "#f5a623" : "#f59e0b" }}>{obsStats.todayFocusPct}%</span>
                  <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", color:"rgba(155,142,196,0.5)" }}>Today's Focus</span>
                </div>
                <div className="text-center">
                  <span className="block" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"26px", fontWeight:800, color:"#f0e8d8" }}>{obsStats.todayMinutes}m</span>
                  <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", color:"rgba(155,142,196,0.5)" }}>Focused (est)</span>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {obsStats.week.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center rounded" style={{ height: 40, background: "rgba(245,166,35,0.04)" }}>
                      <div style={{
                        width: "70%",
                        height: `${Math.max(d.pct, 4)}%`,
                        borderRadius: 2,
                        background: d.pct >= 60 ? "rgba(245,166,35,0.7)" : d.pct > 0 ? "rgba(245,158,11,0.6)" : "rgba(155,142,196,0.15)",
                      }} />
                    </div>
                    <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"7px", textTransform:"uppercase", color:"rgba(155,142,196,0.4)" }}>{d.label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-[10px]" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", color:"rgba(155,142,196,0.4)" }}>
              No vision data yet — enable the camera in the Vision tab.
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl border" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
          <p className="flex items-center gap-1.5 mb-3" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"rgba(155,142,196,0.6)" }}>
            <Monitor className="h-4 w-4" style={{ color: "#f5a623" }} />
            Active App
          </p>
          <div className="p-3 rounded-xl" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
            <span className="block" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"12px", color:"#f0e8d8" }}>{activeApp}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {appList.map(app => (
              <button key={app} onClick={() => handleAppChange(app)}
                className="px-1.5 py-1 border rounded text-left truncate cursor-pointer"
                style={{
                  fontFamily:"'M PLUS Rounded 1c', sans-serif",
                  fontSize:"9px",
                  background: activeApp === app ? "rgba(245,166,35,0.1)" : "#0f0c08",
                  borderColor: activeApp === app ? "rgba(245,166,35,0.25)" : "rgba(245,166,35,0.08)",
                  color: activeApp === app ? "#f5a623" : "rgba(155,142,196,0.5)"
                }}>
                {app}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1 p-5 rounded-2xl border flex flex-col justify-between" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
        <div>
          <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", display:"block", marginBottom:"14px", color:"#f5a623" }}>Goals</span>
          <div className="space-y-2.5">
            {goals.map(g => (
              <div key={g.id} className="flex items-center justify-between p-3.5 rounded-xl" style={{
                background: "#0f0c08",
                border: `1px solid rgba(245,166,35,0.08)`,
                opacity: g.completed ? 0.6 : 1
              }}>
                <div className="flex items-center gap-3 truncate">
                  <input type="checkbox" checked={g.completed} onChange={() => syncGoals(goals.map(x => x.id === g.id ? { ...x, completed: !x.completed } : x))}
                    className="h-4.5 w-4.5 cursor-pointer accent-[#f5a623]" />
                  <span className="text-xs truncate" style={{ fontFamily:"'Caveat', sans-serif", fontSize:"16px", color: g.completed ? "rgba(155,142,196,0.5)" : "#f0e8d8", textDecoration: g.completed ? "line-through" : "none" }}>{g.title}</span>
                </div>
                <button onClick={() => syncGoals(goals.filter(x => x.id !== g.id))} className="p-1 cursor-pointer" style={{ color: "rgba(224,92,110,0.6)" }}>
                  <Trash className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          <input type="text" value={newGoalText} onChange={e => setNewGoalText(e.target.value)} placeholder="Add goal..."
            className="flex-1 rounded-xl px-3 py-2.5 text-xs outline-none"
            style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)", color: "#f0e8d8", fontFamily:"'Caveat', sans-serif", fontSize:"15px" }} />
          <button onClick={addGoal}
            className="p-3 rounded-xl cursor-pointer" style={{ background: "#f5a623", color: "#0d0f1e" }}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="lg:col-span-1 p-5 rounded-2xl border" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
        <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", display:"block", marginBottom:"16px", color:"#f5a623" }}>Distraction Log</span>
        {distractionLogs.length > 0 ? (
          <div className="space-y-3 max-h-[360px] overflow-y-auto">
            {distractionLogs.map(log => (
              <div key={log.id} className="rounded-xl p-3 text-xs flex flex-col gap-1.5" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
                <div className="flex justify-between items-center" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif" }}>
                  <span className="flex items-center gap-1" style={{ fontSize:"10px", fontWeight:700, color:"#f5a623" }}>
                    <AlertTriangle className="h-3.5 w-3.5" /> {log.type}
                  </span>
                  <span style={{ fontSize:"9px", color:"rgba(155,142,196,0.5)" }}>{log.time}</span>
                </div>
                <p style={{ fontFamily:"'Caveat', sans-serif", fontSize:"15px", color:"rgba(240,232,216,0.7)" }}>{log.airiReaction}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[320px] border border-dashed rounded-xl flex flex-col items-center justify-center text-center p-6" style={{ borderColor: "rgba(245,166,35,0.08)" }}>
            <Award className="h-10 w-10 mb-2" style={{ color: "rgba(245,166,35,0.15)" }} />
            <h5 style={{ fontFamily:"'Caveat', sans-serif", fontSize:"18px", fontWeight:600, color:"rgba(200,184,240,0.8)" }}>Zero Distractions!</h5>
            <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", marginTop:"4px", color:"rgba(155,142,196,0.5)" }}>Keep it up!</p>
          </div>
        )}
      </div>
    </div>
  );
}
