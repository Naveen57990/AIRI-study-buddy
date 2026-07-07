import { useEffect, useState } from "react";
import { Brain, Plus, Trash, Save, Edit3, User, BookOpen, Star, Heart, X, Loader } from "lucide-react";
import type { MemoryProfile } from "@/types";

export default function MemoryDashboard() {
  const [profile, setProfile] = useState<MemoryProfile>({
    userName: "Naveen",
    goals: [],
    weakSubjects: [],
    preferences: "",
    savedFacts: [],
  });
  const [loading, setLoading] = useState(true);
  const [editPrefs, setEditPrefs] = useState(false);
  const [prefsDraft, setPrefsDraft] = useState("");
  const [newFact, setNewFact] = useState("");

  useEffect(() => {
    fetch("/api/memory")
      .then(r => r.json())
      .then(data => { setProfile(data); setPrefsDraft(data.preferences); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const saveProfile = (updated: MemoryProfile) => {
    setProfile(updated);
    fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch(console.error);
  };

  const savePrefs = () => {
    saveProfile({ ...profile, preferences: prefsDraft });
    setEditPrefs(false);
  };

  const addFact = () => {
    if (!newFact.trim()) return;
    const updated = { ...profile, savedFacts: [...profile.savedFacts, newFact.trim()] };
    saveProfile(updated);
    setNewFact("");
  };

  const removeFact = (i: number) => {
    saveProfile({ ...profile, savedFacts: profile.savedFacts.filter((_, j) => j !== i) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-6 w-6 animate-spin" style={{ color: "#f5a623" }} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="p-5 rounded-2xl" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl" style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)" }}>
            <User className="h-5 w-5" style={{ color: "#f5a623" }} />
          </div>
          <div>
            <h3 style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"13px", fontWeight:700, color:"#f0e8d8" }}>Student Profile</h3>
            <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", color:"rgba(155,142,196,0.5)" }}>{profile.userName}'s learning memory</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.06)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4" style={{ color: "#f5a623" }} />
              <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", letterSpacing:"0.06em", color:"rgba(155,142,196,0.5)" }}>Goals</span>
            </div>
            <div className="space-y-1.5">
              {profile.goals.map((g, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <span style={{ fontFamily:"'Caveat', sans-serif", fontSize:"15px", color:"#f0e8d8" }}>◆ {g}</span>
                  <button onClick={() => saveProfile({ ...profile, goals: profile.goals.filter((_, j) => j !== i) })}
                    className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity p-0.5 cursor-pointer">
                    <Trash className="h-3 w-3" style={{ color: "rgba(245,166,35,0.5)" }} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input type="text" placeholder="Add goal..." onKeyDown={e => {
                if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                  saveProfile({ ...profile, goals: [...profile.goals, (e.target as HTMLInputElement).value.trim()] });
                  (e.target as HTMLInputElement).value = "";
                }
              }}
                className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.1)", color: "#f0e8d8" }} />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.06)" }}>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4" style={{ color: "#f5a623" }} />
              <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", letterSpacing:"0.06em", color:"rgba(155,142,196,0.5)" }}>Weak Subjects</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.weakSubjects.map((s, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1.5"
                  style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.15)", color: "#f5a623" }}>
                  {s}
                  <button onClick={() => saveProfile({ ...profile, weakSubjects: profile.weakSubjects.filter((_, j) => j !== i) })} className="cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="p-5 rounded-2xl" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4" style={{ color: "#f5a623" }} />
            <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", letterSpacing:"0.06em", color:"rgba(155,142,196,0.5)" }}>Saved Knowledge</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {profile.savedFacts.map((f, i) => (
              <div key={i} className="flex items-start justify-between group rounded-lg p-2" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.06)" }}>
                <span style={{ fontFamily:"'Caveat', sans-serif", fontSize:"14px", color:"#f0e8d8" }}>📌 {f}</span>
                <button onClick={() => removeFact(i)}
                  className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity p-0.5 cursor-pointer">
                  <Trash className="h-3 w-3" style={{ color: "rgba(245,166,35,0.5)" }} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input type="text" value={newFact} onChange={e => setNewFact(e.target.value)} placeholder="Save a fact..."
              className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.1)", color: "#f0e8d8" }} />
            <button onClick={addFact} className="p-2 rounded-lg cursor-pointer" style={{ background: "#f5a623", color: "#0f0c08" }}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-5 rounded-2xl" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4" style={{ color: "#f5a623" }} />
              <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", letterSpacing:"0.06em", color:"rgba(155,142,196,0.5)" }}>Learning Preferences</span>
            </div>
            <button onClick={() => { setEditPrefs(!editPrefs); setPrefsDraft(profile.preferences); }}
              className="p-1.5 rounded-lg cursor-pointer" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.1)" }}>
              <Edit3 className="h-3.5 w-3.5" style={{ color: "#f5a623" }} />
            </button>
          </div>
          {editPrefs ? (
            <div className="space-y-2">
              <textarea value={prefsDraft} onChange={e => setPrefsDraft(e.target.value)}
                className="w-full rounded-xl p-3 text-xs outline-none resize-none h-20"
                style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.1)", color: "#f0e8d8" }} />
              <button onClick={savePrefs} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ background: "#f5a623", color: "#0f0c08" }}>
                <Save className="h-3.5 w-3.5" /> Save
              </button>
            </div>
          ) : (
            <p style={{ fontFamily:"'Caveat', sans-serif", fontSize:"14px", color:"#f0e8d8" }}>{profile.preferences}</p>
          )}
        </div>
      </div>
    </div>
  );
}
