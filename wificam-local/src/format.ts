export type Orientation = 'landscape' | 'portrait';

export function orientation(value: string | null): Orientation {
  return value === 'portrait' ? 'portrait' : 'landscape';
}

export function dimensions(width: number, height: number, format: Orientation) {
  return format === 'portrait'
    ? { width: Math.min(width, height), height: Math.max(width, height) }
    : { width: Math.max(width, height), height: Math.min(width, height) };
}

export function formatAdvice(width: number, height: number, format: Orientation): string {
  if (!width || !height) return 'À espera das dimensões da câmera.';
  const target = format === 'portrait' ? 9 / 16 : 16 / 9;
  if (Math.abs(width / height - target) / target > 0.05) {
    return `A câmera está a fornecer ${width} × ${height}, fora do formato escolhido. ` +
      `Rode o iPhone para ${format === 'portrait' ? 'vertical' : 'horizontal'}; se necessário, pare e inicie novamente. ` +
      'Preencher no OBS recorta a imagem e pode perder detalhe.';
  }
  return `Formato correto · ${width} × ${height}. Use a mesma proporção nas dimensões da Fonte de navegador do OBS.`;
}

export function formattedUrl(base: string, format: Orientation): string {
  const url = new URL(base);
  url.searchParams.set('orientation', format);
  return url.href;
}
