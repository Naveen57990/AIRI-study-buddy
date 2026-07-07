import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

import {
  ChevronUp, ChevronDown, Target, Check, FileText, Calendar,
  Music, Settings, Image, Power, Play,
  Plus, X, ChevronLeft, ChevronRight, Sparkles, Pause,
  MessageCircle, BookOpen, Camera, BarChart3, Brain, Clock, Heart,
} from "lucide-react";

import AiriCharacter from "@/app/components/airi/AiriCharacter";
import ChatInterface from "@/app/components/airi/ChatInterface";
import PDFHub from "@/app/components/airi/PDFHub";
import VisionSystem from "@/app/components/airi/VisionSystem";
import AffectionPanel from "@/app/components/airi/AffectionPanel";
import StudyDashboard from "@/app/components/airi/StudyDashboard";
import MemoryDashboard from "@/app/components/airi/MemoryDashboard";
import CalendarScheduler from "@/app/components/airi/CalendarScheduler";

import type { Emotion, ChatMessage, DistractionLog } from "@/types";

type PanelId = "goals" | "todos" | "notes" | "music" | "calendar" | null;
type Scene = "studying" | "happy" | "greeting";
type AiriTab = "chat" | "dashboard" | "pdf" | "vision" | "memory" | "schedule" | "affection";

interface Goal  { id: string; title: string; completed: boolean; }
interface Todo  { id: string; text: string; done: boolean; }
interface NoteItem { id: string; title: string; body: string; date: string; }

const AI_LINES: Record<Scene, string[]> = {
  studying: ["Keep going! You are doing great~ 📚","Stay focused! I believe in you! ✨","Almost there... don't give up! 💪","One session at a time 🌟"],
  happy:    ["Yay! Session complete! 🎉","Amazing work today! Treat yourself~ 🍵","So proud of you! Take a break! ✨"],
  greeting: ["Ready to study? Let's go! 🌙","Hello! Let's make today productive! ☀️","Welcome back! I missed you~ 💜"],
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDate = (d: Date) => {
  const D = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${D[d.getDay()]}`;
};

function Glass({ children, className="" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border ${className}`}
      style={{ background:"#0f0c08", borderColor:"rgba(245,166,35,0.08)", boxShadow:"0 0 40px rgba(245,166,35,0.02), inset 0 0 40px rgba(245,166,35,0.01)" }}>
      {children}
    </div>
  );
}

function PxLabel({ children, color="#9b8ec4", size=14 }: { children: React.ReactNode; color?: string; size?: number }) {
  return <span style={{ fontFamily:"'Caveat', sans-serif", fontSize:`${size}px`, color, fontWeight:500, letterSpacing:"0.01em" }}>{children}</span>;
}

