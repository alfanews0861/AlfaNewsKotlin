/**
 * Utility functions for AlfaNews Portal
 */

export function formatRelativeTimeTelugu(timestamp?: number | null): string {
  if (!timestamp) return 'ఇప్పుడే';
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (diffSec < 60) return 'ఇప్పుడే';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} నిమిషాల క్రితం`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} గంటల క్రితం`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} రోజుల క్రితం`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks} వారాల క్రితం`;

  const date = new Date(timestamp);
  const months = ['జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export const FALLBACK_NEWS_IMAGE = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=60';
export const FALLBACK_SPECIAL_IMAGE = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format&fit=crop&q=60';
