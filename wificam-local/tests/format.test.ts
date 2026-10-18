import { expect, it } from 'vitest';
import { dimensions, formatAdvice, formattedUrl, orientation } from '../src/format';
import { capture, constraints } from '../src/capture';

it('pede Full HD vertical e mantém a proporção no fallback 720p', () => {
  const attempts = constraints('1080p30', 'environment', '', 'portrait');
  expect(attempts[0]).toMatchObject({ width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: 9 / 16 } });
  expect(attempts[1]).toMatchObject({ width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 } });
});

it('envia o formato selecionado ao getUserMedia', async () => {
  let received: MediaStreamConstraints | undefined;
  const get = async (c: MediaStreamConstraints) => { received = c; return {} as MediaStream; };
  await capture(get, '4K30 experimental', 'environment', '', false, 'portrait');
  expect(received).toMatchObject({ video: { width: { ideal: 2160 }, height: { ideal: 3840 } }, audio: false });
});

it('mantém Full HD horizontal com 60 FPS solicitado', () => {
  expect(constraints('1080p60', 'environment', '', 'landscape')[0]).toMatchObject({ width: { ideal: 1920 }, height: { ideal: 1080 }, aspectRatio: { ideal: 16 / 9 }, frameRate: { ideal: 60 } });
  expect(dimensions(3840, 2160, 'portrait')).toEqual({ width: 2160, height: 3840 });
});

it('deteta o vídeo horizontal numa fonte vertical e formatos 4:3', () => {
  expect(formatAdvice(1920, 1080, 'portrait')).toContain('Rode o iPhone');
  expect(formatAdvice(1440, 1080, 'landscape')).toContain('fora do formato');
  expect(formatAdvice(1080, 1920, 'portrait')).toContain('Formato correto');
  expect(formatAdvice(0, 0, 'portrait')).toContain('À espera');
});

it('transporta a orientação no QR/URL sem perder tokens nem parâmetros', () => {
  const url = new URL(formattedUrl('https://example.test/camera?audio=1#token=secret', 'portrait'));
  expect(url.searchParams.get('orientation')).toBe('portrait');
  expect(url.searchParams.get('audio')).toBe('1');
  expect(url.hash).toBe('#token=secret');
  expect(orientation('invalid')).toBe('landscape');
});
