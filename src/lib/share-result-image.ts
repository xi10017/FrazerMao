'use client';

interface ShareImageOptions {
  testName?: string;
  totalScore: number;
  correctCount: number;
  incorrectCount: number;
  omitCount: number;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

export async function generateShareResultImage(
  options: ShareImageOptions
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create share image');

  const gradient = ctx.createLinearGradient(0, 0, 600, 360);
  gradient.addColorStop(0, '#1e3a5f');
  gradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 360);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('ΜΑΘPractice', 40, 48);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '500 24px system-ui, -apple-system, sans-serif';
  const titleEndY = wrapText(
    ctx,
    options.testName ?? 'Practice Test',
    40,
    88,
    520,
    30
  );

  const scoreText = String(options.totalScore);
  const scoreY = titleEndY + 72;

  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 80px system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(scoreText, 40, scoreY);
  const scoreWidth = ctx.measureText(scoreText).width;

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 36px system-ui, -apple-system, sans-serif';
  ctx.fillText('/ 150', 40 + scoreWidth + 16, scoreY - 6);

  const statsY = scoreY + 48;
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 20px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `${options.correctCount} correct · ${options.incorrectCount} incorrect · ${options.omitCount} omitted`,
    40,
    statsY
  );

  ctx.fillStyle = '#64748b';
  ctx.font = '16px system-ui, -apple-system, sans-serif';
  ctx.fillText('FAMAT practice', 40, statsY + 36);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create image'))),
      'image/png'
    );
  });
}

export async function shareResultImage(
  blob: Blob,
  text: string
): Promise<'shared' | 'downloaded' | 'copied'> {
  const file = new File([blob], 'maopractice-result.png', { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'My test result',
          text,
          files: [file],
        });
        return 'shared';
      }
      await navigator.share({ title: 'My test result', text });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'maopractice-result.png';
  link.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
