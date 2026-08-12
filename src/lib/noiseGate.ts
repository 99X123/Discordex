export const applyNoiseSuppression = (stream: MediaStream, enabled: boolean): MediaStream => {
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
    const threshold = 30;
    let current = 0;

    const tick = () => {
      if (disposed) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = sum / data.length;
      const target = level > threshold ? 1 : 0;
      const smoothing = target > current ? 0.25 : 0.06;
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