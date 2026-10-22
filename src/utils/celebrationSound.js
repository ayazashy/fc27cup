/**
 * Procedural Web Audio API Celebration Synthesizer for FC27 Cup
 * Zero-dependency, lightweight, reliable audio synthesis for victorious fanfares and reaction pops.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Triumphant multi-stage victory fanfare (C5 -> E5 -> G5 -> C6)
 */
export function playCelebrationFanfare() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [
      { f: 523.25, d: 0.12, t: 0.00, gain: 0.15 }, // C5
      { f: 659.25, d: 0.12, t: 0.12, gain: 0.18 }, // E5
      { f: 783.99, d: 0.14, t: 0.24, gain: 0.20 }, // G5
      { f: 1046.50, d: 0.65, t: 0.38, gain: 0.26 } // C6 (grand finish)
    ];

    notes.forEach(({ f, d, t, gain: targetGain }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + d);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d);
    });
  } catch (e) {
    // Audio safe fallback
  }
}

/**
 * Cheerful pitch-varied pops for interactive reaction buttons
 */
export function playReactionPop(type = 'clap') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = {
      clap: 660,
      fire: 880,
      trophy: 1180,
      goal: 520,
      confetti: 980
    }[type] || 700;

    const randomPitchOffset = (Math.random() - 0.5) * 80;
    const finalFreq = Math.max(200, baseFreq + randomPitchOffset);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(finalFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(finalFreq * 1.4, ctx.currentTime + 0.07);

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch (e) {}
}
