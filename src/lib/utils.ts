import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export async function safeJson(res: Response) {
  try {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return trimmed;
  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  if (localPart.length <= 2) {
    return `${localPart}***${domain}`;
  }
  if (localPart.length === 3) {
    return `${localPart.slice(0, 2)}*${domain}`;
  }
  const firstTwo = localPart.slice(0, 2);
  const lastChar = localPart.slice(-1);
  const asterisks = '*'.repeat(Math.max(3, localPart.length - 3));
  return `${firstTwo}${asterisks}${lastChar}${domain}`;
}
