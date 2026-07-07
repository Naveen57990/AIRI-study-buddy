import { useState, useEffect } from "react";
import { BookOpen, FileText, RefreshCw, Layers, Zap, Trash, Clock } from "lucide-react";
import type { PDFSummary } from "@/types";

interface PDFHubProps { aiProvider?: string; ollamaUrl?: string; ollamaModel?: string; }

interface PdfHistoryEntry {
  id: string;
  title: string;
  summary: string;
  date: string;
  fileName: string;
  formulas?: string[];
  flashcards?: Array<{ id: string; question: string; answer: string }>;
}

export default function PDFHub({ aiProvider = "gemini", ollamaUrl = "http://localhost:11434", ollamaModel = "gemma2" }: PDFHubProps) {
  const [pasteText, setPasteText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [summaryData, setSummaryData] = useState<PDFSummary | null>(null);
  const [flippedCards, setFlippedCards] = useState<{ [id: string]: boolean }>({});
  const [history, setHistory] = useState<PdfHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetch("/api/pdf/history")
      .then(r => r.json())
      .then(setHistory)
      .catch(() => {});
  }, []);

  const handleFlip = (cardId: string) => setFlippedCards(p => ({ ...p, [cardId]: !p[cardId] }));

  const handleAnalyze = async (textToAnalyze: string, name = "Paste Notes") => {
    if (!textToAnalyze.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/pdf/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textContent: textToAnalyze, fileName: name, aiProvider, ollamaUrl, ollamaModel }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummaryData(data);
      setFlippedCards({});
      const entry = { title: data.title || name, summary: data.summary || "", fileName: name, formulas: data.formulas || [], flashcards: data.flashcards || [] };
      fetch("/api/pdf/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) }).then(r => r.json()).then(saved => setHistory(h => [saved, ...h])).catch(() => {});
      fetch("/api/affection/xp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "pdf", reason: "Analyzed a PDF" }) }).catch(() => {});
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally { setAnalyzing(false); }
  };

  const loadHistory = (entry: PdfHistoryEntry) => {
    setSummaryData({ title: entry.title, summary: entry.summary, formulas: entry.formulas || [], flashcards: entry.flashcards || [] });
    setFlippedCards({});
    setShowHistory(false);
  };

  const deleteHistory = (id: string) => {
    fetch("/api/pdf/history/" + id, { method: "DELETE" }).catch(() => {});
    setHistory(h => h.filter(e => e.id !== id));
  };

  const samples = [
    { title: "Quantum Physics", text: "Wave-particle duality: every particle or quantum entity may be described as either a particle or a wave. The Schrödinger equation: iℏ ∂/∂t Ψ = Ĥ Ψ. Planck's relation: E = hν." },
    { title: "Cellular Respiration", text: "Cellular respiration converts biochemical energy from nutrients into ATP. The Krebs cycle produces NADH, FADH2, and GTP. Total yield per glucose: ~30-32 ATP." },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 p-5 rounded-2xl border flex flex-col justify-between" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)" }}>
                <FileText className="h-5 w-5" style={{ color: "#f5a623" }} />
              </div>
              <div>
                <h3 style={{ fontFamily:"'Caveat', sans-serif", fontSize:"20px", color:"#f0e8d8", fontWeight:600 }}>Study Notes Analyzer</h3>
                <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", color:"rgba(155,142,196,0.6)" }}>Extract equations, summaries, flashcards</p>
              </div>
            </div>
            {history.length > 0 && (
              <button onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] cursor-pointer"
                style={{ background: showHistory ? "rgba(245,166,35,0.1)" : "transparent", border: "1px solid rgba(245,166,35,0.1)", color: "#f5a623" }}>
                <Clock className="h-3 w-3" />
                History ({history.length})
              </button>
            )}
          </div>

          {showHistory && history.length > 0 && (
            <div className="mb-4 p-3 rounded-xl max-h-40 overflow-y-auto" style={{ background: "rgba(245,166,35,0.03)", border: "1px solid rgba(245,166,35,0.08)" }}>
              <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", fontWeight:700, marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.06em", color:"rgba(155,142,196,0.5)" }}>Previous Analyses</p>
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg mb-1 cursor-pointer hover:bg-white/5"
                  onClick={() => loadHistory(h)}>
                  <div>
                    <span style={{ fontFamily:"'Caveat', sans-serif", fontSize:"13px", color:"#f0e8d8" }}>{h.title}</span>
                    <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"8px", marginLeft:"6px", color:"rgba(155,142,196,0.4)" }}>{new Date(h.date).toLocaleDateString()}</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteHistory(h.id); }} className="p-0.5 opacity-30 hover:opacity-100 cursor-pointer">
                    <Trash className="h-3 w-3" style={{ color: "rgba(245,166,35,0.5)" }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
            placeholder="Paste your study notes here..."
            className="w-full h-48 rounded-xl p-3.5 text-xs outline-none resize-none"
            style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)", color: "#f0e8d8", fontFamily:"'Caveat', sans-serif", fontSize:"15px" }} />
          <div className="mt-4">
            <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", fontWeight:700, marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.06em", color:"rgba(155,142,196,0.5)" }}>Quick Samples:</p>
            {samples.map((s, i) => (
              <button key={i} onClick={() => { setPasteText(s.text); handleAnalyze(s.text, s.title); }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl mb-2 text-left cursor-pointer"
                style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
                <span style={{ fontFamily:"'Caveat', sans-serif", fontSize:"15px", color:"#f0e8d8" }}>{s.title}</span>
                <Zap className="h-3 w-3" style={{ color: "#f5a623" }} />
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => handleAnalyze(pasteText)} disabled={analyzing || !pasteText.trim()}
          className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer"
          style={{ background: "#f5a623", color: "#0d0f1e", fontFamily:"'M PLUS Rounded 1c', sans-serif", letterSpacing:"0.04em" }}>
          {analyzing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Analyzing...</> : <><BookOpen className="h-4 w-4" /> Analyze & Generate Flashcards</>}
        </button>
      </div>

      <div className="lg:col-span-7 p-5 rounded-2xl border" style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
        {summaryData ? (
          <div className="space-y-6">
            <div className="rounded-xl p-4" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b" style={{ borderColor: "rgba(245,166,35,0.08)" }}>
                <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"#f5a623" }}>AI Summary</span>
                <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", color:"rgba(155,142,196,0.5)" }}>{summaryData.title}</span>
              </div>
              <p style={{ fontFamily:"'Caveat', sans-serif", fontSize:"16px", color:"rgba(240,232,216,0.7)", fontStyle:"italic" }}>{summaryData.summary}</p>
            </div>
            {summaryData.formulas?.length > 0 && (
              <div>
                <h4 style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", fontWeight:700, marginBottom:"10px", textTransform:"uppercase", letterSpacing:"0.06em", color:"rgba(155,142,196,0.5)" }}>Formulas</h4>
                <div className="flex flex-wrap gap-2">
                  {summaryData.formulas.map((f, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg text-xs font-mono" style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)", color: "#f5a623" }}>{f}</div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4" style={{ color: "#f5a623" }} />
                <h4 style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"10px", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:"rgba(155,142,196,0.5)" }}>Flashcards</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {summaryData.flashcards.map(card => {
                  const flipped = flippedCards[card.id] || false;
                  return (
                    <div key={card.id} onClick={() => handleFlip(card.id)} className="h-32 [perspective:1000px] cursor-pointer">
                      <div className={`relative w-full h-full rounded-xl transition-all duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}
                        style={{ background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)" }}>
                        <div className="absolute inset-0 w-full h-full rounded-xl p-4 flex flex-col justify-between [backface-visibility:hidden]">
                          <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", letterSpacing:"0.06em", color:"#f5a623" }}>Question</span>
                          <p style={{ fontFamily:"'Caveat', sans-serif", fontSize:"14px", color:"#f0e8d8" }}>{card.question}</p>
                          <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textAlign:"right", color:"rgba(155,142,196,0.4)" }}>Click for answer →</span>
                        </div>
                        <div className="absolute inset-0 w-full h-full rounded-xl p-4 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)]"
                          style={{ border: "1px solid rgba(245,166,35,0.15)" }}>
                          <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textTransform:"uppercase", letterSpacing:"0.06em", color:"#f5a623" }}>Answer</span>
                          <p style={{ fontFamily:"'Caveat', sans-serif", fontSize:"14px", color:"#f0e8d8" }}>{card.answer}</p>
                          <span style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"9px", textAlign:"right", color:"rgba(245,166,35,0.5)" }}>← Flip back</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[430px] border border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center" style={{ borderColor: "rgba(245,166,35,0.08)" }}>
            <BookOpen className="h-12 w-12 mb-3" style={{ color: "rgba(245,166,35,0.15)" }} />
            <h4 style={{ fontFamily:"'Caveat', sans-serif", fontSize:"20px", color:"rgba(200,184,240,0.8)" }}>Awaiting Study Notes</h4>
            <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"12px", marginTop:"4px", color:"rgba(155,142,196,0.5)" }}>Paste notes or select a sample to analyze</p>
          </div>
        )}
      </div>
    </div>
  );
}
