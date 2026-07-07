import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, RefreshCw, Search, Quote } from "lucide-react";
import type { ChatMessage } from "@/types";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, useSearch: boolean) => void;
  loading: boolean;
  setEmotion: (e: any) => void;
  aiProvider?: string;
  ollamaModel?: string;
}

export default function ChatInterface({ messages, onSendMessage, loading, setEmotion, aiProvider = "gemini", ollamaModel = "gemma2" }: ChatInterfaceProps) {
  const [inputText, setInputText] = useState("");
  const [useSearch, setUseSearch] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;
    onSendMessage(inputText.trim(), useSearch);
    setInputText("");
  };

  const quickActions = [
    { label: "Design study schedule", prompt: "Airi, help me plan a study schedule for my exams this week." },
    { label: "Summarize wave mechanics", prompt: "Airi, summarize the core formulas behind Quantum Wave Mechanics." },
    { label: "Motivate me!", prompt: "Airi, give me some study motivation!" },
  ];

  return (
    <div className="flex flex-col h-[520px] border rounded-2xl p-5 justify-between"
      style={{ background: "#0f0c08", borderColor: "rgba(245,166,35,0.08)" }}>
      <div>
        <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: "rgba(245,166,35,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)" }}>
              <Sparkles className="h-5 w-5" style={{ color: "#f5a623" }} />
            </div>
            <div>
              <h3 style={{ fontFamily:"'Caveat', sans-serif", fontSize:"20px", color:"#f0e8d8", fontWeight:600 }}>Chat with Airi</h3>
              <p style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", color:"rgba(155,142,196,0.6)" }}>
                {aiProvider === "ollama" ? `Powered by Ollama (${ollamaModel})` : "Powered by Gemini AI"}
              </p>
            </div>
          </div>
          {aiProvider === "gemini" ? (
            <button onClick={() => setUseSearch(!useSearch)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer`}
              style={{
                background: useSearch ? "rgba(245,166,35,0.1)" : "transparent",
                borderColor: useSearch ? "rgba(245,166,35,0.25)" : "rgba(155,142,196,0.15)",
                color: useSearch ? "#f5a623" : "rgba(155,142,196,0.5)",
                fontFamily:"'M PLUS Rounded 1c', sans-serif",
                fontSize:"10px"
              }}>
              <Search className="h-3 w-3" />
              <span>Search</span>
            </button>
          ) : (
            <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border"
              style={{ color: "#f5a623", background: "rgba(245,166,35,0.1)", borderColor: "rgba(245,166,35,0.2)" }}>
              OFFLINE
            </span>
          )}
        </div>

        <div className="space-y-4 overflow-y-auto h-[320px] pr-1.5">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.sender === "user" ? "rounded-tr-none" : "rounded-tl-none"
              }`}
                style={msg.sender === "user"
                  ? { background: "#f5a623", color: "#0d0f1e", fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"13px" }
                  : { background: "#0f0c08", border: "1px solid rgba(245,166,35,0.08)", color: "#f0e8d8", fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"13px" }
                }>
                <p>{msg.text}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t text-[10px]" style={{ borderColor: "rgba(245,166,35,0.08)", color: "rgba(155,142,196,0.5)" }}>
                    <span className="flex items-center mb-1" style={{ fontFamily:"'Caveat', sans-serif", fontSize:"14px", color:"#f5a623" }}>
                      <Quote className="h-3 w-3 mr-1" style={{ color: "#f5a623" }} />
                      Sources:
                    </span>
                    {msg.sources.map((src, i) => (
                      <div key={i} className="truncate" style={{ color:"rgba(245,166,35,0.6)" }}>{src}</div>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[9px] mt-1.5 px-1" style={{ color: "rgba(155,142,196,0.4)", fontFamily:"'M PLUS Rounded 1c', sans-serif" }}>
                {msg.sender === "user" ? "You" : "Airi"}
              </span>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2" style={{ fontFamily:"'M PLUS Rounded 1c', sans-serif", fontSize:"11px", color:"rgba(155,142,196,0.5)" }}>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ color: "#f5a623" }} />
              <span className="italic">Airi is thinking...</span>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      <div>
        {messages.length <= 1 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {quickActions.map((act, i) => (
              <button key={i} onClick={() => { setEmotion("thinking"); onSendMessage(act.prompt, useSearch); }}
                className="px-3 py-1.5 rounded-xl text-xs border cursor-pointer transition-colors"
                style={{
                  background: "#0f0c08",
                  borderColor: "rgba(245,166,35,0.08)",
                  color: "rgba(155,142,196,0.6)",
                  fontFamily:"'M PLUS Rounded 1c', sans-serif",
                  fontSize:"10px"
                }}>
                {act.label}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-center gap-2.5">
          <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
            placeholder="Ask Airi anything..."
            disabled={loading}
            className="flex-1 rounded-xl px-4 py-3 text-xs outline-none disabled:opacity-50"
            style={{
              background: "#0f0c08",
              border: "1px solid rgba(245,166,35,0.08)",
              color: "#f0e8d8",
              fontFamily:"'Caveat', sans-serif",
              fontSize:"16px"
            }} />
          <button type="submit" disabled={loading || !inputText.trim()}
            className="p-3 rounded-xl disabled:opacity-40 cursor-pointer transition-colors"
            style={{ background: "#f5a623", color: "#0d0f1e" }}>
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
