import { useEffect, useState } from "react";
import { Calendar, Plus, Trash, GraduationCap, BookOpen, FileEdit, Clock, ChevronLeft, ChevronRight, Loader } from "lucide-react";
import type { CalendarEvent } from "@/types";

export default function CalendarScheduler() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", date: "", time: "", type: "study" as CalendarEvent["type"] });

  const fetchEvents = () => {
    fetch("/api/calendar")
      .then(r => r.json())
      .then(data => { setEvents(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents();
    window.addEventListener("calendar-updated", fetchEvents);
    return () => window.removeEventListener("calendar-updated", fetchEvents);
  }, []);

  const yr = viewDate.getFullYear();
  const mo = viewDate.getMonth();
  const dim = new Date(yr, mo + 1, 0).getDate();
  const fd = new Date(yr, mo, 1).getDay();
  const cells = Array.from({ length: fd + dim }, (_, i) => (i < fd ? null : i - fd + 1));

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = (d: number) => `${yr}-${pad(mo + 1)}-${pad(d)}`;

  const dayEvents = (day: number) => events.filter(e => e.date === dateStr(day));

  const addEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.date) return;
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEvent),
      });
      const saved = await res.json();
      setEvents(e => [...e, saved]);
      window.dispatchEvent(new CustomEvent("calendar-updated"));
    } catch (err) {
      console.error("Failed to add event", err);
    }
    setNewEvent({ title: "", date: "", time: "", type: "study" });
    setShowAdd(false);
  };

  const deleteEvent = async (id: string) => {
    try {
      await fetch(`/api/calendar/${id}`, { method: "DELETE" });
      setEvents(e => e.filter(x => x.id !== id));
      window.dispatchEvent(new CustomEvent("calendar-updated"));
    } catch (err) {
      console.error("Failed to delete event", err);
    }
  };

  const typeIcon: Record<string, JSX.Element> = {
    exam: <GraduationCap className="h-3 w-3" style={{ color: "#f5a623" }} />,
    study: <BookOpen className="h-3 w-3" style={{ color: "#f5a623" }} />,
    assignment: <FileEdit className="h-3 w-3" style={{ color: "#f5a623" }} />,
    other: <Clock className="h-3 w-3" style={{ color: "rgba(155,142,196,0.5)" }} />,
  };

  const typeColor: Record<string, string> = {
    exam: "#f5a623",
    study: "#f5a623",
    assignment: "#f5a623",
    other: "rgba(155,142,196,0.4)",
  };

  const todayEvents = dayEvents(today.getDate());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-6 w-6 animate-spin" style={{ color: "#f5a623" }} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 p-5 rounded-2xl" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)" }}>
              <Calendar className="h-5 w-5" style={{ color: "#f5a623" }} />
            </div>
            <div>
              <h3 style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"13px", fontWeight:700, color:"#f0e8d8" }}>Schedule</h3>
              <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", color:"rgba(155,142,196,0.5)" }}>{events.length} events saved</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
            style={{ background: showAdd ? "rgba(245,166,35,0.1)" : "transparent", borderColor: showAdd ? "rgba(245,166,35,0.25)" : "rgba(245,166,35,0.08)", color: showAdd ? "#f5a623" : "rgba(155,142,196,0.5)" }}>
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setViewDate(new Date(yr, mo - 1, 1))} className="p-1.5 rounded-lg cursor-pointer hover:bg-white/5 transition-all">
            <ChevronLeft className="h-4 w-4" style={{ color: "rgba(155,142,196,0.5)" }} />
          </button>
          <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"13px", fontWeight:700, color:"#f0e8d8" }}>
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mo]} {yr}
          </span>
          <button onClick={() => setViewDate(new Date(yr, mo + 1, 1))} className="p-1.5 rounded-lg cursor-pointer hover:bg-white/5 transition-all">
            <ChevronRight className="h-4 w-4" style={{ color: "rgba(155,142,196,0.5)" }} />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center py-1" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"8px", color:"rgba(155,142,196,0.5)" }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            const isToday = day === today.getDate() && mo === today.getMonth() && yr === today.getFullYear();
            const dEvents = day ? dayEvents(day) : [];
            return (
              <div key={i} className={`min-h-[56px] rounded-lg p-1 text-center transition-all ${day ? "cursor-pointer hover:bg-white/5" : ""}`}
                style={{
                  background: isToday ? "rgba(245,166,35,0.12)" : "#0f0c08",
                  border: isToday ? "1px solid rgba(245,166,35,0.25)" : "1px solid rgba(245,166,35,0.04)",
                }}>
                <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", color: isToday ? "#f5a623" : day ? "#f0e8d8" : "transparent" }}>{day || ""}</span>
                {dEvents.length > 0 && (
                  <div className="mt-0.5 flex justify-center gap-0.5">
                    {dEvents.slice(0, 3).map(e => (
                      <div key={e.id} className="h-1 w-1 rounded-full" style={{ background: typeColor[e.type] }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showAdd && (
          <div className="mt-4 p-4 rounded-xl" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} placeholder="Event title..."
                className="col-span-2 rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.1)", color: "#f0e8d8" }} />
              <input type="date" value={newEvent.date} onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))}
                className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.1)", color: "#f0e8d8" }} />
              <input type="time" value={newEvent.time} onChange={e => setNewEvent(p => ({ ...p, time: e.target.value }))}
                className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.1)", color: "#f0e8d8" }} />
              <select value={newEvent.type} onChange={e => setNewEvent(p => ({ ...p, type: e.target.value as CalendarEvent["type"] }))}
                className="rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.1)", color: "#f0e8d8" }}>
                <option value="study">Study</option>
                <option value="exam">Exam</option>
                <option value="assignment">Assignment</option>
                <option value="other">Other</option>
              </select>
              <button onClick={addEvent} className="rounded-lg text-xs font-semibold cursor-pointer"
                style={{ background: "#f5a623", color: "#0f0c08" }}>
                Add Event
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="p-5 rounded-2xl" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
          <h4 style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"12px", color:"#f5a623" }}>
            Today's Events ({todayEvents.length})
          </h4>
          {todayEvents.length > 0 ? (
            <div className="space-y-2">
              {todayEvents.map(e => (
                <div key={e.id} className="flex items-center justify-between rounded-xl p-3 group"
                  style={{ background: "#0f0c08", border: `1px solid rgba(245,166,35,0.1)` }}>
                  <div className="flex items-center gap-3">
                    {typeIcon[e.type]}
                    <div>
                      <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", color:"#f0e8d8" }}>{e.title}</p>
                      <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", color:"#f5a623" }}>{e.time}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteEvent(e.id)}
                    className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity p-1 cursor-pointer">
                    <Trash className="h-3.5 w-3.5" style={{ color: "rgba(245,166,35,0.5)" }} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.04)" }}>
              <p style={{ fontFamily:"'Caveat', sans-serif", fontSize:"15px", color:"rgba(155,142,196,0.5)" }}>No events today. Free day!</p>
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
          <h4 style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"12px", color:"rgba(155,142,196,0.5)" }}>
            <Calendar className="h-3.5 w-3.5 inline mr-1.5" style={{ color: "#f5a623" }} />
            All Events ({events.length})
          </h4>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {[...events].sort((a, b) => a.date.localeCompare(b.date)).map(e => (
              <div key={e.id} className="flex items-center justify-between rounded-lg px-3 py-2 group"
                style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.04)" }}>
                <div className="flex items-center gap-2.5">
                  {typeIcon[e.type]}
                  <div>
                    <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", color:"#f0e8d8" }}>{e.title}</p>
                    <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"8px", color:"rgba(155,142,196,0.5)" }}>{e.date} @ {e.time}</p>
                  </div>
                </div>
                <button onClick={() => deleteEvent(e.id)}
                  className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity p-0.5 cursor-pointer">
                  <Trash className="h-3 w-3" style={{ color: "rgba(245,166,35,0.5)" }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
