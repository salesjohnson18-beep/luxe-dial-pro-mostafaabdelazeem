let ctx: AudioContext | null = null;

/** Clear two-tone bell using the Web Audio API (no audio file needed). */
export function playChime() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    [[1318.5, 0], [987.8, 0.18], [1318.5, 0.36]].forEach(([freq, at]) => {
      for (const [mult, vol] of [[1, 0.35], [2.76, 0.08], [5.4, 0.03]] as const) {
        const o = ctx!.createOscillator();
        const g = ctx!.createGain();
        o.type = "sine";
        o.frequency.value = freq! * mult;
        g.gain.setValueAtTime(0, now + at!);
        g.gain.linearRampToValueAtTime(vol, now + at! + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + at! + 1.4);
        o.connect(g).connect(ctx!.destination);
        o.start(now + at!);
        o.stop(now + at! + 1.5);
      }
    });
  } catch {
    /* audio blocked until user interacts */
  }
}
