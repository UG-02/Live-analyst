
import { TranscriptItem, DiarizedTurn } from '../types';

export const downloadTranscriptAsText = (data: TranscriptItem[] | DiarizedTurn[], filename: string) => {
  if (!data || data.length === 0) return;

  const textContent = data.map(item => {
    const speaker = item.speaker;
    // Check if timestamp exists (TranscriptItem) or not (DiarizedTurn)
    const timeStr = 'timestamp' in item ? `[${item.timestamp}] ` : '';
    const text = item.text;
    return `${timeStr}${speaker}: ${text}`;
  }).join('\n\n');

  const blob = new Blob([textContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
