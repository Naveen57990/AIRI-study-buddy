import { useEffect, useRef, useState } from "react";
import type { Emotion } from "@/types";

interface AiriCharacterProps { emotion: Emotion; isSpeaking: boolean; }

export default function AiriCharacter({ emotion, isSpeaking }: AiriCharacterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [blinkState, setBlinkState] = useState(0);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<{ id: number; x: number; y: number; vy: number; vx: number; char: string; size: number; alpha: number; life: number }[]>([]);
  const nextParticleId = useRef(0);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkState(1);
      setTimeout(() => setBlinkState(0), 150);
    }, 4000 + Math.random() * 2000);
    return () => clearInterval(blinkInterval);
  }, []);

  useEffect(() => {
    const particleInterval = setInterval(() => {
      let char = "";
      if (emotion === "excited" || emotion === "happy") char = "💖";
      else if (emotion === "sleepy" || emotion === "sleeping") char = "💤";
      else if (emotion === "thinking") char = "❓";
      else if (emotion === "embarrassed") char = "💦";
      else if (emotion === "angry") char = "💢";
      else if (emotion === "sad") char = "💧";
      else if (emotion === "distracted") char = "🎮";
      if (char) {
        particlesRef.current.push({
          id: nextParticleId.current++,
          x: 80 + Math.random() * 90,
          y: 80 + Math.random() * 50,
          vy: -0.5 - Math.random() * 1.5,
          vx: -0.8 + Math.random() * 1.6,
          char,
          size: 14 + Math.random() * 12,
          alpha: 1,
          life: 1,
        });
      }
    }, 450);
    return () => clearInterval(particleInterval);
  }, [emotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let time = 0;

    const render = () => {
      time += 0.04;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const swayY = Math.sin(time) * 2;
      const swayX = Math.cos(time * 0.5) * 1.2;
      const hairWave = Math.sin(time * 1.5) * 2.5;

      // Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.beginPath();
      ctx.ellipse(125, 220, 45, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Neck
      ctx.fillStyle = "#fdddc9";
      ctx.beginPath();
      ctx.moveTo(110, 150 + swayY);
      ctx.lineTo(140, 150 + swayY);
      ctx.lineTo(135, 175 + swayY);
      ctx.lineTo(115, 175 + swayY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#f0c6b1";
      ctx.beginPath();
      ctx.moveTo(110, 150 + swayY);
      ctx.lineTo(140, 150 + swayY);
      ctx.lineTo(135, 158 + swayY);
      ctx.lineTo(115, 158 + swayY);
      ctx.closePath();
      ctx.fill();

      // Ribbon
      ctx.fillStyle = "#c53030";
      ctx.beginPath();
      ctx.moveTo(115, 172 + swayY);
      ctx.lineTo(135, 172 + swayY);
      ctx.lineTo(145, 188 + swayY);
      ctx.lineTo(125, 180 + swayY);
      ctx.lineTo(105, 188 + swayY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#f6ad55";
      ctx.beginPath();
      ctx.arc(125, 173 + swayY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Face
      ctx.fillStyle = "#ffebe0";
      ctx.beginPath();
      ctx.arc(125 + swayX, 110 + swayY, 48, 0, Math.PI * 2);
      ctx.fill();

      // Blush
      let blushAlpha = 0.08;
      if (emotion === "embarrassed" || emotion === "excited") blushAlpha = 0.35;
      else if (emotion === "happy") blushAlpha = 0.22;
      ctx.fillStyle = `rgba(255, 107, 129, ${blushAlpha})`;
      ctx.beginPath();
      ctx.ellipse(96 + swayX, 120 + swayY, 12, 6, Math.PI / 12, 0, Math.PI * 2);
      ctx.ellipse(154 + swayX, 120 + swayY, 12, 6, -Math.PI / 12, 0, Math.PI * 2);
      ctx.fill();

      // Nose
      ctx.strokeStyle = "#e2a991";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(125 + swayX, 112 + swayY);
      ctx.lineTo(124 + swayX, 116 + swayY);
      ctx.stroke();

      // Eyes
      const drawEye = (centerX: number, isLeft: boolean) => {
        const eyeOffset = isLeft ? -25 : 25;
        const eX = centerX + eyeOffset + swayX;
        const eY = 104 + swayY;

        ctx.strokeStyle = "#5a3a22";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        let browAng = 0;
        if (emotion === "angry") browAng = isLeft ? 0.25 : -0.25;
        else if (emotion === "sad" || emotion === "embarrassed") browAng = isLeft ? -0.15 : 0.15;
        ctx.ellipse(eX, eY - 22, 16, 4, browAng, Math.PI, Math.PI * 2);
        ctx.stroke();

        if (blinkState === 1 || emotion === "sleeping" || emotion === "sleepy") {
          ctx.strokeStyle = "#1a0f08";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.ellipse(eX, eY, 14, 8, 0, Math.PI, 0, false);
          ctx.stroke();
          return;
        }

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(eX, eY, 12, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1a0f08";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        let irisColor = "#ff7979";
        if (emotion === "angry") irisColor = "#ff4757";
        else if (emotion === "studying") irisColor = "#374151";
        else if (emotion === "excited") irisColor = "#feca57";

        ctx.fillStyle = irisColor;
        ctx.beginPath();
        ctx.ellipse(eX, eY, 9, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#1a0f08";
        ctx.beginPath();
        ctx.ellipse(eX, eY, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(eX - 3, eY - 4, 3, 0, Math.PI * 2);
        ctx.fill();
      };

      drawEye(125, true);
      drawEye(125, false);

      // Mouth
      const mX = 125 + swayX;
      const mY = 132 + swayY;
      ctx.fillStyle = "#f08080";
      ctx.strokeStyle = "#1a0f08";
      ctx.lineWidth = 2.5;

      if (isSpeaking) {
        const mouthHeight = 4 + Math.abs(Math.sin(time * 6.5)) * 11;
        ctx.beginPath();
        ctx.ellipse(mX, mY, 7, mouthHeight / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        switch (emotion) {
          case "happy":
          case "excited":
            ctx.ellipse(mX, mY + 2, 10, 6, 0, 0, Math.PI, false);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            break;
          case "sad":
          case "angry":
            ctx.arc(mX, mY + 7, 8, Math.PI, 0, false);
            ctx.stroke();
            break;
          case "sleepy":
          case "sleeping":
            ctx.ellipse(mX, mY, 3, 3, 0, 0, Math.PI * 2);
            ctx.stroke();
            break;
          case "surprised":
            ctx.ellipse(mX, mY + 3, 8, 9, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            break;
          default:
            ctx.arc(mX, mY - 3, 6, 0.1 * Math.PI, 0.9 * Math.PI, false);
            ctx.stroke();
            break;
        }
      }

      // Hair
      const hairColor = "#7a63a5";
      const hairColorDark = "#55447a";
      const ribbonColor = "#00F2FF";

      const leftTailSway = Math.sin(time * 1.2) * 5;
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.ellipse(65 + swayX, 85 + swayY + leftTailSway, 22, 38, Math.PI / 6 + leftTailSway * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hairColorDark;
      ctx.beginPath();
      ctx.ellipse(62 + swayX, 88 + swayY + leftTailSway, 15, 30, Math.PI / 6 + leftTailSway * 0.05, 0, Math.PI * 2);
      ctx.fill();

      const rightTailSway = Math.cos(time * 1.2) * 5;
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.ellipse(185 + swayX, 85 + swayY + rightTailSway, 22, 38, -Math.PI / 6 - rightTailSway * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hairColorDark;
      ctx.beginPath();
      ctx.ellipse(188 + swayX, 88 + swayY + rightTailSway, 15, 30, -Math.PI / 6 - rightTailSway * 0.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = ribbonColor;
      ctx.fillRect(72 + swayX, 62 + swayY, 10, 6);
      ctx.fillRect(168 + swayX, 62 + swayY, 10, 6);

      // Bangs
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.moveTo(74 + swayX, 100 + swayY);
      ctx.quadraticCurveTo(80 + swayX, 50 + swayY, 125 + swayX, 60 + swayY);
      ctx.quadraticCurveTo(90 + swayX, 85 + swayY, 82 + swayX + hairWave * 0.5, 128 + swayY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(176 + swayX, 100 + swayY);
      ctx.quadraticCurveTo(170 + swayX, 50 + swayY, 125 + swayX, 60 + swayY);
      ctx.quadraticCurveTo(160 + swayX, 85 + swayY, 168 + swayX - hairWave * 0.5, 128 + swayY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(115 + swayX, 62 + swayY);
      ctx.lineTo(135 + swayX, 62 + swayY);
      ctx.lineTo(125 + swayX, 96 + swayY);
      ctx.closePath();
      ctx.fill();

      // Side hair
      ctx.beginPath();
      ctx.moveTo(85 + swayX, 90 + swayY);
      ctx.quadraticCurveTo(60 + swayX, 120 + swayY, 68 + swayX + hairWave, 175 + swayY);
      ctx.quadraticCurveTo(78 + swayX, 140 + swayY, 85 + swayX, 110 + swayY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(165 + swayX, 90 + swayY);
      ctx.quadraticCurveTo(190 + swayX, 120 + swayY, 182 + swayX - hairWave, 175 + swayY);
      ctx.quadraticCurveTo(172 + swayX, 140 + swayY, 165 + swayX, 110 + swayY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = ribbonColor;
      ctx.fillRect(84 + swayX, 78 + swayY, 12, 4);
      ctx.fillRect(154 + swayX, 78 + swayY, 12, 4);

      // Desk
      ctx.fillStyle = "#8d5d36";
      ctx.fillRect(0, 205, canvas.width, 35);
      ctx.fillStyle = "#6f4625";
      ctx.fillRect(0, 205, canvas.width, 4);

      // Particles
      particlesRef.current.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.font = `${p.size}px Arial`;
        ctx.fillText(p.char, p.x, p.y);
        ctx.restore();
      });
      particlesRef.current = particlesRef.current
        .map(p => ({ ...p, y: p.y + p.vy, x: p.x + p.vx, alpha: p.alpha - 0.015, life: p.life - 0.015 }))
        .filter(p => p.life > 0 && p.alpha > 0);

      animFrameRef.current = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [blinkState, emotion, isSpeaking]);

  return (
    <div className="relative flex flex-col items-center justify-center bg-transparent select-none">
      <div className={`absolute h-44 w-44 rounded-full blur-3xl transition-colors duration-700 opacity-25 ${
        emotion === "happy" || emotion === "excited" ? "bg-[#FF2D55]"
        : emotion === "angry" ? "bg-red-500"
        : emotion === "sleeping" || emotion === "sleepy" ? "bg-[#7000FF]"
        : emotion === "studying" ? "bg-[#00F2FF]"
        : emotion === "distracted" ? "bg-yellow-400"
        : "bg-[#FF2D55]"
      }`} />
      <canvas ref={canvasRef} width={250} height={240} className="relative z-10 h-[240px] w-[250px] drop-shadow-xl" />
    </div>
  );
}
