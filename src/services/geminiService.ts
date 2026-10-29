import { apiUrl } from '../lib/api';

export async function getChatResponse(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = []) {
  try {
    const response = await fetch(apiUrl('/api/chat/gemini'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: history.slice(-20) }),
    });
    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null) {
      throw new Error('The AI assistant returned an invalid response.');
    }

    if (!response.ok) {
      const error = 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Unable to connect to the AI assistant.';
      throw new Error(error);
    }

    if (!('response' in data) || typeof data.response !== 'string') {
      throw new Error('The AI assistant returned an invalid response.');
    }
    return data.response;
  } catch (error) {
    console.error('Gemini API Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return `Nagkaroon ng problema sa AI assistant. Error: ${message}`;
  }
}