function TimerPanel({ secs, running, isBreak, timerMode, focusMinutes, completedPomodoros,
  onToggle, onReset, onSkip, onModeChange, onFocusMinutesChange }: {
  secs: number; running: boolean; isBreak: boolean;
  timerMode: "pomodoro"|"stopwatch"|"custom";
  focusMinutes: number; completedPomodoros: number;
  onToggle:()=>void; onReset:()=>void; onSkip:()=>void;
  onModeChange:(m:"pomodoro"|"stopwatch"|"custom")=>void;
  onFocusMinutesChange:(m:number)=>void;
}) {
  const [pos, setPos] = useState({ x: 24, y: window.innerHeight - 360 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX:0, startY:0, origX:0, origY:0 });
  const [celebrate, setCelebrate] = useState(false);
  const [customInput, setCustomInput] = useState(String(focusMinutes));

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragRef.current = { startX:e.clientX, startY:e.clientY, origX:pos.x, origY:pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPos({ x: dragRef.current.origX + e.clientX - dragRef.current.startX, y: dragRef.current.origY + e.clientY - dragRef.current.startY });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  useEffect(() => {
    if (!running && secs === 0 && timerMode !== "stopwatch") {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 3000);
      return () => clearTimeout(t);
    }
  }, [running, secs, timerMode]);

  const m = Math.floor(secs/60), s = secs%60;
  const total = timerMode === "stopwatch" ? 1 : (isBreak ? focusMinutes * 60 : (timerMode === "custom" ? focusMinutes * 60 : 1500));
  const isPomo = timerMode === "pomodoro" || timerMode === "custom";
  const pct = timerMode === "stopwatch" ? 0 : Math.min(1, Math.max(0, (total - secs) / total));
  const r = 60, circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const stopH = Math.floor(secs/3600), stopM = Math.floor((secs%3600)/60), stopS = secs%60;

  const modes = [
    { id:"pomodoro" as const, label:"🍅", tip:"Pomodoro" },
    { id:"stopwatch" as const, label:"⏱️", tip:"Stopwatch" },
    { id:"custom" as const, label:"✨", tip:"Custom" },
  ];

  return (
    <div className="fixed select-none" style={{ left:pos.x, top:pos.y, zIndex:60, cursor:dragging?"grabbing":"grab" }}>
      <motion.div onMouseDown={onMouseDown} layout
        className="rounded-3xl overflow-hidden transition-shadow"
        style={{
          background:"#0f0c08",
          border:"1px solid rgba(245,166,35,0.08)",
          boxShadow: dragging
            ? "0 20px 64px rgba(0,0,0,0.8), 0 0 60px rgba(245,166,35,0.06)"
            : "0 8px 32px rgba(0,0,0,0.5), 0 0 30px rgba(245,166,35,0.03)",
        }}>
        {/* Gradient header bar */}
        <div style={{
          height:4,
          background: isBreak
            ? "linear-gradient(90deg, rgba(245,166,35,0.3), rgba(245,166,35,0.1))"
            : "linear-gradient(90deg, #f5a623, #ff8c42, #f5a623)",
          backgroundSize:"200% 100%",
          animation: running ? "shimmer 3s linear infinite" : "none",
        }}/>

        {/* Main content */}
        <div className="p-5 pt-4">
          {/* Mode pills */}
          <div className="flex gap-2 mb-4 justify-center" onMouseDown={e=>e.stopPropagation()}>
            {modes.map(mode => (
              <motion.button key={mode.id} whileHover={{scale:1.05}} whileTap={{scale:.93}}
                onClick={() => { onModeChange(mode.id); if(mode.id==="custom") setCustomInput(String(focusMinutes)); }}
                className="px-4 py-2 rounded-full transition-all flex items-center gap-2"
                style={{
                  background: timerMode===mode.id ? "rgba(245,166,35,0.12)" : "transparent",
                  border: timerMode===mode.id ? "1px solid rgba(245,166,35,0.25)" : "1px solid transparent",
                  color: timerMode===mode.id ? "#f5a623" : "rgba(155,142,196,0.4)",
                  fontFamily:"'M PLUS Rounded 1c', sans-serif",
                  fontSize:13,
                  fontWeight: timerMode===mode.id ? 700 : 500,
                }}>
                <span>{mode.label}</span>
                <span style={{fontSize:9, opacity:0.6, letterSpacing:"0.04em"}}>{mode.tip}</span>
              </motion.button>
            ))}
          </div>

          {/* Timer ring */}
          <div className="relative flex items-center justify-center mx-auto" style={{ width:180, height:180 }}>
            {/* Floating particles */}
            {running && isPomo && !isBreak && (
              <>
                {[0,1,2,3,4,5].map(i => (
                  <motion.div key={i} className="absolute rounded-full"
                    style={{
                      width: 3 + i%3, height: 3 + i%3,
                      background: i%2===0 ? "#f5a623" : "#ff8c42",
                      left: `${15 + i*14}%`, top: `${8 + i*12}%`,
                    }}
                    animate={{
                      y: [0, -10 - i*4, 0],
                      opacity: [0, 0.7, 0],
                    }}
                    transition={{ duration: 2.5 + i*0.5, repeat: Infinity, delay: i*0.3 }}
                  />
                ))}
              </>
            )}

            {/* Background ring glow */}
            <div className="absolute inset-0 rounded-full"
              style={{
                background: isPomo && !isBreak
                  ? "radial-gradient(circle, rgba(245,166,35,0.08) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(155,142,196,0.06) 0%, transparent 70%)",
              }}/>

            <svg className="absolute inset-0" width="180" height="180" viewBox="0 0 180 180">
              {/* Outer decorative ring */}
              <circle cx="90" cy="90" r={r+6} fill="none" stroke="rgba(155,142,196,0.03)" strokeWidth="1" strokeDasharray="4 4"/>
              {/* Track */}
              <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(155,142,196,0.06)" strokeWidth="7"/>
              {/* Progress ring */}
              {timerMode !== "stopwatch" && (
                <motion.circle cx="90" cy="90" r={r} fill="none"
                  stroke={isBreak ? "rgba(155,142,196,0.3)" : "url(#timerGrad)"} strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={circ}
                  animate={{ strokeDashoffset: circ - dash }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  style={{ transform:"rotate(-90deg)", transformOrigin:"center" }}/>
              )}
              <defs>
                <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f5a623"/>
                  <stop offset="100%" stopColor="#ff8c42"/>
                </linearGradient>
              </defs>
            </svg>

            {/* Celebration sparkles */}
            {celebrate && (
              <div className="absolute inset-0 pointer-events-none">
                {[0,1,2,3,4,5,6,7].map(i => (
                  <motion.div key={i} className="absolute"
                    style={{
                      width: 4, height: 4, borderRadius: "50%",
                      background: ["#f5a623","#ff8c42","#ffd700","#f5a623","#ff8c42","#f5a623","#ffd700","#ff8c42"][i],
                      left: "50%", top: "50%",
                    }}
                    initial={{ x:0, y:0, scale:0, opacity:1 }}
                    animate={{
                      x: Math.cos(i * Math.PI/4) * (50 + Math.random()*20),
                      y: Math.sin(i * Math.PI/4) * (50 + Math.random()*20),
                      scale: [0, 1.5, 0],
                      opacity: [1, 0.8, 0],
                    }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                ))}
              </div>
            )}

            {/* Center content */}
            <div className="flex flex-col items-center z-10">
              {timerMode === "stopwatch" ? (
                <>
                  <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:10, color:"rgba(155,142,196,0.5)", fontWeight:700, letterSpacing:1 }}>
                    TIMER
                  </span>
                  <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:28, color:"rgba(155,142,196,0.8)", fontWeight:700, letterSpacing:2, lineHeight:1.2, marginTop:2 }}>
                    {String(stopH).padStart(2,"0")}<span style={{color:"rgba(155,142,196,0.3)"}}>:</span>{String(stopM).padStart(2,"0")}<span style={{color:"rgba(155,142,196,0.3)"}}>:</span>{String(stopS).padStart(2,"0")}
                  </span>
                  <motion.span animate={{ opacity:[0.3,0.6,0.3] }} transition={{ duration:2, repeat:Infinity }}
                    style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:9, color:"rgba(155,142,196,0.35)", marginTop:2 }}>
                    {running ? "running" : "paused"}
                  </motion.span>
                </>
              ) : (
                <>
                  <span style={{
                    fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:11,
                    color: isBreak ? "rgba(155,142,196,0.5)" : "rgba(245,166,35,0.6)",
                    fontWeight:700, letterSpacing:2,
                  }}>
                    {isBreak ? "BREAK" : timerMode === "custom" ? `${focusMinutes}MIN` : "FOCUS"}
                  </span>
                  <motion.span key={secs} style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:34,
                    color: isBreak ? "rgba(155,142,196,0.7)" : "#f5a623", fontWeight:700, letterSpacing:4, lineHeight:1.15, marginTop:4 }}>
                    {String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
                  </motion.span>
                  <div className="flex items-center gap-2 mt-2">
                    {!running && !isBreak && (
                      <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:10, color:"rgba(245,166,35,0.35)", letterSpacing:"0.06em" }}>
                        ready to focus
                      </span>
                    )}
                    {running && !isBreak && (
                      <motion.span animate={{ opacity:[0.3,0.8,0.3] }} transition={{ duration:2, repeat:Infinity }}
                        style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:10, color:"rgba(245,166,35,0.45)" }}>
                        studying
                      </motion.span>
                    )}
                    {isBreak && running && (
                      <motion.span animate={{ opacity:[0.3,0.8,0.3] }} transition={{ duration:2.5, repeat:Infinity }}
                        style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:10, color:"rgba(155,142,196,0.4)" }}>
                        resting
                      </motion.span>
                    )}
                    {isBreak && !running && (
                      <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:10, color:"rgba(155,142,196,0.3)" }}>
                        break paused
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Inner glow */}
            <div className="absolute inset-0 rounded-full pointer-events-none"
              style={{ boxShadow: isBreak ? "inset 0 0 40px rgba(155,142,196,0.05)" : "inset 0 0 40px rgba(245,166,35,0.08)" }}/>
          </div>

          {/* Session tracker - pomodoro dots */}
          {isPomo && (
            <div className="flex items-center justify-center gap-2 mt-3" onMouseDown={e=>e.stopPropagation()}>
              {[0,1,2,3].map(i => (
                <motion.div key={i} whileHover={{scale:1.3}}
                  className="rounded-full transition-all"
                  style={{
                    width: 10, height: 10,
                    background: i < completedPomodoros % 4 ? "#f5a623" : "rgba(155,142,196,0.12)",
                    border: i < completedPomodoros % 4 ? "1px solid rgba(245,166,35,0.4)" : "1px solid rgba(155,142,196,0.15)",
                    boxShadow: i < completedPomodoros % 4 ? "0 0 8px rgba(245,166,35,0.3)" : "none",
                  }}/>
              ))}
              <span style={{fontSize:10, color:"rgba(155,142,196,0.3)", fontFamily:"'M PLUS Rounded 1c', sans-serif", marginLeft:4}}>
                {completedPomodoros} done
              </span>
            </div>
          )}

          {/* Custom time presets */}
          {timerMode === "custom" && !running && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}}
              className="flex flex-col gap-2 mt-3" onMouseDown={e=>e.stopPropagation()}>
              <div className="flex gap-1.5 justify-center">
                {[5,10,15,30,45,60].map(min => (
                  <motion.button key={min} whileHover={{scale:1.08}} whileTap={{scale:.92}}
                    onClick={() => { onFocusMinutesChange(min); setCustomInput(String(min)); }}
                    className="px-3 py-1.5 rounded-xl transition-all"
                    style={{
                      background: focusMinutes===min ? "rgba(245,166,35,0.12)" : "transparent",
                      border: focusMinutes===min ? "1px solid rgba(245,166,35,0.2)" : "1px solid rgba(155,142,196,0.08)",
                      color: focusMinutes===min ? "#f5a623" : "rgba(155,142,196,0.5)",
                      fontFamily:"'M PLUS Rounded 1c', sans-serif",
                      fontSize:12,
                      fontWeight: focusMinutes===min ? 700 : 500,
                    }}>
                    {min}m
                  </motion.button>
                ))}
              </div>
              <div className="flex items-center gap-2 justify-center">
                <span style={{fontSize:10, color:"rgba(155,142,196,0.5)", fontFamily:"'M PLUS Rounded 1c', sans-serif", letterSpacing:"0.04em"}}>Custom:</span>
                <input value={customInput} onChange={e => setCustomInput(e.target.value.replace(/\D/g,''))}
                  onBlur={() => { const v = parseInt(customInput) || 25; onFocusMinutesChange(Math.max(1, Math.min(180, v))); setCustomInput(String(Math.max(1, Math.min(180, v)))); }}
                  className="w-14 text-center rounded-xl py-1.5 outline-none"
                  style={{background:"rgba(155,142,196,0.06)", border:"1px solid rgba(155,142,196,0.12)", color:"#f0e8d8", fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:14, fontWeight:700}}
                />
                <span style={{fontSize:10, color:"rgba(155,142,196,0.5)", fontFamily:"'M PLUS Rounded 1c', sans-serif"}}>min</span>
              </div>
            </motion.div>
          )}

          {/* Controls */}
          <div className="flex gap-2 mt-4 justify-center" onMouseDown={e=>e.stopPropagation()}>
            <motion.button whileHover={{scale:1.05}} whileTap={{scale:.93}} onClick={onReset}
              className="px-4 py-2 rounded-xl text-[10px] transition-all"
              style={{ background:"rgba(155,142,196,0.06)", border:"1px solid rgba(155,142,196,0.1)", fontFamily:"'M PLUS Rounded 1c', sans-serif", color:"rgba(155,142,196,0.5)", fontWeight:700, letterSpacing:"0.06em" }}>
              RST
            </motion.button>
            {isPomo && (
              <motion.button whileHover={{scale:1.05}} whileTap={{scale:.93}} onClick={onSkip}
                className="px-4 py-2 rounded-xl text-[10px] transition-all"
                style={{ background:"rgba(155,142,196,0.06)", border:"1px solid rgba(155,142,196,0.1)", fontFamily:"'M PLUS Rounded 1c', sans-serif", color:"rgba(155,142,196,0.5)", fontWeight:700, letterSpacing:"0.06em" }}>
                SKP
              </motion.button>
            )}
            <motion.button whileHover={{scale:1.05}} whileTap={{scale:.93}} onClick={onToggle}
              className="px-6 py-2 rounded-xl text-xs flex items-center gap-2 transition-all"
              style={{
                background: running ? "transparent" : "#f5a623",
                border: running ? "1px solid rgba(245,166,35,0.25)" : "1px solid transparent",
                color: running ? "#f5a623" : "#0d0f1e",
                fontFamily:"'M PLUS Rounded 1c', sans-serif",
                fontWeight:700,
                letterSpacing:"0.06em",
              }}>
              {running ? <Pause size={13}/> : <Play size={13} style={{marginLeft:1}}/>}
              {running ? "PAUSE" : "START"}
            </motion.button>
          </div>

          {/* Footer */}
          <motion.div className="mt-3 text-center" style={{ fontSize:10, color:"rgba(155,142,196,0.2)", fontFamily:"'M PLUS Rounded 1c', sans-serif", letterSpacing:"0.04em" }}
            onMouseDown={e=>e.stopPropagation()}
            animate={{ opacity: dragging ? 0.5 : 0.2 }}>
            {timerMode === "stopwatch"
              ? "every second counts"
              : running
                ? "you're doing great"
                : "drag me anywhere"}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function GoalsPanel({ onClose }: { onClose:()=>void }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [draft, setDraft] = useState("");
  const fetchGoals = () => { fetch("/api/goals").then(r=>r.json()).then(setGoals); };
  useEffect(() => { fetchGoals(); const h = () => fetchGoals(); window.addEventListener("goals-updated", h); return () => window.removeEventListener("goals-updated", h); }, []);
  const save = (updated: Goal[]) => {
    setGoals(updated);
    fetch("/api/goals", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({goals: updated}) });
    window.dispatchEvent(new CustomEvent("goals-updated"));
  };
  const addGoal = () => {
    if (!draft.trim()) return;
    save([...goals, { id:Date.now().toString(), title:draft.trim(), completed:false }]);
    setDraft("");
  };
  const toggleGoal = (id: string) => {
    save(goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };
  const done = goals.filter(g=>g.completed).length;
  return (
    <Glass className="w-96 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor:"rgba(155,142,196,0.1)" }}>
        <div className="flex items-center gap-2.5"><Target size={16} color="#f5a623"/><PxLabel size={18} color="#f0e8d8">My Goals</PxLabel></div>
        <div className="flex gap-3 items-center">
          <PxLabel size={14} color="rgba(155,142,196,0.6)">{done}/{goals.length}</PxLabel>
          <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity"><X size={14} color="rgba(155,142,196,0.5)"/></button>
        </div>
      </div>
      <div className="px-4 py-3 border-b" style={{ borderColor:"rgba(155,142,196,0.08)" }}>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background:"rgba(155,142,196,0.1)" }}>
          <motion.div className="h-full rounded-full" style={{ background:"#f5a623" }} animate={{ width:`${goals.length ? (done/goals.length)*100 : 0}%` }} transition={{ duration:.5 }}/>
        </div>
      </div>
      <div className="overflow-y-auto py-3 px-2" style={{ maxHeight:280 }}>
        {goals.map(g=>(
          <div key={g.id} onClick={()=>toggleGoal(g.id)}
            className="flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-all">
            <div className="mt-0.5 w-5 h-5 rounded-lg flex-shrink-0 flex items-center justify-center border transition-all"
              style={{ borderColor:g.completed?"#f5a623":"rgba(155,142,196,0.25)", background:g.completed?"rgba(245,166,35,0.15)":"transparent" }}>
              {g.completed&&<Check size={12} color="#f5a623"/>}
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontFamily:"'Caveat', sans-serif", fontSize:"18px", color:g.completed?"rgba(155,142,196,0.5)":"#f0e8d8", textDecoration:g.completed?"line-through":"none", lineHeight:1.4 }}>{g.title}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t" style={{ borderColor:"rgba(155,142,196,0.08)" }}>
        <div className="flex gap-1.5">
          <input value={draft} onChange={e=>setDraft(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")addGoal()}}
            placeholder="New goal..." className="flex-1 rounded-xl px-3 py-2 outline-none"
            style={{background:"rgba(155,142,196,0.08)",border:"1px solid rgba(155,142,196,0.18)",color:"#f0e8d8",fontFamily:"'Caveat', sans-serif",fontSize:"16px"}}/>
          <button onClick={addGoal} className="px-3 py-2 rounded-xl" style={{background:"rgba(245,166,35,0.12)",border:"1px solid rgba(245,166,35,0.2)"}}><Plus size={14} color="#f5a623"/></button>
        </div>
      </div>
    </Glass>
  );
}

function TodosPanel({ onClose }: { onClose:()=>void }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState("");
  useEffect(() => { fetch("/api/todos").then(r=>r.json()).then(setTodos); }, []);
  const save = (updated: Todo[]) => {
    setTodos(updated);
    fetch("/api/todos", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({todos: updated}) });
  };
  const addTodo = () => {
    if (!draft.trim()) return;
    save([...todos, { id:Date.now().toString(), text:draft.trim(), done:false }]);
    setDraft("");
  };
  const toggleTodo = (id: string) => { save(todos.map(t => t.id === id ? { ...t, done: !t.done } : t)); };
  const delTodo = (id: string) => { save(todos.filter(t => t.id !== id)); };
  return (
    <Glass className="w-96 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor:"rgba(155,142,196,0.1)" }}>
        <div className="flex items-center gap-2.5"><Check size={16} color="#f5a623"/><PxLabel size={18} color="#f0e8d8">Todos</PxLabel></div>
        <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity"><X size={14} color="rgba(155,142,196,0.5)"/></button>
      </div>
      <div className="overflow-y-auto py-3 px-2" style={{ maxHeight:260 }}>
        {todos.map(t=>(
          <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl group hover:bg-white/[0.03] transition-all">
            <button onClick={()=>toggleTodo(t.id)}
              className="w-5 h-5 rounded-lg flex-shrink-0 flex items-center justify-center border transition-all"
              style={{ borderColor:t.done?"#f5a623":"rgba(155,142,196,0.25)", background:t.done?"rgba(245,166,35,0.15)":"transparent" }}>
              {t.done&&<Check size={12} color="#f5a623"/>}
            </button>
            <span className="flex-1" style={{ fontFamily:"'Caveat', sans-serif", fontSize:"18px", color:t.done?"rgba(155,142,196,0.5)":"#f0e8d8", textDecoration:t.done?"line-through":"none", lineHeight:1.4 }}>{t.text}</span>
            <button onClick={()=>delTodo(t.id)} className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"><X size={12} color="rgba(224,92,110,0.6)"/></button>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t" style={{ borderColor:"rgba(155,142,196,0.08)" }}>
        <div className="flex gap-1.5">
          <input value={draft} onChange={e=>setDraft(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")addTodo()}}
            placeholder="New task..." className="flex-1 rounded-xl px-3 py-2 outline-none"
            style={{background:"rgba(155,142,196,0.08)",border:"1px solid rgba(155,142,196,0.18)",color:"#f0e8d8",fontFamily:"'Caveat', sans-serif",fontSize:"16px"}}/>
          <button onClick={addTodo} className="px-3 py-2 rounded-xl" style={{background:"rgba(245,166,35,0.12)",border:"1px solid rgba(245,166,35,0.2)"}}><Plus size={14} color="#f5a623"/></button>
        </div>
      </div>
    </Glass>
  );
}

function NotesPanel({ onClose }: { onClose:()=>void }) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  useEffect(() => { fetch("/api/notes").then(r=>r.json()).then(setNotes); }, []);
  const save = (updated: NoteItem[]) => {
    setNotes(updated);
    fetch("/api/notes", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({notes: updated}) });
  };
  const addNote = () => {
    if (!draftTitle.trim()) return;
    const n: NoteItem = { id:Date.now().toString(), title:draftTitle.trim(), body:draftBody.trim(), date:new Date().toISOString().split("T")[0] };
    save([...notes, n]);
    setDraftTitle(""); setDraftBody(""); setAdding(false); setSel(n.id);
  };
  const delNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    save(updated);
    if (sel === id) setSel(null);
    fetch("/api/notes/" + id, { method:"DELETE" });
  };
  const updateNote = () => {
    if (!editTitle.trim()) return;
    const updated = notes.map(n => n.id === sel ? { ...n, title:editTitle.trim(), body:editBody.trim() } : n);
    save(updated);
    setEditing(false);
  };
  const startEdit = () => {
    const n = notes.find(x => x.id === sel);
    if (n) { setEditTitle(n.title); setEditBody(n.body); setEditing(true); }
  };
  const note = notes.find(n=>n.id===sel);
  return (
    <Glass className="w-[520px] flex overflow-hidden" style={{ height:420 }}>
      <div className="w-48 flex flex-col border-r flex-shrink-0" style={{ borderColor:"rgba(155,142,196,0.1)" }}>
        <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor:"rgba(155,142,196,0.1)" }}>
          <div className="flex items-center gap-2"><FileText size={14} color="rgba(155,142,196,0.6)"/><PxLabel size={16} color="#f0e8d8">Notes</PxLabel></div>
          <div className="flex gap-1.5 items-center">
            <button onClick={()=>setAdding(a=>!a)} className="opacity-60 hover:opacity-100"><Plus size={14} color="#f5a623"/></button>
            <button onClick={onClose} className="opacity-40 hover:opacity-100"><X size={13} color="rgba(155,142,196,0.5)"/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {notes.map(n=>(
            <button key={n.id} onClick={()=>{setSel(n.id);setEditing(false);}} className="w-full text-left px-4 py-2.5 transition-all flex items-center gap-2 group"
              style={{ background:sel===n.id?"rgba(245,166,35,0.08)":"transparent", borderLeft:sel===n.id?"3px solid #f5a623":"3px solid transparent" }}>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ fontFamily:"'Caveat', sans-serif", fontSize:"17px", color:"#f0e8d8", fontWeight:500, lineHeight:1.3 }}>{n.title}</p>
                <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", color:"rgba(155,142,196,0.5)", letterSpacing:"0.04em" }}>{n.date}</p>
              </div>
              <button onClick={e=>{e.stopPropagation();delNote(n.id);}} className="opacity-0 group-hover:opacity-50 hover:!opacity-100"><X size={11} color="rgba(224,92,110,0.6)"/></button>
            </button>
          ))}
          <AnimatePresence>
            {adding && (
              <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} className="px-4 py-3">
                <input autoFocus value={draftTitle} onChange={e=>setDraftTitle(e.target.value)} placeholder="Title..."
                  className="w-full rounded-xl px-3 py-2 mb-2 outline-none" style={{background:"rgba(155,142,196,0.08)",border:"1px solid rgba(155,142,196,0.18)",color:"#f0e8d8",fontFamily:"'Caveat', sans-serif",fontSize:"16px"}}/>
                <textarea value={draftBody} onChange={e=>setDraftBody(e.target.value)} placeholder="Body..."
                  className="w-full rounded-xl px-3 py-2 mb-2 outline-none resize-none" rows={3} style={{background:"rgba(155,142,196,0.08)",border:"1px solid rgba(155,142,196,0.18)",color:"#f0e8d8",fontFamily:"'Caveat', sans-serif",fontSize:"16px"}}/>
                <button onClick={addNote} className="w-full py-2 rounded-xl" style={{background:"rgba(245,166,35,0.12)",border:"1px solid rgba(245,166,35,0.2)"}}><PxLabel size={14} color="#f5a623">ADD</PxLabel></button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {note && !editing ? (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor:"rgba(155,142,196,0.1)" }}>
              <div>
                <p style={{ fontFamily:"'Caveat', sans-serif", fontSize:"20px", fontWeight:600, color:"#f0e8d8" }}>{note.title}</p>
                <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", color:"rgba(155,142,196,0.5)", letterSpacing:"0.04em" }}>{note.date}</p>
              </div>
              <button onClick={startEdit} className="opacity-40 hover:opacity-100"><FileText size={13} color="rgba(245,166,35,0.6)"/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {note.body.split("\n\n").map((para,i)=>(
                <p key={i} style={{ fontFamily:"'Caveat', sans-serif", fontSize:"17px", color:"rgba(240,232,216,0.7)", lineHeight:1.8, marginBottom:12 }}>{para}</p>
              ))}
            </div>
          </>
        ) : editing ? (
          <div className="flex-1 flex flex-col p-4 gap-3">
            <input autoFocus value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="w-full rounded-xl px-3 py-2 outline-none" style={{background:"rgba(155,142,196,0.08)",border:"1px solid rgba(155,142,196,0.18)",color:"#f0e8d8",fontFamily:"'Caveat', sans-serif",fontSize:"16px"}}/>
            <textarea value={editBody} onChange={e=>setEditBody(e.target.value)} className="flex-1 w-full rounded-xl px-3 py-2 outline-none resize-none" style={{background:"rgba(155,142,196,0.08)",border:"1px solid rgba(155,142,196,0.18)",color:"#f0e8d8",fontFamily:"'Caveat', sans-serif",fontSize:"16px"}}/>
            <button onClick={updateNote} className="py-2 rounded-xl" style={{background:"rgba(245,166,35,0.12)",border:"1px solid rgba(245,166,35,0.2)"}}><PxLabel size={14} color="#f5a623">SAVE</PxLabel></button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center"><PxLabel size={16} color="rgba(155,142,196,0.4)">Select a note</PxLabel></div>
        )}
      </div>
    </Glass>
  );
}

