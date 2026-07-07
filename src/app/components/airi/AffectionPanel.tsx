import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Heart, Sparkles, Gift, ChevronRight, Star, Trophy, Flame, Check, Clock, MessageCircle, BookOpen, Target, Zap } from "lucide-react";
import type { AffectionData } from "@/types";

const LEVEL_UNLOCK_NAMES: Record<string, { label: string; icon: string; desc: string }> = {
  custom_greeting:    { label: "Custom Greeting", icon: "🌅", desc: "Airi greets you by name every morning" },
  new_voice_lines_1:  { label: "Voice Lines I",    icon: "💬", desc: "New encouragement phrases unlocked" },
  outfit_casual:      { label: "Casual Outfit",     icon: "👕", desc: "Airi changes to casual clothes" },
  new_voice_lines_2:  { label: "Voice Lines II",   icon: "💬", desc: "More teasing & scolding lines" },
  special_animation:  { label: "Special Animation", icon: "✨", desc: "Airi does a happy dance when you focus" },
  outfit_pajama:      { label: "Pajama Outfit",     icon: "🌙", desc: "Cozy pajama look for night study" },
  new_voice_lines_3:  { label: "Voice Lines III",  icon: "💬", desc: "Affectionate & caring phrases" },
  outfit_school:      { label: "School Outfit",     icon: "🎒", desc: "Classic school uniform" },
  special_bgm:        { label: "Special BGM",       icon: "🎵", desc: "New background music unlocks" },
  outfit_formal:      { label: "Formal Outfit",     icon: "👗", desc: "Elegant formal wear" },
  outfit_festive:     { label: "Festive Outfit",    icon: "🎊", desc: "Celebration outfit" },
  secret_ending:      { label: "Secret Ending",     icon: "💜", desc: "???" },
};

const SOURCE_ICONS: Record<string, JSX.Element> = {
  daily_checkin: <Star className="h-3 w-3" />,
  streak_bonus: <Flame className="h-3 w-3" />,
  pomodoro: <Clock className="h-3 w-3" />,
  focus_tick: <Zap className="h-3 w-3" />,
  chat: <MessageCircle className="h-3 w-3" />,
  pdf: <BookOpen className="h-3 w-3" />,
  goal: <Target className="h-3 w-3" />,
  pet: <Heart className="h-3 w-3" />,
  praise: <Sparkles className="h-3 w-3" />,
};

function XpSourceIcon({ source }: { source: string }) {
  return SOURCE_ICONS[source] || <Zap className="h-3 w-3" />;
}

