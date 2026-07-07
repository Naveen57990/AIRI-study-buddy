import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, Play, Square, RefreshCw, Trash, List } from "lucide-react";

interface VoiceAssistantProps {
  speakText: (text: string) => void;
  onTranscript: (text: string) => void;
  language?: "en" | "te";
}

export default function VoiceAssistant({ speakText, onTranscript, language = "en" }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [history, setHistory] = useState<{ text: string; timestamp: Date }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [rate, setRate] = useState(1);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const v = synth.getVoices();
      setVoices(v);
      if (!selectedVoice && v.length > 0) {
        const enVoice = v.find(voice => voice.lang.startsWith("en")) || v[0];
        setSelectedVoice(enVoice.name);
      }
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => { synth.onvoiceschanged = null; };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTranscript("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === "te" ? "te-IN" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        final += event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setHistory(h => [...h, { text: event.results[i][0].transcript, timestamp: new Date() }]);
        }
      }
      setTranscript(final);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setTranscript("Microphone error occurred.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    setIsListening(true);
  };

  const speakThis = (text: string) => {
    speakText(text);
  };

  const clearTranscript = () => {
    setTranscript("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="p-5 rounded-2xl backdrop-blur-md" style={{ background: "rgba(10,8,24,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl transition-all ${isListening ? "animate-pulse" : ""}`}
              style={{ background: isListening ? "rgba(255,45,85,0.2)" : "rgba(10,8,24,0.9)", border: `1px solid ${isListening ? "rgba(255,45,85,0.4)" : "rgba(255,255,255,0.1)"}` }}>
              {isListening ? <Mic className="h-5 w-5" style={{ color: "#FF2D55" }} /> : <MicOff className="h-5 w-5" style={{ color: "#9b8ec4" }} />}
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "#f0e8d8" }}>Voice Assistant</h3>
              <p className="text-xs" style={{ color: "#9b8ec4" }}>{isListening ? "Listening..." : "Click mic to start"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(!showHistory)}
              className="p-2 rounded-lg cursor-pointer" style={{ background: "rgba(10,8,24,0.9)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <List className="h-4 w-4" style={{ color: "#9b8ec4" }} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <button onClick={toggleListening}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
            style={{
              background: isListening ? "#FF2D55" : "rgba(10,8,24,0.9)",
              border: `1px solid ${isListening ? "#FF2D55" : "rgba(255,255,255,0.1)"}`,
              color: isListening ? "#fff" : "#f0e8d8",
            }}>
            {isListening ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
            {isListening ? "Stop" : "Start Listening"}
          </button>
          {transcript && (
            <button onClick={clearTranscript} className="p-2 rounded-lg cursor-pointer" style={{ color: "#9b8ec4" }}>
              <Trash className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="min-h-[160px] rounded-xl p-4" style={{ background: "rgba(10,8,24,0.9)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {transcript ? (
            <p className="text-xs leading-relaxed" style={{ color: "#c8b8f0" }}>{transcript}</p>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Volume2 className="h-8 w-8 mb-2" style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-xs" style={{ color: "#9b8ec4" }}>Speech will appear here...</p>
            </div>
          )}
        </div>

        {transcript && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => { onTranscript(transcript); }}
              className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ background: "linear-gradient(90deg, #FF2D55, #7000FF)", color: "#fff" }}>
              Send to Airi
            </button>
            <button onClick={() => speakThis(transcript)}
              className="px-4 py-2 rounded-lg text-xs cursor-pointer"
              style={{ background: "rgba(10,8,24,0.9)", border: "1px solid rgba(255,255,255,0.1)", color: "#00F2FF" }}>
              <Play className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {showHistory && (
          <div className="p-5 rounded-2xl backdrop-blur-md" style={{ background: "rgba(10,8,24,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider mb-3" style={{ color: "#9b8ec4" }}>Transcript History</h4>
            {history.length > 0 ? (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 rounded-lg p-2.5"
                    style={{ background: "rgba(10,8,24,0.9)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="flex-1">
                      <p className="text-[11px]" style={{ color: "#c8b8f0" }}>{h.text}</p>
                      <p className="text-[9px] mt-0.5" style={{ color: "#9b8ec4" }}>{h.timestamp.toLocaleTimeString()}</p>
                    </div>
                    <button onClick={() => speakThis(h.text)}
                      className="p-1 rounded cursor-pointer" style={{ color: "#00F2FF" }}>
                      <Play className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: "#9b8ec4" }}>No transcript history yet.</p>
            )}
          </div>
        )}

        <div className="p-5 rounded-2xl backdrop-blur-md" style={{ background: "rgba(10,8,24,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#9b8ec4" }}>
            <Volume2 className="h-3.5 w-3.5" style={{ color: "#00F2FF" }} />
            TTS Settings
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-mono block mb-1" style={{ color: "#9b8ec4" }}>Voice</label>
              <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                style={{ background: "rgba(10,8,24,0.9)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0e8d8" }}>
                {voices.map(v => (
                  <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono block mb-1" style={{ color: "#9b8ec4" }}>Rate: {rate.toFixed(1)}x</label>
              <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={e => setRate(parseFloat(e.target.value))}
                className="w-full accent-[#00F2FF] cursor-pointer" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl backdrop-blur-md" style={{ background: "rgba(10,8,24,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider mb-3" style={{ color: "#9b8ec4" }}>Quick Phrases</h4>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              "Start focus session",
              "Take a break",
              "What's my schedule?",
              "Motivate me!",
              "Summarize my notes",
              "Good job!",
            ].map((phrase, i) => (
              <button key={i} onClick={() => speakThis(phrase)}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer text-left truncate hover:bg-white/5 transition-all"
                style={{ background: "rgba(10,8,24,0.9)", borderColor: "rgba(255,255,255,0.1)", color: "#9b8ec4" }}>
                "{phrase}"
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
