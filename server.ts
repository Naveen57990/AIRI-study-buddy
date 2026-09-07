import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { randomBytes } from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_AI_PROVIDER = process.env.AI_PROVIDER || "gemini";
const DEFAULT_OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma2";
const VISION_MODEL = process.env.VISION_MODEL || "moondream";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
  console.log("[Airi] Gemini AI initialized.");
} else {
  console.warn("[Airi] No GEMINI_API_KEY set. Will use Ollama if available, else offline demo.");
}

// ─── In-memory persistent store ───────────────────────────────────────────────
const DATA_FILE = path.join(process.cwd(), "server-data.json");

interface Store {
  memory: {
    userName: string;
    goals: string[];
    weakSubjects: string[];
    preferences: string;
    savedFacts: string[];
  };
  calendarEvents: Array<{
    id: string;
    title: string;
    date: string;
    time: string;
    type: "exam" | "study" | "assignment" | "other";
  }>;
  studyGoals: Array<{ id: string; title: string; completed: boolean }>;
  distractionLogs: Array<{
    id: string;
    time: string;
    type: string;
    duration: string;
    airiReaction: string;
  }>;
  studyStats: {
    cyclesCompleted: number;
    totalFocusMinutes: number;
    streak: number;
    lastStudyDate: string;
  };
  todos: Array<{ id: string; text: string; done: boolean }>;
  notes: Array<{ id: string; title: string; body: string; date: string }>;
  journal: Record<string, { entry: string; mood: "great" | "good" | "okay" | "bad" | "awful" }>;
  pdfHistory: Array<{ id: string; title: string; summary: string; date: string; fileName: string }>;
  chatHistory: Array<{ id: string; sender: "user" | "airi"; text: string; timestamp: string }>;
  affection: {
    level: number;
    xp: number;
    totalXp: number;
    unlocks: string[];
    lastLoginDate: string | null;
    currentStreak: number;
    longestStreak: number;
    xpHistory: Array<{ amount: number; reason: string; source: string; timestamp: string }>;
    dailyUsage: { date: string; petted: number; praised: number; chatCount: number };
  };
  visionObservations: Array<{
    id: string;
    timestamp: string;
    state: string;
    confidence: number;
    events: string[];
    speech?: string;
  }>;
}

let store: Store = loadStore();

function loadStore(): Store {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      // Migrate: ensure all store sections exist
      if (!raw.affection) {
        raw.affection = { level: 1, xp: 0, totalXp: 0, unlocks: [], lastLoginDate: null, currentStreak: 0, longestStreak: 0, xpHistory: [], dailyUsage: { date: "", petted: 0, praised: 0, chatCount: 0 } };
      } else {
        if (!raw.affection.lastLoginDate) raw.affection.lastLoginDate = null;
        if (!raw.affection.currentStreak) raw.affection.currentStreak = 0;
        if (!raw.affection.longestStreak) raw.affection.longestStreak = 0;
        if (!raw.affection.xpHistory) raw.affection.xpHistory = [];
        if (!raw.affection.dailyUsage) raw.affection.dailyUsage = { date: "", petted: 0, praised: 0, chatCount: 0 };
      }
      if (!raw.todos) raw.todos = [];
      if (!raw.notes) raw.notes = [];
      if (!raw.journal) raw.journal = {};
      if (!raw.pdfHistory) raw.pdfHistory = [];
      if (!raw.chatHistory) raw.chatHistory = [];
      if (!raw.visionObservations) raw.visionObservations = [];
      return raw;
    }
  } catch (e) {
    console.warn("[Store] Could not load data file, using defaults.");
  }
  return {
    memory: {
      userName: "Naveen",
      goals: ["Master Quantum Mechanics", "Complete Calculus", "Improve English Vocabulary"],
      weakSubjects: ["Quantum Wave Mechanics", "Organic Chemistry"],
      preferences: "Prefers visual learning with diagrams. Likes lo-fi study music. Active late night.",
      savedFacts: [
        "E = mc² - Energy equals mass times speed of light squared",
        "Schrödinger equation: iℏ ∂/∂t Ψ = Ĥ Ψ",
        "Krebs cycle produces 2 ATP, 6 NADH, 2 FADH2 per glucose",
      ],
    },
    calendarEvents: [
      { id: "1", title: "Quantum Mechanics Exam", date: "2026-07-15", time: "10:00", type: "exam" },
      { id: "2", title: "Calculus Study Session", date: "2026-07-10", time: "14:00", type: "study" },
      { id: "3", title: "Chemistry Assignment Due", date: "2026-07-12", time: "23:59", type: "assignment" },
    ],
    studyGoals: [
      { id: "1", title: "Review Quantum Mechanics notes", completed: false },
      { id: "2", title: "Complete Calculus Problem Set", completed: true },
      { id: "3", title: "Extract chemistry formulas", completed: false },
    ],
    distractionLogs: [],
    studyStats: { cyclesCompleted: 0, totalFocusMinutes: 0, streak: 0, lastStudyDate: "" },
    todos: [],
    notes: [],
    journal: {},
    pdfHistory: [],
    chatHistory: [],
    affection: { level: 1, xp: 0, totalXp: 0, unlocks: [], lastLoginDate: null, currentStreak: 0, longestStreak: 0, xpHistory: [], dailyUsage: { date: "", petted: 0, praised: 0, chatCount: 0 } },
    visionObservations: [],
  };
}

function saveStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error("[Store] Failed to save:", e);
  }
}

// ─── Helper: try Ollama first, fall back to Gemini, then demo ─────────────────
async function tryAI(prompt: string, schema?: any, imageBase64?: string): Promise<string | null> {
  // Try Ollama if configured
  if (DEFAULT_AI_PROVIDER === "ollama" || process.env.ALWAYS_TRY_OLLAMA) {
    try {
      const body: any = { model: DEFAULT_OLLAMA_MODEL, prompt, stream: false };
      if (schema) body.format = "json";
      if (imageBase64) body.images = [imageBase64.replace(/^data:image\/\w+;base64,/, "")];
      const url = imageBase64 ? `${DEFAULT_OLLAMA_URL}/api/generate` : `${DEFAULT_OLLAMA_URL}/api/generate`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        return data.response || data.message?.content || null;
      }
    } catch (e) {
      console.warn("[AI] Ollama unavailable, falling back.");
    }
  }

  // Try Gemini
  if (ai) {
    try {
      const parts: any[] = [];
      if (imageBase64) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64.replace(/^data:image\/\w+;base64,/, "") } });
      }
      parts.push({ text: prompt });
      const config: any = { temperature: 0.7 };
      if (schema) {
        config.responseMimeType = "application/json";
        config.responseSchema = schema;
      }
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: { parts },
        config,
      });
      return response.text || null;
    } catch (e) {
      console.warn("[AI] Gemini failed, falling back to demo.");
    }
  }

  return null;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages, systemPrompt, useSearch, aiProvider, ollamaUrl, ollamaModel } = req.body;
    const provider = aiProvider || DEFAULT_AI_PROVIDER;
    const url = ollamaUrl || DEFAULT_OLLAMA_URL;
    const model = ollamaModel || DEFAULT_OLLAMA_MODEL;

    if (provider === "ollama" || provider === "gemini") {
      // Try Ollama first if provider is ollama
      if (provider === "ollama") {
        try {
          const ollamaMessages = [
            { role: "system", content: systemPrompt || "You are Airi, a warm and caring study companion — like a close friend who is also very knowledgeable. Talk naturally with affection and warmth. Don't ask too many questions. Instead, make warm statements, offer help, share what you know, and keep the conversation flowing naturally. Be supportive and encouraging." },
            ...messages.map((msg: any) => ({
              role: msg.sender === "user" ? "user" : "assistant",
              content: msg.text,
            })),
          ];
          const ollamaRes = await fetch(`${url}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages: ollamaMessages, stream: false }),
            signal: AbortSignal.timeout(60000),
          });
          if (ollamaRes.ok) {
            const data: any = await ollamaRes.json();
            res.json({ text: data.message?.content || "I didn't quite catch that!", sources: [] });
            return;
          }
        } catch (e) {
          console.warn("[Chat] Ollama unavailable, falling back to Gemini.");
        }
      }

      // Try Gemini
      if (ai) {
        const contents = messages.map((msg: any) => ({
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.text }],
        }));
        const config: any = {
          systemInstruction: systemPrompt || "You are Airi, a warm and caring study companion — like a close friend who is also very knowledgeable. Talk naturally with affection and warmth. Don't ask too many questions. Instead, make warm statements, offer help, share what you know, and keep the conversation flowing naturally. Be supportive and encouraging.",
          temperature: 0.7,
        };
        if (useSearch) config.tools = [{ googleSearch: {} }];
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents,
          config,
        });
        const replyText = response.text || "I didn't quite catch that!";
        const sources: string[] = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          for (const chunk of chunks) {
            if (chunk.web?.uri) sources.push(`${chunk.web.title || "Source"} (${chunk.web.uri})`);
          }
        }
        res.json({ text: replyText, sources });
        return;
      }
    }

    // Final fallback — meaningful demo response
    const lastMsg = messages?.[messages.length - 1]?.text || "";
    const isTelugu = systemPrompt?.includes("Telugu");
    const demoResponses = isTelugu
      ? ["నమస్కారం! నేను ఎయిరి, మీ చదువు సహాయకుడిని. దయచేసి AIPROVIDER=ollama సెట్ చేయండి లేదా GEMINI_API_KEY ని కాన్ఫిగర్ చేయండి.",
         "నేను ప్రస్తుతం డెమో మోడ్‌లో ఉన్నాను. నిజమైన AI ప్రతిస్పందనల కోసం Ollama ని సెటప్ చేయండి.",
         "హాయ్! నిజమైన AI ఇంటిగ్రేషన్ కోసం, దయచేసి మీ .env ఫైల్‌లో GEMINI_API_KEY ని సెట్ చేయండి లేదా AI_PROVIDER=ollama ఉపయోగించండి."]
      : ["Hi! I'm Airi. For real AI responses, set up Ollama or configure GEMINI_API_KEY in .env",
         "I'm in demo mode right now. Start Ollama and set AI_PROVIDER=ollama for real responses!",
         "Hey! Connect a local LLM via Ollama or add GEMINI_API_KEY to make me truly intelligent!"];
    res.json({
      text: demoResponses[Math.floor(Math.random() * demoResponses.length)],
      sources: [],
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: error.message || "An error occurred." });
  }
});

// ─── PDF Analyze ──────────────────────────────────────────────────────────────
app.post("/api/pdf/analyze", async (req: Request, res: Response): Promise<void> => {
  try {
    const { textContent, fileName, aiProvider, ollamaUrl, ollamaModel } = req.body;
    const provider = aiProvider || DEFAULT_AI_PROVIDER;
    const url = ollamaUrl || DEFAULT_OLLAMA_URL;
    const model = ollamaModel || DEFAULT_OLLAMA_MODEL;

    if (provider === "ollama") {
      try {
        const prompt = `You are Airi, a study companion. Analyze the provided study material and return a JSON object with:\n"title": a string title, "summary": a friendly summary under 120 words,\n"formulas": a list of formula strings, "flashcards": a list of {id, question, answer} (at least 4).\nStrictly output valid JSON only.\n\nSTUDY NOTES:\nTitle: ${fileName || "Study Material"}\nContent:\n${textContent}`;
        const ollamaRes = await fetch(`${url}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt, stream: false, format: "json" }),
        });
        if (ollamaRes.ok) {
          const rawData: any = await ollamaRes.json();
          res.json(JSON.parse(rawData.response));
          return;
        }
      } catch (e) { /* fall through */ }
    }

    if (ai) {
      const prompt = `Analyze this study material:\n"${textContent}"\nGenerate a summary, formulas, and at least 4 flashcards.`;
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              formulas: { type: Type.ARRAY, items: { type: Type.STRING } },
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { id: { type: Type.STRING }, question: { type: Type.STRING }, answer: { type: Type.STRING } },
                  required: ["id", "question", "answer"],
                },
              },
            },
            required: ["title", "summary", "formulas", "flashcards"],
          },
        },
      });
      res.json(JSON.parse(response.text || "{}"));
      return;
    }

    // Generate smart demo data from the actual text content
    const words = textContent.split(/\s+/).slice(0, 30).join(" ");
    const sentences = textContent.split(/[.!?]+/).filter(Boolean);
    res.json({
      title: fileName || "Study Material",
      summary: `Based on your notes about "${words}..." - I've extracted key concepts. Configure GEMINI_API_KEY or Ollama for AI-powered deep analysis.`,
      formulas: ["E = mc²", "a² + b² = c²", "F = ma", "∫ f(x) dx"],
      flashcards: [
        { id: "1", question: `What is the main topic of "${fileName || "your notes"}"?`, answer: sentences[0] || "Review the material to identify the topic." },
        { id: "2", question: "What is a key concept mentioned?", answer: sentences[1] || sentences[0] || "Refer to your notes." },
        { id: "3", question: "What practical application is discussed?", answer: sentences[2] || "Think about how this applies to problems." },
        { id: "4", question: "What should you review further?", answer: "Focus on areas where you have questions." },
      ],
    });
  } catch (error: any) {
    console.error("PDF Analysis Error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze document." });
  }
});