export default function AffectionPanel() {
  const [data, setData] = useState<AffectionData | null>(null);
  const [newUnlocks, setNewUnlocks] = useState<string[]>([]);
  const [showUnlocks, setShowUnlocks] = useState(false);
  const [gainFlash, setGainFlash] = useState<{ amount: number; reason: string; isLevelUp?: boolean } | null>(null);
  const prevLevel = useRef(1);
  const [checkingIn, setCheckingIn] = useState(false);

  const fetchAffection = useCallback(() => {
    fetch("/api/affection")
      .then(r => r.json())
      .then(d => {
        setData(d);
        prevLevel.current = d.level;
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchAffection(); }, [fetchAffection]);

  const addXp = async (source: string, reason: string, amount?: number) => {
    const body = { source, reason };
    if (amount) Object.assign(body, { amount });
    try {
      const res = await fetch("/api/affection/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.newUnlocks?.length) {
        setNewUnlocks(result.newUnlocks);
        setShowUnlocks(true);
        setTimeout(() => setShowUnlocks(false), 5000);
      }
      if (result.level > prevLevel.current) {
        setGainFlash({ amount: result.granted || 0, reason: `Level ${prevLevel.current} → ${result.level}!`, isLevelUp: true });
      } else if (result.granted > 0) {
        setGainFlash({ amount: result.granted, reason });
      }
      setTimeout(() => setGainFlash(null), 2500);
      prevLevel.current = result.level;
      setData(result);
    } catch {}
  };

  const doDailyCheckin = async () => {
    if (checkingIn || data?.checkedInToday) return;
    setCheckingIn(true);
    try {
      const res = await fetch("/api/affection/daily-checkin", { method: "POST" });
      const result = await res.json();
      if (result.newUnlocks?.length) {
        setNewUnlocks(result.newUnlocks);
        setShowUnlocks(true);
        setTimeout(() => setShowUnlocks(false), 5000);
      }
      setGainFlash({ amount: 150 + (result.streakBonus || 0), reason: `Day ${result.currentStreak} check-in!` });
      setTimeout(() => setGainFlash(null), 3000);
      prevLevel.current = result.level;
      setData(result);
    } catch {}
    setCheckingIn(false);
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Heart className="h-6 w-6 animate-pulse" style={{ color: "#f5a623" }} />
      </div>
    );
  }

  const progress = data.xp / data.nextLevelXp;
  const pct = Math.min(progress * 100, 100);
  const remPet = data.dailyActions.maxPetted - data.dailyActions.petted;
  const remPraise = data.dailyActions.maxPraised - data.dailyActions.praised;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column */}
      <div className="lg:col-span-1 flex flex-col gap-5">

        {/* Level card */}
        <div className="p-6 rounded-2xl border text-center relative overflow-hidden"
          style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
          <div className="absolute inset-0 opacity-5"
            style={{ background: "radial-gradient(circle at 50% 0%, #f5a623 0%, transparent 60%)" }} />
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3"
            style={{ background: "rgba(245,166,35,0.12)", border: "2px solid rgba(245,166,35,0.25)" }}>
            <Heart className="h-7 w-7" style={{ color: "#f5a623" }} fill="#f5a623" />
          </motion.div>
          <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"32px", fontWeight:800, color:"#f5a623" }}>Lv.{data.level}</div>
          <div style={{ fontFamily:"'Caveat', sans-serif", fontSize:"20px", marginTop:"-2px", color:"rgba(245,166,35,0.6)" }}>
            {data.moodIcon} {data.moodLabel}
          </div>
          <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", marginTop:"4px", color:"rgba(155,142,196,0.5)" }}>
            {data.totalXp.toLocaleString()} Total XP
          </div>
          <div className="mt-3">
            <div className="flex justify-between" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", marginBottom:"4px", color:"rgba(155,142,196,0.5)" }}>
              <span>{data.xp.toLocaleString()} XP</span>
              <span>{data.nextLevelXp.toLocaleString()} XP</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(245,166,35,0.06)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #f5a623, #ff8c42)" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Streak */}
          <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t" style={{ borderColor: "rgba(245,166,35,0.06)" }}>
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4" style={{ color: data.currentStreak > 0 ? "#f5a623" : "rgba(155,142,196,0.3)" }} />
              <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"13px", fontWeight:700, color: data.currentStreak > 0 ? "#f5a623" : "rgba(155,142,196,0.3)" }}>
                {data.currentStreak}
              </span>
              <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", color:"rgba(155,142,196,0.5)" }}>day streak</span>
            </div>
            <div style={{ width:1, height:20, background:"rgba(245,166,35,0.08)" }} />
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4" style={{ color: "rgba(155,142,196,0.4)" }} />
              <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"13px", fontWeight:700, color:"rgba(155,142,196,0.5)" }}>
                {data.longestStreak}
              </span>
              <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", color:"rgba(155,142,196,0.5)" }}>best</span>
            </div>
          </div>
        </div>

        {/* Daily check-in */}
        <div className="p-5 rounded-2xl border text-center"
          style={{ background: data.checkedInToday ? "rgba(245,166,35,0.04)" : "#0f0c08", borderColor: data.checkedInToday ? "rgba(245,166,35,0.12)" : "rgba(245,166,35,0.08)" }}>
          {data.checkedInToday ? (
            <div className="flex items-center justify-center gap-2">
              <div className="p-1.5 rounded-full" style={{ background: "rgba(245,166,35,0.1)" }}>
                <Check className="h-4 w-4" style={{ color: "#f5a623" }} />
              </div>
              <div>
                <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, color:"#f5a623" }}>Checked in today</div>
                <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", color:"rgba(155,142,196,0.5)" }}>See you tomorrow!</div>
              </div>
            </div>
          ) : (
            <button onClick={doDailyCheckin} disabled={checkingIn}
              className="w-full cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-50">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.15), rgba(245,166,35,0.05))", border: "1px solid rgba(245,166,35,0.2)" }}>
                <motion.div
                  animate={{ rotate: [0, -5, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="p-2 rounded-lg" style={{ background: "rgba(245,166,35,0.1)" }}>
                  <Star className="h-5 w-5" style={{ color: "#f5a623" }} />
                </motion.div>
                <div className="text-left">
                  <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"12px", fontWeight:700, color:"#f0e8d8" }}>
                    {checkingIn ? "Checking in..." : "Daily Check-in"}
                  </div>
                  <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", color:"rgba(245,166,35,0.6)" }}>
                    +150 XP{data.currentStreak > 0 ? ` · +${data.currentStreak * 20} streak bonus` : ""}
                  </div>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* XP History */}
        <div className="p-5 rounded-2xl border" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4" style={{ color: "#f5a623" }} />
            <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"#f5a623" }}>Recent XP</span>
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {data.xpHistory.length > 0 ? data.xpHistory.map((entry, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: i === 0 ? "rgba(245,166,35,0.04)" : "transparent", border: i === 0 ? "1px solid rgba(245,166,35,0.08)" : "none" }}>
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded" style={{ background: "rgba(245,166,35,0.08)", color: "#f5a623" }}>
                    <XpSourceIcon source={entry.source} />
                  </div>
                  <div>
                    <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", color:"#f0e8d8" }}>{entry.reason}</div>
                    <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"8px", color:"rgba(155,142,196,0.4)" }}>
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
                <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, color:"#f5a623" }}>+{entry.amount}</span>
              </div>
            )) : (
              <div className="py-6 text-center">
                <p style={{ fontFamily:"'Caveat', sans-serif", fontSize:"14px", color:"rgba(155,142,196,0.4)" }}>No XP earned yet</p>
                <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", marginTop:"4px", color:"rgba(155,142,196,0.3)" }}>Start studying to earn!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right columns */}
      <div className="lg:col-span-2 flex flex-col gap-5">

        {/* Quick Actions */}
        <div className="p-5 rounded-2xl border" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4" style={{ color: "#f5a623" }} />
            <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"#f5a623" }}>Quick Actions</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={() => addXp("pet", "Petted Airi")}
              disabled={remPet <= 0}
              className="flex items-center justify-between px-4 py-3 rounded-xl text-xs cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.12)", color: "#f0e8d8" }}>
              <div className="flex items-center gap-2">
                <span>Pet Airi</span> <span style={{ fontSize:"14px" }}>❤️</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", color:"#f5a623" }}>+5 XP</span>
                <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"8px", color:"rgba(155,142,196,0.4)" }}>({remPet}/3)</span>
              </div>
            </button>
            <button onClick={() => addXp("praise", "Praised Airi")}
              disabled={remPraise <= 0}
              className="flex items-center justify-between px-4 py-3 rounded-xl text-xs cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.12)", color: "#f0e8d8" }}>
              <div className="flex items-center gap-2">
                <span>Praise Airi</span> <span style={{ fontSize:"14px" }}>✨</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", color:"#f5a623" }}>+10 XP</span>
                <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"8px", color:"rgba(155,142,196,0.4)" }}>({remPraise}/3)</span>
              </div>
            </button>
          </div>
          <div className="mt-3 p-3 rounded-xl" style={{ background: "rgba(245,166,35,0.03)", border: "1px dashed rgba(245,166,35,0.08)" }}>
            <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", color:"rgba(155,142,196,0.4)" }}>
              💡 <span style={{ color:"rgba(245,166,35,0.5)" }}>Auto XP</span>: Complete focus sessions (+60), chat with Airi (+3), analyze PDFs (+40), finish goals (+75)
            </div>
          </div>
        </div>

        {/* Unlocked Items */}
        <div className="p-5 rounded-2xl border" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4" style={{ color: "#f5a623" }} />
              <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"#f5a623" }}>Unlocks</span>
            </div>
            <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", color:"rgba(155,142,196,0.5)" }}>
              {data.unlocks.length} / {Object.keys(LEVEL_UNLOCK_NAMES).length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.unlocks.length > 0 ? data.unlocks.map(key => {
              const info = LEVEL_UNLOCK_NAMES[key];
              if (!info) return null;
              return (
                <div key={key} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.1)" }}>
                  <span className="text-lg">{info.icon}</span>
                  <div>
                    <div style={{ fontFamily:"'Caveat', sans-serif", fontSize:"15px", color:"#f0e8d8" }}>{info.label}</div>
                    <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", color:"rgba(155,142,196,0.5)" }}>{info.desc}</div>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-2 py-8 text-center rounded-xl" style={{ background: "rgba(245,166,35,0.02)", border: "1px dashed rgba(245,166,35,0.08)" }}>
                <Trophy className="h-8 w-8 mx-auto mb-2" style={{ color: "rgba(245,166,35,0.1)" }} />
                <p style={{ fontFamily:"'Caveat', sans-serif", fontSize:"16px", color:"rgba(155,142,196,0.5)" }}>Keep studying to unlock rewards!</p>
                <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", marginTop:"4px", color:"rgba(155,142,196,0.3)" }}>Complete focus sessions to earn XP</p>
              </div>
            )}
          </div>
        </div>

        {/* Next Unlocks Preview */}
        <div className="p-5 rounded-2xl border" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4" style={{ color: "#f5a623" }} />
            <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"#f5a623" }}>Coming Up</span>
          </div>
          {(() => {
            const upcoming = Object.entries(LEVEL_UNLOCK_NAMES).filter(([key]) => !data.unlocks.includes(key));
            const nextFive = upcoming.slice(0, 5);
            return (
              <div className="space-y-1.5">
                {nextFive.map(([key, info]) => (
                  <div key={key} className="flex items-center gap-2.5 px-3 py-2 rounded-xl opacity-50"
                    style={{ background: "rgba(245,166,35,0.03)", border: "1px solid rgba(245,166,35,0.05)" }}>
                    <span className="text-base">{info.icon}</span>
                    <div className="flex-1">
                      <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", color:"rgba(155,142,196,0.5)" }}>{info.label}</div>
                      <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", color:"rgba(155,142,196,0.3)" }}>{info.desc}</div>
                    </div>
                    <ChevronRight className="h-3 w-3" style={{ color: "rgba(155,142,196,0.3)" }} />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

      </div>

      {/* Gain flash */}
      <AnimatePresence>
        {gainFlash && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl"
            style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.2)", color: "#f5a623" }}>
            <div className="flex items-center gap-2">
              {gainFlash.isLevelUp ? (
                <Trophy className="h-4 w-4" fill="#f5a623" />
              ) : (
                <Heart className="h-4 w-4" fill="#f5a623" />
              )}
              <span className="text-xs font-bold">
                {gainFlash.isLevelUp ? "🎉 " : "+"}{gainFlash.amount} XP
              </span>
              <span className="text-[10px] opacity-70">{gainFlash.reason}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New unlock notification */}
      <AnimatePresence>
        {showUnlocks && newUnlocks.map(key => {
          const info = LEVEL_UNLOCK_NAMES[key];
          if (!info) return null;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-6 py-5 rounded-2xl text-center"
              style={{ background: "#0f0c08", border: "2px solid rgba(245,166,35,0.3)", maxWidth: 320 }}>
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.6 }}
                className="text-4xl mb-2">{info.icon}</motion.div>
              <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"14px", fontWeight:700, marginBottom:"4px", color:"#f5a623" }}>Unlocked!</div>
              <div style={{ fontFamily:"'Caveat', sans-serif", fontSize:"17px", color:"#f0e8d8" }}>{info.label}</div>
              <div style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", marginTop:"4px", color:"rgba(155,142,196,0.5)" }}>{info.desc}</div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
