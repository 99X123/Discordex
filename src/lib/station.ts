// ============================================================
// Utilitários do conceito "Estação" — DiscordeX v2 SINAL.
// Frequência simulada, determinística por id de canal.
// ============================================================

export const channelFrequency = (channelId: string): string => {
  let h = 0;
  for (let i = 0; i < channelId.length; i++) {
    h = (h * 31 + channelId.charCodeAt(i)) >>> 0;
  }
  const base = 88 + (h % 890) / 10;
  return base.toFixed(1);
};

export const connectionLabel = (state: string): string =>
  state === 'online' ? 'SINAL OK' :
  state === 'connecting' ? 'SINCRONIZANDO' :
  state === 'reconnecting' ? 'RE-SINCRONIZANDO' :
  'SINAL PERDIDO';
