const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!ctx && AudioContextClass) {
    ctx = new AudioContextClass();
  }
  return ctx;
}

export function playSfx(type: "complete" | "click" | "delete" | "hover") {
  const audioCtx = getAudioContext();
  if (!audioCtx) return;

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === "complete") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === "click") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(150, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === "delete") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === "hover") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.02);
    osc.start(now);
    osc.stop(now + 0.02);
  }

  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(type === "complete" ? [50, 50, 50] : 5);
  }
}
