export type NoiseSuppressionLevel = 'low' | 'medium' | 'high';

const LEVEL_CONFIG: Record<NoiseSuppressionLevel, { threshold: number; attack: number; release: number }> = {
  low: { threshold: 18, attack: 0.15, release: 0.03 },
  medium: { threshold: 30, attack: 0.25, release: 0.06 },
  high: { threshold: 45, attack: 0.4, release: 0.12 },
};

export const applyNoiseSuppression = (stream: MediaStream, enabled: boolean, level: NoiseSuppressionLevel = 'medium'): MediaStream => {
  if (!enabled) return stream;
  const audioTrack = stream.getAudioTracks()[0];
  const videoTrack = stream.getVideoTracks()[0] || null;
  if (!audioTrack) return stream;
  if (typeof window === 'undefined') return stream;

  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return stream;

  const input = new MediaStream([audioTrack]);
  let ctx: AudioContext | null = null;
  let raf = 0;
  let disposed = false;

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    if (ctx && ctx.state !== 'closed') void ctx.close();
    ctx = null;
    input.getTracks().forEach((track) => track.stop());
  };

  try {
    ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();

    const source = ctx.createMediaStreamSource(input);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const gain = ctx.createGain();
    const destination = ctx.createMediaStreamDestination();

    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(destination);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const { threshold, attack, release } = LEVEL_CONFIG[level];
    let current = 0;

    const tick = () => {
      if (disposed) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = sum / data.length;
      const target = level > threshold ? 1 : 0;
      const smoothing = target > current ? attack : release;
      current += (target - current) * smoothing;
      gain.gain.value = current;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const out = new MediaStream();
    destination.stream.getAudioTracks().forEach((track) => out.addTrack(track));
    if (videoTrack) out.addTrack(videoTrack);

    destination.stream.getAudioTracks()[0].addEventListener('ended', cleanup);

    return out;
  } catch {
    if (raf) cancelAnimationFrame(raf);
    if (ctx && ctx.state !== 'closed') void ctx.close();
    return stream;
  }
};