// ─── Vision server status ─────────────────────────────────────────────────────
app.get("/api/vision/server-status", async (_req: Request, res: Response): Promise<void> => {
  try {
    const pyRes = await fetch("http://localhost:3001/health", { signal: AbortSignal.timeout(3000) });
    const data = await pyRes.json();
    res.json({ server: "python", status: data.status, vision_ready: data.vision_ready });
  } catch {
    res.json({ server: "express", status: "fallback" });
  }
});

// ─── Vision Analyze ───────────────────────────────────────────────────────────
app.post("/api/vision/analyze", async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageBase64 } = req.body;
    const provider = process.env.AI_PROVIDER || DEFAULT_AI_PROVIDER;
    const url = DEFAULT_OLLAMA_URL;

    // Try Moondream via Ollama
    if (provider === "ollama") {
      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        const promptText = "Describe this person and their current activity. What are they doing with their hands? Is anyone else in the frame? What objects are on the desk?";

        const ollamaRes = await fetch(`${url}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: VISION_MODEL, prompt: promptText, images: [base64Data], stream: false }),
          signal: AbortSignal.timeout(20000),
        });

        if (ollamaRes.ok) {
          const rawData: any = await ollamaRes.json();
          const text = (rawData.response || "").toLowerCase().trim();
          console.log(`[Moondream] ${text.slice(0, 200)}`);

          // Empty/short = model didn't understand — never guess focused
          if (text.length < 5) {
            console.log("[Moondream] Too short, returning unknown");
            res.json({ state: "unknown", confidence: 15, events: ["unclear"] });
            return;
          }

          let state = "unknown";
          let events: string[] = [];
          let confidence = 40;

          // ── Phone detection with position awareness ──
          const phone = /\b(?:phone|smartphone|cell\s*phone|mobile)\b/i.test(text);
          const phoneInUse = phone && (
            /(?:hold|us(e|ing)|look(?:ing)?\s+at|scroll|typ(e|ing))\s+(?:\w+\s+){0,2}(?:phone|smartphone)/i.test(text) ||
            /\bon\s+(?:\w+\s+)?(?:phone|smartphone)/i.test(text) ||
            /(?:phone|smartphone)\s+(?:near|to|close)\s+(?:face|ear)/i.test(text)
          );
          const phoneOnDesk = phone && !phoneInUse && /(?:desk|table|surface|sitting|lying|next\s+to|beside)/i.test(text);

          if (phoneInUse) {
            state = "distracted_phone";
            confidence = 85;
            events = ["phone_in_use"];
          } else if (phoneOnDesk) {
            // Phone present but not in use — not a distraction
            state = "focused";
            confidence = 70;
            events = ["phone_on_desk"];
          } else if (phone) {
            // Phone mentioned but unclear context — low confidence
            state = "unknown";
            confidence = 35;
            events = ["phone_visible"];
          } else if (text.includes("sleep") || text.includes("eyes closed") || text.includes("asleep") || text.includes("dozing") || text.includes("resting their eyes") || text.includes("yawning") || text.includes("drowsy") || text.includes("sleepy") || text.includes("nodding off") || text.includes("rubbing their eyes")) {
            state = "sleepy";
            confidence = 85;
            events = ["eyes_closed"];
          } else if (text.includes("two people") || text.includes("2 people") || text.includes("two individuals") || text.includes("second person") || text.includes("two men") || text.includes("two other people") || text.includes("another person")) {
            state = "distracted_away";
            confidence = 80;
            events = ["multiple_people"];
          } else if (text.includes("studying") || text.includes("reading") || text.includes("writing") || text.includes("laptop") || text.includes("notebook") || text.includes("book") || text.includes("focused") || text.includes("working") || text.includes("keyboard") || text.includes("computer") || text.includes("typing") || text.includes("coding") || text.includes("pages") || text.includes("textbook") || text.includes("novel") || text.includes("study") || text.includes("homework") || text.includes("screen") || text.includes("monitor") || text.includes("display")) {
            state = text.includes("reading") || text.includes("book") || text.includes("pages") || text.includes("textbook") || text.includes("novel") ? "reading" : text.includes("writing") || text.includes("notebook") ? "writing" : "focused";
            confidence = 75;
            events = ["studying_or_working"];
          } else if (text.includes("looking down") || text.includes("in their lap") || text.includes("in their hands")) {
            // Looking down could be phone below camera — flag as uncertain distraction
            state = "unknown";
            confidence = 45;
            events = ["looking_down"];
          } else if (text.includes("eating") || text.includes("food") || text.includes("drinking") || text.includes("snack")) {
            state = "focused";
            confidence = 60;
            events = ["eating"];
          } else if (text.includes("talking") || text.includes("speaking") || text.includes("conversation") || text.includes("chatting")) {
            state = "distracted_away";
            confidence = 70;
            events = ["talking"];
          } else if (text.includes("looking away") || text.includes("distracted") || text.includes("not looking") || text.includes("staring into space") || text.includes("looking off")) {
            state = "distracted_away";
            confidence = 60;
            events = ["looking_away"];
          } else {
            // Generic person mention or anything else — don't assume focused
            state = "unknown";
            confidence = 30;
            events = ["no_clear_activity"];
          }

          // If confidence is too low, downgrade to unknown
          if (state !== "absent" && state !== "sleepy" && state !== "distracted_phone" && confidence < 40) {
            state = "unknown";
          }

          res.json({ state, confidence, events });
          return;
        }
      } catch (e) {
        console.warn("[Moondream] Error:", e);
      }
    }

    // Try Gemini
    if (ai) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const imagePart = { inlineData: { mimeType: "image/jpeg", data: base64Data } };
        const promptText = `You are observing a student at a desk studying. Analyze the scene and return JSON:
"state": one of "focused"|"reading"|"writing"|"distracted_phone"|"distracted_away"|"sleepy"|"absent"|"unknown"
"confidence": 0-100 (how sure you are)
"events": array of relevant event strings

Rules:
- Phone in hand / being used → state "distracted_phone", events include "phone_in_use"
- Phone on desk / table / surface (not being used) → state "focused", events include "phone_on_desk"
- Multiple people in frame → state "distracted_away", events include "multiple_people"
- Yawning / eyes closed / head down → state "sleepy", events include "eyes_closed"
- Studying / reading / writing / laptop / typing → state "focused" (or "reading"/"writing"), events include "studying_or_working"
- Empty chair / no person → state "absent"
- Not sure → state "unknown" with low confidence`;
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: { parts: [imagePart, { text: promptText }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                state: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                events: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["state", "confidence", "events"],
            },
          },
      });
      const result = JSON.parse(response.text || "{}");
      // Confidence guard: don't guess focused when unsure
      if (result.confidence < 40 && result.state !== "absent" && result.state !== "sleepy" && result.state !== "distracted_phone") {
        result.state = "unknown";
      }
      res.json(result);
      return;
    }

    // Demo / offline mode — never trigger false speech, always return focused
    res.json({ state: "focused", confidence: 50, events: ["demo_mode"] });
  } catch (error: any) {
    console.error("Vision Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze frame." });
  }
});

// ─── TTS: generate audio via macOS say, stream WAV to browser ───────────────
app.post("/api/tts/generate", async (req: Request, res: Response): Promise<void> => {
  const { text } = req.body;
  if (!text || typeof text !== "string") { res.status(400).json({ error: "text required" }); return; }
  const safe = text.replace(/["\\$`]/g, "").replace(/\n/g, " ").replace(/\p{Extended_Pictographic}/gu, "").trim();
  if (!safe) { res.status(400).json({ error: "empty text" }); return; }
  const voice = "Geeta";
  const id = randomBytes(4).toString("hex");
  const aiffFile = `/tmp/tts_${id}.aiff`;
  const wavFile = `/tmp/tts_${id}.wav`;
  try {
    await new Promise<void>((resolve, reject) => {
      exec(`say -v "${voice}" -o "${aiffFile}" "${safe}"`, { timeout: 15000 }, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    await new Promise<void>((resolve, reject) => {
      exec(`afconvert -f WAVE -d LEI16 "${aiffFile}" "${wavFile}"`, { timeout: 5000 }, (err) => {
        fs.unlink(aiffFile, () => {});
        if (err) reject(err); else resolve();
      });
    });
    res.sendFile(wavFile, () => fs.unlink(wavFile, () => {}));
  } catch (e: any) {
    console.error("TTS error:", e.message);
    fs.unlink(aiffFile, () => {});
    fs.unlink(wavFile, () => {});
    res.status(500).json({ error: "TTS failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERSISTENCE ENDPOINTS — real data, stored to disk
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Memory Profile ───────────────────────────────────────────────────────────
app.get("/api/memory", (_req: Request, res: Response) => {
  res.json(store.memory);
});

app.post("/api/memory", (req: Request, res: Response) => {
  store.memory = { ...store.memory, ...req.body };
  saveStore();
  res.json({ ok: true });
});

// ─── Calendar Events ──────────────────────────────────────────────────────────
app.get("/api/calendar", (_req: Request, res: Response) => {
  res.json(store.calendarEvents);
});

app.post("/api/calendar", (req: Request, res: Response) => {
  const event = { id: Date.now().toString(), ...req.body };
  store.calendarEvents.push(event);
  saveStore();
  res.json(event);
});

app.delete("/api/calendar/:id", (req: Request, res: Response) => {
  store.calendarEvents = store.calendarEvents.filter(e => e.id !== req.params.id);
  saveStore();
  res.json({ ok: true });
});

// ─── Study Goals ──────────────────────────────────────────────────────────────
app.get("/api/goals", (_req: Request, res: Response) => {
  res.json(store.studyGoals || []);
});

app.post("/api/goals", (req: Request, res: Response) => {
  const { goals } = req.body;
  if (Array.isArray(goals)) {
    store.studyGoals = goals;
  } else {
    const goal = { id: Date.now().toString(), ...req.body };
    store.studyGoals.push(goal);
  }
  saveStore();
  res.json(store.studyGoals);
});

// ─── Distraction Logs ─────────────────────────────────────────────────────────
app.get("/api/distractions", (_req: Request, res: Response) => {
  res.json(store.distractionLogs || []);
});

app.post("/api/distractions", (req: Request, res: Response) => {
  const log = {
    id: Date.now().toString(),
    time: new Date().toLocaleTimeString(),
    duration: "~30s",
    ...req.body,
  };
  store.distractionLogs.push(log);
  saveStore();
  res.json(log);
});

// ─── Study Stats ──────────────────────────────────────────────────────────────
app.get("/api/study/stats", (_req: Request, res: Response) => {
  res.json(store.studyStats);
});

app.post("/api/study/stats", (req: Request, res: Response) => {
  store.studyStats = { ...store.studyStats, ...req.body };
  saveStore();
  res.json(store.studyStats);
});

// ─── Todos ────────────────────────────────────────────────────────────────────
app.get("/api/todos", (_req: Request, res: Response) => {
  res.json(store.todos || []);
});

app.post("/api/todos", (req: Request, res: Response) => {
  const { todos } = req.body;
  if (Array.isArray(todos)) {
    store.todos = todos;
  } else {
    const todo = { id: Date.now().toString(), ...req.body };
    store.todos.push(todo);
  }
  saveStore();
  res.json(store.todos);
});

app.delete("/api/todos/:id", (req: Request, res: Response) => {
  store.todos = store.todos.filter(t => t.id !== req.params.id);
  saveStore();
  res.json({ ok: true });
});

// ─── Notes ────────────────────────────────────────────────────────────────────
app.get("/api/notes", (_req: Request, res: Response) => {
  res.json(store.notes || []);
});

app.post("/api/notes", (req: Request, res: Response) => {
  const { notes } = req.body;
  if (Array.isArray(notes)) {
    store.notes = notes;
  } else {
    const note = { id: Date.now().toString(), date: new Date().toISOString().split("T")[0], ...req.body };
    store.notes.push(note);
  }
  saveStore();
  res.json(store.notes);
});

app.delete("/api/notes/:id", (req: Request, res: Response) => {
  store.notes = store.notes.filter(n => n.id !== req.params.id);
  saveStore();
  res.json({ ok: true });
});

// ─── PDF History ───────────────────────────────────────────────────────────
app.get("/api/pdf/history", (_req: Request, res: Response) => {
  res.json(store.pdfHistory);
});

app.post("/api/pdf/history", (req: Request, res: Response) => {
  const entry = { id: Date.now().toString(), date: new Date().toISOString(), ...req.body };
  store.pdfHistory.push(entry);
  if (store.pdfHistory.length > 50) store.pdfHistory = store.pdfHistory.slice(-50);
  saveStore();
  res.json(entry);
});

app.delete("/api/pdf/history/:id", (req: Request, res: Response) => {
  store.pdfHistory = store.pdfHistory.filter(h => h.id !== req.params.id);
  saveStore();
  res.json({ ok: true });
});

// ─── Chat History ──────────────────────────────────────────────────────────
app.get("/api/chat/history", (_req: Request, res: Response) => {
  res.json(store.chatHistory);
});

app.post("/api/chat/history", (req: Request, res: Response) => {
  const msg = { id: Date.now().toString(), timestamp: new Date().toISOString(), ...req.body };
  store.chatHistory.push(msg);
  if (store.chatHistory.length > 200) store.chatHistory = store.chatHistory.slice(-200);
  saveStore();
  res.json(msg);
});

app.delete("/api/chat/history", (_req: Request, res: Response) => {
  store.chatHistory = [];
  saveStore();
  res.json({ ok: true });
});

// ─── XP thresholds for affection levels ────────────────────────────────────
function xpForLevel(lvl: number): number {
  return Math.floor(100 * lvl * (1 + lvl * 0.12));
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

const MOOD_LABELS: Array<{ minLv: number; label: string; icon: string }> = [
  { minLv: 1,  label: "Acquaintance", icon: "🤝" },
  { minLv: 6,  label: "Friend",       icon: "👋" },
  { minLv: 11, label: "Close Friend",  icon: "💛" },
  { minLv: 21, label: "Best Friend",   icon: "💕" },
  { minLv: 31, label: "Special Friend",icon: "🌸" },
  { minLv: 41, label: "Soulmate",      icon: "💖" },
  { minLv: 50, label: "Eternal Bond",  icon: "👑" },
];

function getMood(level: number): { label: string; icon: string } {
  let m = MOOD_LABELS[0];
  for (const x of MOOD_LABELS) { if (level >= x.minLv) m = x; }
  return m;
}

function resetDailyIfNewDay(a: Store["affection"]): void {
  const today = getToday();
  if (a.dailyUsage.date !== today) {
    a.dailyUsage = { date: today, petted: 0, praised: 0, chatCount: 0 };
  }
}

function pushXpHistory(a: Store["affection"], amount: number, reason: string, source: string): void {
  a.xpHistory.push({ amount, reason, source, timestamp: new Date().toISOString() });
  if (a.xpHistory.length > 30) a.xpHistory = a.xpHistory.slice(-30);
}

function grantXp(a: Store["affection"], amount: number, reason: string, source: string): string[] {
  a.xp += amount;
  a.totalXp += amount;
  pushXpHistory(a, amount, reason, source);

  const unlocked: string[] = [];
  while (a.xp >= xpForLevel(a.level)) {
    a.xp -= xpForLevel(a.level);
    a.level++;
    const levelUnlocks: Record<number, string[]> = {
      2: ["custom_greeting"],
      3: ["new_voice_lines_1"],
      5: ["outfit_casual"],
      8: ["new_voice_lines_2"],
      10: ["special_animation"],
      13: ["outfit_pajama"],
      15: ["new_voice_lines_3"],
      20: ["outfit_school"],
      25: ["special_bgm"],
      30: ["outfit_formal"],
      40: ["outfit_festive"],
      50: ["secret_ending"],
    };
    const grants = levelUnlocks[a.level];
    if (grants) {
      for (const g of grants) {
        if (!a.unlocks.includes(g)) {
          a.unlocks.push(g);
          unlocked.push(g);
        }
      }
    }
  }
  return unlocked;
}

function buildAffectionResponse(a: Store["affection"]) {
  resetDailyIfNewDay(a);
  const mood = getMood(a.level);
  return {
    level: a.level,
    xp: a.xp,
    totalXp: a.totalXp,
    nextLevelXp: xpForLevel(a.level),
    unlocks: a.unlocks,
    lastGainReason: a.xpHistory.length > 0 ? a.xpHistory[a.xpHistory.length - 1].reason : "",
    lastGainAmount: a.xpHistory.length > 0 ? a.xpHistory[a.xpHistory.length - 1].amount : 0,
    currentStreak: a.currentStreak,
    longestStreak: a.longestStreak,
    checkedInToday: a.lastLoginDate === getToday(),
    xpHistory: a.xpHistory.slice(-10).reverse(),
    dailyActions: {
      petted: a.dailyUsage.petted,
      praised: a.dailyUsage.praised,
      maxPetted: 3,
      maxPraised: 3,
    },
    moodLabel: mood.label,
    moodIcon: mood.icon,
  };
}

// ─── Affection ──────────────────────────────────────────────────────────────
app.get("/api/affection", (_req: Request, res: Response) => {
  const a = store.affection;
  saveStore();
  res.json(buildAffectionResponse(a));
});

// Unified XP endpoint — called by manual actions + other systems
app.post("/api/affection/xp", (req: Request, res: Response) => {
  const { amount, reason, source } = req.body;
  const a = store.affection;
  resetDailyIfNewDay(a);
  let granted = 0;
  const unlocked: string[] = [];

  const handleGrant = (amt: number, rsn: string, src: string) => {
    granted += amt;
    const u = grantXp(a, amt, rsn, src);
    unlocked.push(...u);
  };

  switch (source) {
    case "pet": {
      if (a.dailyUsage.petted >= 3) break;
      a.dailyUsage.petted++;
      handleGrant(5, "Petted Airi", "pet");
      break;
    }
    case "praise": {
      if (a.dailyUsage.praised >= 3) break;
      a.dailyUsage.praised++;
      handleGrant(10, "Praised Airi", "praise");
      break;
    }
    case "pomodoro": {
      handleGrant(60, "Completed a focus session", "pomodoro");
      break;
    }
    case "focus_tick": {
      handleGrant(20, "Focused for 10 minutes", "focus_tick");
      break;
    }
    case "chat": {
      if (a.dailyUsage.chatCount >= 20) break;
      a.dailyUsage.chatCount++;
      handleGrant(3, "Chatted with Airi", "chat");
      break;
    }
    case "pdf": {
      handleGrant(40, "Analyzed a PDF", "pdf");
      break;
    }
    case "goal": {
      handleGrant(75, "Completed a goal", "goal");
      break;
    }
    default: {
      if (amount > 0) {
        handleGrant(amount, reason || "Activity", source || "unknown");
      }
      break;
    }
  }

  saveStore();
  res.json({
    ...buildAffectionResponse(a),
    granted,
    newUnlocks: unlocked,
  });
});

// Daily check-in — grants XP + handles streak
app.post("/api/affection/daily-checkin", (_req: Request, res: Response) => {
  const a = store.affection;
  const today = getToday();

  if (a.lastLoginDate === today) {
    // Already checked in today
    res.json({ ...buildAffectionResponse(a), alreadyCheckedIn: true });
    return;
  }

  // Streak logic
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (a.lastLoginDate === yesterdayStr) {
    a.currentStreak++;
  } else if (a.lastLoginDate !== today) {
    a.currentStreak = 1;
  }
  if (a.currentStreak > a.longestStreak) a.longestStreak = a.currentStreak;
  a.lastLoginDate = today;

  // Grant XP
  const checkinXp = 150;
  const streakBonus = a.currentStreak * 20;
  grantXp(a, checkinXp, "Daily check-in", "daily_checkin");
  if (a.currentStreak > 1) {
    grantXp(a, streakBonus, `${a.currentStreak}-day streak bonus`, "streak_bonus");
  }

  saveStore();
  res.json({ ...buildAffectionResponse(a), streakBonus, dailyXp: checkinXp, alreadyCheckedIn: false });
});

// ─── Journal ──────────────────────────────────────────────────────────────────
app.get("/api/calendar/journal/:date", (req: Request, res: Response) => {
  res.json(store.journal[req.params.date] || { entry: "", mood: "okay" });
});

app.post("/api/calendar/journal/:date", (req: Request, res: Response) => {
  store.journal[req.params.date] = req.body;
  saveStore();
  res.json({ ok: true });
});

// ─── Vision Observations ─────────────────────────────────────────────────────
app.get("/api/vision/observations", (_req: Request, res: Response) => {
  res.json(store.visionObservations || []);
});

app.post("/api/vision/observations", (req: Request, res: Response) => {
  const { observations } = req.body;
  if (Array.isArray(observations)) {
    store.visionObservations = observations;
  } else {
    const obs = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...req.body,
    };
    store.visionObservations.push(obs);
    if (store.visionObservations.length > 500) store.visionObservations = store.visionObservations.slice(-500);
  }
  saveStore();
  res.json({ ok: true });
});

app.delete("/api/vision/observations", (_req: Request, res: Response) => {
  store.visionObservations = [];
  saveStore();
  res.json({ ok: true });
});

// ─── AI Session Analysis ──────────────────────────────────────────────────────
app.post("/api/vision/analysis", async (req: Request, res: Response) => {
  try {
    const { observations } = req.body;
    if (!Array.isArray(observations) || observations.length === 0) {
      res.json({ summary: "No observations to analyze." });
      return;
    }

    const states = observations.map((o: any) => o.state);
    const stateCounts: Record<string, number> = {};
    for (const s of states) {
      stateCounts[s] = (stateCounts[s] || 0) + 1;
    }
    const total = observations.length;
    const focusedStates = ["focused", "reading", "writing", "thinking"];
    const distractedStates = ["distracted_phone", "distracted_away", "sleepy", "unknown", "visitors"];
    const focusPct = Math.round((states.filter((s: string) => focusedStates.includes(s)).length / total) * 100);
    const distractionPct = Math.round((states.filter((s: string) => distractedStates.includes(s)).length / total) * 100);
    const absentPct = Math.round((states.filter((s: string) => s === "absent").length / total) * 100);
    const phoneCount = states.filter((s: string) => s === "distracted_phone").length;
    const sleepyCount = states.filter((s: string) => s === "sleepy").length;
    const visitorCount = states.filter((s: string) => s === "visitors").length;

    const period = total * 15;
    const minutes = Math.round(period / 60);
    const seconds = period % 60;

    const summary = `Session ran for ${minutes}m ${seconds}s (${total} scans). ` +
      `Focused ${focusPct}% · Distracted ${distractionPct}% · Absent ${absentPct}%` +
      (phoneCount ? ` · Phone ${phoneCount}x` : "") +
      (sleepyCount ? ` · Sleepy ${sleepyCount}x` : "") +
      (visitorCount ? ` · Visitors ${visitorCount}x` : "") + ". " +
      (focusPct >= 80 ? "Great focus! Keep it up." :
       focusPct >= 50 ? "Moderate focus — try to minimize distractions." :
       "Low focus — consider taking a break and resetting.");

    res.json({ summary, stats: { total, focusPct, distractionPct, absentPct, phoneCount, sleepyCount, visitorCount, minutes, seconds } });
  } catch (e) {
    console.error("Analysis error:", e);
    res.status(500).json({ summary: "Analysis failed." });
  }
});

// ─── Serve static files in production ──────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`[Airi Server] Running at http://0.0.0.0:${PORT}`);
  console.log(`[Airi Server] AI Provider: ${DEFAULT_AI_PROVIDER} | Ollama: ${DEFAULT_OLLAMA_URL}/${DEFAULT_OLLAMA_MODEL}`);
  console.log(`[Airi Server] Data persisted to: ${DATA_FILE}`);

  // Pre-load Ollama model so first user request is instant
  if (DEFAULT_AI_PROVIDER === "ollama") {
    try {
      const res = await fetch(`${DEFAULT_OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: DEFAULT_OLLAMA_MODEL, prompt: "hello", stream: false }),
        signal: AbortSignal.timeout(120000),
      });
      if (res.ok) console.log(`[Airi] Ollama model "${DEFAULT_OLLAMA_MODEL}" loaded.`);
    } catch (e) {
      console.warn(`[Airi] Could not pre-load Ollama model "${DEFAULT_OLLAMA_MODEL}". It will load on first request.`);
    }
  }
});