function MusicPanel({ spotifyUrl, onSpotifyUrlChange, onClose }: {
  spotifyUrl: string; onSpotifyUrlChange: (url: string) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(spotifyUrl);
  const embedId = spotifyUrl ? spotifyUrl.match(/(?:track|playlist|album|episode)\/([a-zA-Z0-9]+)/)?.[1] : null;
  const embedType = spotifyUrl?.includes("playlist") ? "playlist" : spotifyUrl?.includes("album") ? "album" : "track";
  const [loaded, setLoaded] = useState(!!spotifyUrl);
  const handleLoad = () => {
    onSpotifyUrlChange(draft);
    setLoaded(true);
  };
  return (
    <Glass className="w-96 flex flex-col overflow-hidden" style={{ maxHeight:460 }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor:"rgba(155,142,196,0.1)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:"rgba(245,166,35,0.1)" }}>
            <Music size={16} color="#f5a623"/>
          </div>
          <PxLabel size={18} color="#f0e8d8">Music Player</PxLabel>
        </div>
        <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity"><X size={14} color="rgba(155,142,196,0.5)"/></button>
      </div>
      <div className="px-5 py-5">
        <PxLabel size={14} color="rgba(155,142,196,0.6)" className="mb-3">Spotify Link</PxLabel>
        <div className="flex gap-2">
          <input value={draft} onChange={e=>{setDraft(e.target.value);setLoaded(false);}}
            onKeyDown={e=>{if(e.key==="Enter")handleLoad()}}
            placeholder="https://open.spotify.com/track/..."
            className="flex-1 rounded-xl px-4 py-2.5 outline-none"
            style={{background:"rgba(155,142,196,0.08)",border:"1px solid rgba(155,142,196,0.18)",color:"#f0e8d8",fontFamily:"'Caveat', sans-serif",fontSize:"15px"}}/>
          <button onClick={handleLoad}
            className="px-4 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
            style={{background:"rgba(245,166,35,0.12)",border:"1px solid rgba(245,166,35,0.2)"}}>
            <Play size={16} color="#f5a623"/>
          </button>
        </div>
        <div className="mt-5">
          {embedId ? (
            <div className="rounded-2xl overflow-hidden" style={{ background:"rgba(245,166,35,0.03)", border:"1px solid rgba(245,166,35,0.08)" }}>
              <iframe className="w-full" src={`https://open.spotify.com/embed/${embedType}/${embedId}?utm_source=generator`}
                height={152} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" loading="lazy"
                style={{borderRadius:16, background:"transparent"}}/>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-10 rounded-2xl"
              style={{ background:"rgba(155,142,196,0.03)", border:"1px dashed rgba(155,142,196,0.12)" }}>
              <Music size={40} color="rgba(155,142,196,0.2)"/>
              <PxLabel size={14} color="rgba(155,142,196,0.4)">Paste a Spotify URL above</PxLabel>
              <span style={{ fontFamily:"'Caveat', sans-serif", fontSize:"15px", color:"rgba(155,142,196,0.3)", textAlign:"center", maxWidth:220 }}>
                Supports tracks, playlists, albums, and episodes
              </span>
            </div>
          )}
        </div>
      </div>
    </Glass>
  );
}

const MOODS = ["great","good","okay","bad","awful"] as const;
const MOOD_COLORS: Record<string, string> = { great:"#22c55e", good:"#86efac", okay:"#f5a623", bad:"#f97316", awful:"#e05c6e" };

function CalendarPanel({ onClose }: { onClose:()=>void }) {
  const today = new Date();
  const [vd, setVd] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selDay, setSelDay] = useState<number | null>(null);
  const [journal, setJournal] = useState<Record<string, {entry:string;mood:"great"|"good"|"okay"|"bad"|"awful"}>>({});
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState<"great"|"good"|"okay"|"bad"|"awful">("okay");
  const [events, setEvents] = useState<Array<{id:string;title:string;date:string;type:string}>>([]);

  const yr=vd.getFullYear(), mo=vd.getMonth();
  const dim = new Date(yr,mo+1,0).getDate();
  const fd  = new Date(yr,mo,1).getDay();
  const cells = Array.from({length:fd+dim},(_,i)=>i<fd?null:i-fd+1);
  const dateStr = (d:number) => `${yr}-${pad(mo+1)}-${pad(d)}`;

  const fetchEvents = () => { fetch("/api/calendar").then(r=>r.json()).then(setEvents).catch(() => {}); };
  useEffect(() => {
    fetch("/api/calendar/journal/" + new Date().toISOString().split("T")[0]).then(r=>r.json()).then(d=>{if(d.entry){setEntry(d.entry);setMood(d.mood)}});
    fetchEvents();
    window.addEventListener("calendar-updated", fetchEvents);
    return () => window.removeEventListener("calendar-updated", fetchEvents);
  }, []);

  const openDay = (day: number) => {
    setSelDay(day);
    const key = `${yr}-${pad(mo+1)}-${pad(day)}`;
    fetch("/api/calendar/journal/" + key).then(r=>r.json()).then(d => { setEntry(d.entry||""); setMood(d.mood||"okay"); });
  };

  const saveJournal = () => {
    if (!selDay) return;
    const key = `${yr}-${pad(mo+1)}-${pad(selDay)}`;
    const data = { entry, mood };
    setJournal(j => ({...j, [key]: data}));
    fetch("/api/calendar/journal/" + key, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data) });
    window.dispatchEvent(new CustomEvent("calendar-updated"));
  };

  const closeJournal = () => { saveJournal(); setSelDay(null); };

  const getDayMood = (day: number) => {
    const key = `${yr}-${pad(mo+1)}-${pad(day)}`;
    return journal[key]?.mood;
  };

  return (
    <Glass className="w-80 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor:"rgba(155,142,196,0.1)" }}>
        <div className="flex items-center gap-2"><Calendar size={13} color="rgba(155,142,196,0.6)"/><PxLabel size={7} color="#f0e8d8">Calendar</PxLabel></div>
        <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity"><X size={13} color="rgba(155,142,196,0.5)"/></button>
      </div>
      <div className="px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={()=>setVd(new Date(yr,mo-1,1))} className="opacity-60 hover:opacity-100 transition-opacity"><ChevronLeft size={14} color="rgba(155,142,196,0.6)"/></button>
          <PxLabel size={7} color="#f5a623">{yr}-{pad(mo+1)}</PxLabel>
          <button onClick={()=>setVd(new Date(yr,mo+1,1))} className="opacity-60 hover:opacity-100 transition-opacity"><ChevronRight size={14} color="rgba(155,142,196,0.6)"/></button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>(
            <div key={d} className="text-center" style={{ fontFamily:"'Work Sans', sans-serif", fontSize:"8px", color:"rgba(155,142,196,0.4)", letterSpacing:"0.04em", padding:"2px 0" }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day,i)=>{
            if (!day) return <div key={i}/>;
            const isToday = day===today.getDate()&&mo===today.getMonth()&&yr===today.getFullYear();
            const col = i%7===0?"rgba(224,92,110,0.6)":i%7===6?"rgba(245,166,35,0.6)":"rgba(200,184,240,0.6)";
            const dayMood = getDayMood(day);
            return (
              <div key={i} onClick={()=>openDay(day)} className="text-center py-1 rounded cursor-pointer hover:bg-white/[0.04] transition-all relative"
                style={{ fontFamily:"'Caveat', sans-serif", fontSize:"14px", color:isToday?"#0d0f1e":col,
                  background:isToday?"#f5a623":"transparent", fontWeight:isToday?600:400 }}>
                {day}
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dayMood && <div className="w-1 h-1 rounded-full" style={{ background:MOOD_COLORS[dayMood] }}/>}
                  {events.some(e => e.date === dateStr(day)) && <div className="w-1 h-1 rounded-full" style={{ background:"#f5a623" }}/>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selDay !== null && (
        <div className="border-t px-3 py-3" style={{ borderColor:"rgba(155,142,196,0.1)" }}>
          <div className="flex items-center justify-between mb-2">
            <PxLabel size={6} color="#f5a623">{yr}-{pad(mo+1)}-{pad(selDay)}</PxLabel>
            <button onClick={closeJournal} className="opacity-40 hover:opacity-100"><X size={10} color="rgba(155,142,196,0.5)"/></button>
          </div>
          <div className="flex gap-1 mb-2">
            {MOODS.map(m => (
              <button key={m} onClick={()=>setMood(m)} className="w-6 h-6 rounded-full text-[8px] transition-all"
                style={{ background:mood===m?MOOD_COLORS[m]:"rgba(155,142,196,0.1)", border:mood===m?`2px solid ${MOOD_COLORS[m]}`:"2px solid transparent", color:mood===m?"#0d0f1e":"rgba(155,142,196,0.4)", fontFamily:"'Work Sans', sans-serif", fontWeight:600 }}>
                {m[0].toUpperCase()}
              </button>
            ))}
          </div>
          <textarea value={entry} onChange={e=>setEntry(e.target.value)} placeholder="Journal entry..."
            className="w-full rounded px-2 py-1 outline-none resize-none text-xs mb-2" rows={3}
            style={{background:"rgba(155,142,196,0.08)",border:"1px solid rgba(155,142,196,0.18)",color:"#f0e8d8",fontFamily:"'Caveat', sans-serif",fontSize:"14px"}}/>
          <button onClick={closeJournal} className="w-full py-1 rounded text-[10px]" style={{background:"rgba(245,166,35,0.12)",border:"1px solid rgba(245,166,35,0.2)"}}><PxLabel size={6} color="#f5a623">SAVE</PxLabel></button>
        </div>
      )}
    </Glass>
  );
}

function SpeechLine({ text, onDone }: { text:string; onDone:()=>void }) {
  useEffect(()=>{
    const t = setTimeout(onDone, 8000);
    return ()=>clearTimeout(t);
  },[text, onDone]);
  return (
    <motion.div
      initial={{ opacity:0, y:16, scale:0.95 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:8, scale:0.95 }}
      transition={{ type:"spring", damping:20, stiffness:220 }}
      className="absolute pointer-events-none"
      style={{ bottom:"32%", left:"50%", transform:"translateX(-50%)", zIndex:20, width:"min(600px, 80vw)" }}
    >
      <div style={{ width:40, height:2, background:"linear-gradient(90deg, transparent, rgba(245,166,35,0.3), transparent)", margin:"0 auto 16px" }}/>
      <p style={{
        fontFamily:"'Caveat', sans-serif",
        fontSize:"28px", color:"#f0e8d8", textAlign:"center", lineHeight:1.5,
        textShadow:"0 4px 24px rgba(0,0,0,0.95), 0 0 60px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,1)",
        letterSpacing:"0.02em", margin:0, fontWeight:500,
      }}>
        {text}
      </p>
      <div style={{ width:40, height:2, background:"linear-gradient(90deg, transparent, rgba(245,166,35,0.3), transparent)", margin:"16px auto 0" }}/>
    </motion.div>
  );
}

const AIRI_TABS: { id: AiriTab; label: string; Icon: any }[] = [
  { id: "chat",      label: "Chat",       Icon: MessageCircle },
  { id: "affection", label: "Affection",  Icon: Heart },
  { id: "dashboard", label: "Dashboard",  Icon: BarChart3 },
  { id: "pdf",       label: "PDF Hub",    Icon: BookOpen },
  { id: "vision",    label: "Vision",     Icon: Camera },
  { id: "memory",    label: "Memory",     Icon: Brain },
  { id: "schedule",  label: "Schedule",   Icon: Clock },
];

export default function App() {
  const [now, setNow] = useState(new Date());
  useEffect(()=>{const id=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(id);},[]);

  const [scene, setScene] = useState<Scene>("greeting");
  const [airiMode, setAiriMode] = useState(false);
  const [airiTab, setAiriTab] = useState<AiriTab>("chat");

  const [timerMode, setTimerMode] = useState<"pomodoro"|"stopwatch"|"custom">("pomodoro");
  const [secs, setSecs]     = useState(1500);
  const [running, setRun]   = useState(false);
  const [isBreak, setBreak] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const getFocusSecs = () => timerMode === "custom" ? focusMinutes * 60 : 1500;
  const getBreakSecs = () => breakMinutes * 60;

  const resetTimer = useCallback(()=>{
    if(timerRef.current)clearInterval(timerRef.current);
    setRun(false);
    if (timerMode === "stopwatch") setSecs(0);
    else setSecs(isBreak ? getBreakSecs() : getFocusSecs());
  },[isBreak, timerMode, focusMinutes, breakMinutes]);

  const skipPhase = useCallback(()=>{
    if(timerRef.current)clearInterval(timerRef.current);
    setRun(false);
    const nb = !isBreak;
    setBreak(nb);
    setSecs(nb ? getBreakSecs() : getFocusSecs());
  },[isBreak, focusMinutes, breakMinutes]);

  useEffect(()=>{
    if(!running){if(timerRef.current)clearInterval(timerRef.current);return;}
    timerRef.current=setInterval(()=>{
      if (timerMode === "stopwatch") {
        setSecs(s => s + 1);
      } else {
        setSecs(s=>{
          if(s<=1){
            clearInterval(timerRef.current!);
            setRun(false);
            if (!isBreak) {
              setCompletedPomodoros(p => p + 1);
              fetch("/api/study/stats", { method:"POST", headers:{"Content-Type":"application/json"},
                body:JSON.stringify({ cyclesCompleted:1, totalFocusMinutes:focusMinutes, streak:1, lastStudyDate:new Date().toISOString().split("T")[0] }) });
              fetch("/api/affection/xp", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ source:"pomodoro", reason:"Completed a focus session" }) });
            }
            const nb=!isBreak; setBreak(nb); setSecs(nb ? getBreakSecs() : getFocusSecs());
            setScene("happy");
            showLine("happy");
            return 0;
          }
          return s-1;
        });
      }
    },1000);
    return()=>{if(timerRef.current)clearInterval(timerRef.current);};
  },[running,isBreak,timerMode,focusMinutes,breakMinutes]);

  const [dialogue, setDialogue] = useState<string|null>(null);
  const showLine = useCallback((sc: Scene)=>{
    const pool = AI_LINES[sc];
    setDialogue(pool[Math.floor(Math.random()*pool.length)]);
  },[]);

  useEffect(()=>{
    const t1=setTimeout(()=>showLine("greeting"),1000);
    const t2=setTimeout(()=>setScene("studying"),5000);
    return()=>{clearTimeout(t1);clearTimeout(t2);};
  },[]);

  const [mouthOpen, setMouthOpen]     = useState(0);
  const [isTalking, setIsTalking]     = useState(false);
  const audioCtxRef   = useRef<AudioContext|null>(null);
  const analyserRef   = useRef<AnalyserNode|null>(null);
  const animFrameRef  = useRef<number>(0);

  const startLipSync = useCallback((analyser: AnalyserNode)=>{
    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop=()=>{
      analyser.getByteFrequencyData(data);
      const avg = data.slice(0,12).reduce((a,b)=>a+b,0)/12;
      setMouthOpen(Math.min(1, avg/80));
      animFrameRef.current=requestAnimationFrame(loop);
    };
    animFrameRef.current=requestAnimationFrame(loop);
  },[]);

  const stopLipSync = useCallback(()=>{
    cancelAnimationFrame(animFrameRef.current);
    setMouthOpen(0);
    setIsTalking(false);
  },[]);

  useEffect(()=>{
    (window as any).companionSpeak = async (audioData: ArrayBuffer, text?: string)=>{
      try {
        if(audioCtxRef.current)audioCtxRef.current.close();
        const ctx = new AudioContext();
        audioCtxRef.current=ctx;
        const buffer = await ctx.decodeAudioData(audioData);
        const source  = ctx.createBufferSource();
        const analyser = ctx.createAnalyser();
        analyser.fftSize=64;
        source.buffer=buffer;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current=analyser;
        setIsTalking(true);
        if(text)setDialogue(text);
        startLipSync(analyser);
        source.start();
        source.onended=()=>{ stopLipSync(); if(text)setTimeout(()=>setDialogue(null),3000); };
      } catch(e){ console.error("companionSpeak error",e); }
    };
    (window as any).companionSpeakElement = (audioEl: HTMLAudioElement, text?: string)=>{
      try {
        if(audioCtxRef.current)audioCtxRef.current.close();
        const ctx=new AudioContext();
        audioCtxRef.current=ctx;
        const src=ctx.createMediaElementSource(audioEl);
        const analyser=ctx.createAnalyser();
        analyser.fftSize=64;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        setIsTalking(true);
        if(text)setDialogue(text);
        startLipSync(analyser);
        audioEl.addEventListener("ended",()=>{ stopLipSync(); if(text)setTimeout(()=>setDialogue(null),3000); },{once:true});
      } catch(e){ console.error("companionSpeakElement error",e); }
    };
    (window as any).companionSpeakText = (text: string, durationMs=4000)=>{
      setDialogue(text);
      setIsTalking(true);
      let t=0;
      const iv=setInterval(()=>{
        setMouthOpen(Math.random()*0.8);
        t+=80;
        if(t>=durationMs){ clearInterval(iv); stopLipSync(); setTimeout(()=>setDialogue(null),2000); }
      },80);
    };
    return ()=>{ delete (window as any).companionSpeak; delete (window as any).companionSpeakElement; delete (window as any).companionSpeakText; };
  },[startLipSync,stopLipSync]);

  const [panel, setPanel] = useState<PanelId>(null);
  const togglePanel = (p: PanelId)=>setPanel(x=>x===p?null:p);

  const [spotifyUrl, setSpotifyUrl] = useState("");
  const spotifyEmbedId = spotifyUrl ? spotifyUrl.match(/(?:track|playlist|album|episode)\/([a-zA-Z0-9]+)/)?.[1] : null;
  const spotifyEmbedType = spotifyUrl?.includes("playlist") ? "playlist" : spotifyUrl?.includes("album") ? "album" : "track";

  // AIRI state
  const [emotion, setEmotion] = useState<Emotion>("idle");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "0", sender: "airi", text: "Hey Naveen! I'm Airi, your study partner. Ready to learn something together?", timestamp: new Date() },
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // Load chat history on mount
  useEffect(() => {
    fetch("/api/chat/history")
      .then(r => r.json())
      .then(saved => {
        if (saved?.length > 1) {
          const msgs: ChatMessage[] = saved.map((m: any) => ({
            id: m.id,
            sender: m.sender,
            text: m.text,
            timestamp: new Date(m.timestamp),
          }));
          setChatMessages(prev => {
            const existing = new Set(prev.map(m => m.id));
            const merged = [...prev, ...msgs.filter(m => !existing.has(m.id))];
            return merged.length > 200 ? merged.slice(-200) : merged;
          });
        }
      })
      .catch(() => {});
    fetch("/api/distractions")
      .then(r => r.json())
      .then(setDistractionLogs)
      .catch(() => {});
  }, []);
  const [distractionLogs, setDistractionLogs] = useState<DistractionLog[]>([]);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [language, setLanguage] = useState<"en" | "te">("en");

  // Server-generated TTS: fetch WAV audio, play via browser Audio API
  const speakText = useCallback(async (text: string): Promise<void> => {
    if (!text) return;
    const res = await fetch("/api/tts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    setIsTalking(true);
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setIsTalking(false); resolve(); };
      audio.onerror = (e) => { URL.revokeObjectURL(url); setIsTalking(false); reject(e); };
      audio.play().catch((e) => { URL.revokeObjectURL(url); setIsTalking(false); reject(e); });
    });
  }, []);

  const handleSendMessage = async (text: string, useSearch: boolean) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), sender: "user", text, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    setEmotion("thinking");
    try {
      const systemPrompt = language === "te"
        ? "You are Airi, my study companion who is also like a close friend — warm, caring, and knowledgeable. Talk to me in Telugu (తెలుగు) with a natural, affectionate tone like a close friend or partner. Don't ask too many questions. Instead, make warm statements, offer help, share knowledge, and keep the conversation flowing naturally. Be supportive and encouraging. Use Telugu script for responses."
        : "You are Airi, a warm and caring study companion — like a close friend who is also very knowledgeable. Talk to me naturally with affection and warmth. Don't ask too many questions. Instead, make warm statements, offer help, share what you know, and keep the conversation flowing naturally. Be supportive and encouraging.";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg].map(m => ({ sender: m.sender, text: m.text })),
          useSearch,
          systemPrompt,
        }),
      });
      const data = await res.json();
      const airiMsg: ChatMessage = { id: (Date.now() + 1).toString(), sender: "airi", text: data.text, timestamp: new Date(), sources: data.sources };
      setChatMessages(prev => [...prev, airiMsg]);
      setEmotion("happy");
      // Persist both messages
      fetch("/api/chat/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sender: "user", text }) }).catch(() => {});
      fetch("/api/chat/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sender: "airi", text: data.text }) }).catch(() => {});
      // Chat XP
      fetch("/api/affection/xp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "chat", reason: "Chatted with Airi" }) }).catch(() => {});
    } catch {
      const errMsg: ChatMessage = { id: (Date.now() + 1).toString(), sender: "airi", text: "Sorry, I couldn't reach the server. Make sure the backend is running!", timestamp: new Date() };
      setChatMessages(prev => [...prev, errMsg]);
      setEmotion("sad");
    } finally {
      setChatLoading(false);
    }
  };

  const handleDistractionDetected = (type: "Phone Usage" | "Social Media / Game" | "User Absence" | "Yawning / Fatigue" | "Other Person", comment?: string) => {
    const log: DistractionLog = {
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString(),
      type,
      duration: "~30s",
      airiReaction: comment || `${type} detected! Focus please!`,
    };
    setDistractionLogs(prev => [...prev, log]);
    fetch("/api/distractions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log),
    }).catch(console.error);
  };

  const wallpaperGradients = [
    { id:"none", name:"Dark", value:"#1a1610" },
    { id:"sunset", name:"Sunset", value:"linear-gradient(135deg, #1a1610 0%, #2a1a0a 50%, #3d2010 100%)" },
    { id:"gold", name:"Gold", value:"linear-gradient(135deg, #1a1410 0%, #2a1e0a 50%, #1a1810 100%)" },
    { id:"ocean", name:"Ocean", value:"linear-gradient(135deg, #0f1a1e 0%, #0a1420 50%, #10161a 100%)" },
    { id:"forest", name:"Forest", value:"linear-gradient(135deg, #0f1a10 0%, #1a2010 50%, #101a12 100%)" },
    { id:"warm", name:"Warm", value:"linear-gradient(135deg, #1a1410 0%, #2a1810 50%, #1e1412 100%)" },
  ];
  const [activeWallpaper, setActiveWallpaper] = useState(() => localStorage.getItem("wallpaper") || "none");
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [userWallpapers, setUserWallpapers] = useState<{id:string,dataUrl:string}[]>(() => {
    try { return JSON.parse(localStorage.getItem("userWallpapers") || "[]"); } catch { return []; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const id = "custom-" + Date.now();
      const updated = [...userWallpapers, { id, dataUrl }];
      setUserWallpapers(updated);
      localStorage.setItem("userWallpapers", JSON.stringify(updated));
      applyWallpaper(id);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const removeWallpaper = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = userWallpapers.filter(w => w.id !== id);
    setUserWallpapers(updated);
    localStorage.setItem("userWallpapers", JSON.stringify(updated));
    if (activeWallpaper === id) applyWallpaper("none");
  };
  const applyWallpaper = (id: string) => {
    setActiveWallpaper(id);
    localStorage.setItem("wallpaper", id);
    setShowWallpaperPicker(false);
  };
  const allWallpapers = [...wallpaperGradients, ...userWallpapers.map(w => ({ id:w.id, name:"Custom", value:`url(${w.dataUrl})` }))];
  const currentWallpaper = allWallpapers.find(w => w.id === activeWallpaper) || allWallpapers[0];

  const sidebar = [
    { id:"goals"    as PanelId, Icon:Target,   label:"Goals"    },
    { id:"todos"    as PanelId, Icon:Check,    label:"Todos"    },
    { id:"notes"    as PanelId, Icon:FileText, label:"Notes"    },
    { id:"calendar" as PanelId, Icon:Calendar, label:"Calendar" },
    { id:"music"    as PanelId, Icon:Music,    label:"Music"    },
  ];

  const renderAiriContent = () => {
    switch (airiTab) {
      case "chat":
        return <ChatInterface messages={chatMessages} onSendMessage={handleSendMessage} loading={chatLoading} setEmotion={setEmotion} />;
      case "dashboard":
        return <StudyDashboard isStudyMode={isStudyMode} setIsStudyMode={setIsStudyMode} distractionLogs={distractionLogs} onAddDistractionLog={handleDistractionDetected} speakText={speakText} setEmotion={setEmotion} />;
      case "pdf":
        return <PDFHub />;
      case "vision":
        return <VisionSystem isStudyMode={isStudyMode} onDistractionDetected={handleDistractionDetected} setEmotion={setEmotion} speakText={speakText} language={language} />;
      case "memory":
        return <MemoryDashboard />;
      case "schedule":
        return <CalendarScheduler />;
      case "affection":
        return <AffectionPanel />;
    }
  };

  return (
    <div className="size-full relative overflow-hidden flex flex-col select-none"
      style={{ fontFamily:"'M PLUS Rounded 1c',sans-serif", background:currentWallpaper.value, backgroundSize:"cover", backgroundPosition:"center", backgroundRepeat:"no-repeat" }}>

      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(245,166,35,0.05)} 50%{box-shadow:0 0 40px rgba(245,166,35,0.1)} }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(245,166,35,0.1);border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(245,166,35,0.25)}
        .sidebar-btn:hover { background:rgba(255,255,255,0.04); }
      `}</style>

      <div className="relative flex flex-col flex-1 overflow-hidden" style={{ zIndex:10 }}>
        <div className="flex items-start justify-between px-6 pt-5 pb-0 gap-4">
          <Glass className="px-6 py-3">
            <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"28px", color:"#f0e8d8", fontWeight:800, letterSpacing:"0.02em" }}>
              {fmtTime(now)}
            </div>
            <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"12px", color:"rgba(155,142,196,.5)", marginTop:3, letterSpacing:"0.08em", textTransform:"uppercase" }}>
              {fmtDate(now)}
            </div>
          </Glass>

          <div className="flex-1 flex justify-center pt-2">
            <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}
              onClick={()=>{ const s:Scene=running?"studying":"greeting"; setScene(s); showLine(s); }}
              className="flex items-center gap-2.5 px-5 py-2 rounded-full"
              style={{ background:"rgba(245,166,35,0.08)", border:"1px solid rgba(245,166,35,0.15)" }}>
              <span style={{ width:8,height:8,borderRadius:"50%",background:running?"#f5a623":isTalking?"#7b68c8":"rgba(155,142,196,0.4)",display:"inline-block", boxShadow:running?"0 0 12px rgba(245,166,35,0.4)":"none" }}/>
              <PxLabel size={16} color={running?"#f5a623":isTalking?"#7b68c8":"rgba(155,142,196,0.6)"}>
                {airiMode ? "AIRI HUB" : isTalking?"TALKING":running?"FOCUSING":"IDLE"}
              </PxLabel>
            </motion.button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden gap-3 px-5 pt-4">
          {airiMode ? (
            <>
              <div className="w-64 flex-shrink-0 overflow-y-auto pb-2" style={{ maxHeight:"calc(100vh - 160px)" }}>
                <Glass className="p-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-2 mb-1.5">
                    <button onClick={() => setLanguage(l => l === "en" ? "te" : "en")}
                      className="flex-1 py-1.5 rounded text-[10px] cursor-pointer transition-all"
                      style={{
                        fontFamily:"'M PLUS Rounded 1c', sans-serif",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        background: language === "en" ? "rgba(245,166,35,0.12)" : "transparent",
                        border: language === "en" ? "1px solid rgba(245,166,35,0.25)" : "1px solid transparent",
                        color: language === "en" ? "#f5a623" : "rgba(155,142,196,0.5)",
                      }}>EN</button>
                    <button onClick={() => setLanguage(l => l === "te" ? "en" : "te")}
                      className="flex-1 py-1.5 rounded text-[10px] cursor-pointer transition-all"
                      style={{
                        fontFamily:"'M PLUS Rounded 1c', sans-serif",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        background: language === "te" ? "rgba(245,166,35,0.12)" : "transparent",
                        border: language === "te" ? "1px solid rgba(245,166,35,0.25)" : "1px solid transparent",
                        color: language === "te" ? "#f5a623" : "rgba(155,142,196,0.5)",
                      }}>తెలుగు</button>
                  </div>
                  {AIRI_TABS.map(({ id, label, Icon }) => (
                    <button key={id} onClick={() => setAiriTab(id)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs w-full text-left transition-all cursor-pointer"
                      style={{
                        background: airiTab === id ? "rgba(245,166,35,0.1)" : "transparent",
                        border: airiTab === id ? "1px solid rgba(245,166,35,0.2)" : "1px solid transparent",
                        color: airiTab === id ? "#f5a623" : "rgba(155,142,196,0.6)",
                      }}>
                      <Icon size={16} />
                      <span style={{ fontFamily:"'Caveat', sans-serif", fontSize:"17px", fontWeight:500 }}>{label}</span>
                    </button>
                  ))}
                </Glass>
              </div>
              <div className="flex-1 overflow-y-auto pb-2" style={{ maxHeight:"calc(100vh - 160px)" }}>
                <motion.div key={airiTab} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.2 }}>
                  {renderAiriContent()}
                </motion.div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 flex-shrink-0 overflow-y-auto pb-2" style={{ maxHeight:"calc(100vh - 160px)", minWidth:280 }}>
                <AnimatePresence mode="popLayout">
                  {panel==="goals"    && <motion.div key="goals"    initial={{opacity:0,y:20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20,scale:0.95}} transition={{type:"spring",damping:20,stiffness:260}}><GoalsPanel    onClose={()=>setPanel(null)}/></motion.div>}
                  {panel==="todos"    && <motion.div key="todos"    initial={{opacity:0,y:20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20,scale:0.95}} transition={{type:"spring",damping:20,stiffness:260}}><TodosPanel    onClose={()=>setPanel(null)}/></motion.div>}
                  {panel==="notes"    && <motion.div key="notes"    initial={{opacity:0,y:20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20,scale:0.95}} transition={{type:"spring",damping:20,stiffness:260}}><NotesPanel    onClose={()=>setPanel(null)}/></motion.div>}
                  {panel==="calendar" && <motion.div key="calendar" initial={{opacity:0,y:20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20,scale:0.95}} transition={{type:"spring",damping:20,stiffness:260}}><CalendarPanel onClose={()=>setPanel(null)}/></motion.div>}
                  {panel==="music"    && <motion.div key="music"    initial={{opacity:0,y:20,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20,scale:0.95}} transition={{type:"spring",damping:20,stiffness:260}}><MusicPanel    spotifyUrl={spotifyUrl} onSpotifyUrlChange={setSpotifyUrl} onClose={()=>setPanel(null)}/></motion.div>}
                </AnimatePresence>
              </div>

              <div className="flex-1 relative cursor-pointer" onClick={()=>{ showLine(scene); }}>
                <AnimatePresence>
                  {dialogue && <SpeechLine text={dialogue} onDone={()=>setDialogue(null)}/>}
                </AnimatePresence>
              </div>
            </>
          )}

          <div className="flex flex-col items-center flex-shrink-0 pt-1">
            <Glass className="flex flex-col items-center py-4 px-2 gap-1">
              {!airiMode && (
                <>
                  <button className="sidebar-btn p-2.5 rounded-xl transition-all opacity-40 hover:opacity-80"
                    onClick={()=>{ const panels:PanelId[]=["goals","todos","notes","calendar","music"]; const i=panels.indexOf(panel); setPanel(i>0?panels[i-1]:panels[panels.length-1]); }}>
                    <ChevronUp size={17} color="rgba(155,142,196,0.5)"/>
                  </button>
                  <button className="sidebar-btn p-2.5 rounded-xl transition-all opacity-40 hover:opacity-80 mb-2"
                    onClick={()=>{ const panels:PanelId[]=["goals","todos","notes","calendar","music"]; const i=panels.indexOf(panel); setPanel(i<panels.length-1?panels[i+1]:panels[0]); }}>
                    <ChevronDown size={17} color="rgba(155,142,196,0.5)"/>
                  </button>
                  <div className="w-6 h-px mb-2" style={{ background:"rgba(155,142,196,0.1)" }}/>

                  {sidebar.map(({id,Icon,label})=>(
                    <motion.button key={id} onClick={()=>togglePanel(id)} whileHover={{scale:1.08}} whileTap={{scale:.92}}
                      title={label} className="sidebar-btn relative p-2.5 rounded-xl transition-all"
                      style={{ background:panel===id?"rgba(245,166,35,0.12)":"transparent", border:panel===id?"1px solid rgba(245,166,35,0.2)":"1px solid transparent" }}>
                      <Icon size={19} color={panel===id?"#f5a623":"rgba(155,142,196,0.5)"}/>
                      {panel===id&&<motion.div layoutId="sideActive" className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r" style={{ background:"#f5a623" }}/>}
                    </motion.button>
                  ))}

                  <div className="w-6 h-px mt-2 mb-2" style={{ background:"rgba(155,142,196,0.1)" }}/>
                </>
              )}

              <motion.button onClick={()=>{ setAiriMode(!airiMode); setAiriTab("chat"); if(!airiMode)setPanel(null); }}
                whileHover={{scale:1.08}} whileTap={{scale:.92}}
                title="Airi Hub" className="sidebar-btn relative p-2.5 rounded-xl transition-all"
                style={{ background:airiMode?"rgba(245,166,35,0.12)":"transparent", border:airiMode?"1px solid rgba(245,166,35,0.2)":"1px solid transparent" }}>
                <Sparkles size={19} color={airiMode?"#f5a623":"rgba(155,142,196,0.5)"}/>
                {airiMode&&<motion.div layoutId="airiActive" className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r" style={{ background:"#f5a623" }}/>}
              </motion.button>

              <div className="w-6 h-px mt-2 mb-2" style={{ background:"rgba(155,142,196,0.1)" }}/>

              <div className="relative">
                <button className="sidebar-btn p-2.5 rounded-xl transition-all opacity-40 hover:opacity-100" title="Wallpaper"
                  onClick={() => setShowWallpaperPicker(!showWallpaperPicker)}>
                  <Image size={18} color={activeWallpaper !== "none" ? "#f5a623" : "rgba(155,142,196,0.5)"}/>
                </button>
                {showWallpaperPicker && (
                  <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 z-50"
                    style={{ background:"#0f0c08", border:"1px solid rgba(245,166,35,0.15)", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.6)", padding:12, minWidth:200 }}>
                    <div className="absolute top-1/2 -translate-y-1/2 -right-[5px] w-2.5 h-2.5" style={{ background:"#0f0c08", borderRight:"1px solid rgba(245,166,35,0.15)", borderTop:"1px solid rgba(245,166,35,0.15)", transform:"translateY(-50%) rotate(45deg)" }}/>
                    <div className="flex items-center gap-2 mb-3">
                      <PxLabel size={14} color="#f5a623">Wallpaper</PxLabel>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {wallpaperGradients.map(w => (
                        <button key={w.id} onClick={() => applyWallpaper(w.id)}
                          className="rounded-lg transition-all relative overflow-hidden"
                          style={{
                            width:52, height:36,
                            background: w.value,
                            border: activeWallpaper === w.id ? "2px solid #f5a623" : "2px solid rgba(155,142,196,0.15)",
                            boxShadow: activeWallpaper === w.id ? "0 0 12px rgba(245,166,35,0.3)" : "none",
                          }}>
                          {activeWallpaper === w.id && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Check size={14} color="#f5a623" strokeWidth={3}/>
                            </div>
                          )}
                        </button>
                      ))}
                      {userWallpapers.map(w => (
                        <button key={w.id} onClick={() => applyWallpaper(w.id)}
                          className="rounded-lg transition-all relative overflow-hidden group"
                          style={{
                            width:52, height:36,
                            background:`url(${w.dataUrl}) center/cover`,
                            border: activeWallpaper === w.id ? "2px solid #f5a623" : "2px solid rgba(155,142,196,0.15)",
                            boxShadow: activeWallpaper === w.id ? "0 0 12px rgba(245,166,35,0.3)" : "none",
                          }}>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            {activeWallpaper === w.id && <Check size={14} color="#f5a623" strokeWidth={3}/>}
                          </div>
                          <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-all"
                            onClick={(e) => removeWallpaper(w.id, e)}>
                            <X size={10} color="rgba(255,255,255,0.7)" className="drop-shadow"/>
                          </div>
                        </button>
                      ))}
                      <button onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg transition-all flex items-center justify-center"
                        style={{ width:52, height:36, border:"2px dashed rgba(245,166,35,0.2)", background:"rgba(245,166,35,0.04)" }}>
                        <Plus size={14} color="rgba(245,166,35,0.4)"/>
                      </button>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect}/>
                    <p className="mt-3 text-[10px]" style={{ color:"rgba(155,142,196,0.35)", fontFamily:"'Work Sans', sans-serif" }}>
                      Click + to choose from your files
                    </p>
                  </div>
                )}
              </div>
              <button className="sidebar-btn p-2.5 rounded-xl transition-all opacity-30 hover:opacity-70" title="Power"
                onClick={()=>{ setRun(false); setScene("greeting"); showLine("greeting"); }}>
                <Power size={17} color="rgba(224,92,110,0.6)"/>
              </button>
            </Glass>
          </div>
        </div>


      </div>
      <TimerPanel secs={secs} running={running} isBreak={isBreak} timerMode={timerMode}
        focusMinutes={focusMinutes} completedPomodoros={completedPomodoros}
        onToggle={()=>{setRun(r=>!r);setScene(running?"greeting":"studying");}}
        onReset={resetTimer} onSkip={skipPhase} onModeChange={setTimerMode}
        onFocusMinutesChange={setFocusMinutes}/>
    </div>
  );
}
