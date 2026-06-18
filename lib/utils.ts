export function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function extractLinks(text: string): { text: string; isLink: boolean; url?: string }[] {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const parts: { text: string; isLink: boolean; url?: string }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isLink: false });
    }
    const url = match[0].startsWith("http") ? match[0] : `https://${match[0]}`;
    parts.push({ text: match[0], isLink: true, url });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isLink: false });
  }

  return parts.length > 0 ? parts : [{ text, isLink: false }];
}

// Rate-limit: 1 notification per hour per room
export function canSendNotification(lastSentMs: number): boolean {
  return Date.now() - lastSentMs > 60 * 60 * 1000;
}
