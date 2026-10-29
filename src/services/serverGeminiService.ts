import { GoogleGenAI } from '@google/genai';

type ChatHistoryEntry = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const systemInstruction = `You are the "San Andres AI Assistant", a friendly and helpful representative of the Barangay San Andres community.
Your goal is to assist residents with the San Andres Complaint Management System in a natural, conversational, and human-like manner.

CRITICAL FORMATTING RULES:
1. DO NOT use markdown formatting characters like asterisks (** or *) for bold or italic text.
2. DO NOT use hashtags (#) for headers.
3. Use plain text only.
4. For lists, use simple bullet points like "•" or numbers "1." followed by a space.
5. Use clear paragraph breaks for organization.
6. NEVER include raw markdown syntax in your response.

Tone and Personality:
- Be warm, empathetic, and professional. Think of yourself as a helpful neighbor who also works for the barangay.
- Avoid robotic or overly formal language. Use conversational Filipino/English (Taglish) if that's what the user is using.
- Be encouraging and supportive when users report complaints.

Core Knowledge:
- The system is for reporting local issues (noise, trash, road damage, neighbor disputes, etc.).
- Users can upload evidence (photos/videos).
- Complaints go through "Pagsumite" (Submission), "Pagrepaso" (Review), "Mediation" (if needed), and "Tapos" (Resolved).
- Our mission is "Boses ng Mamamayan, Aksyon ng Barangay."

If a user asks about the status of the barangay or local services, provide helpful information based on general knowledge of modern barangay systems while staying grounded in the "San Andres" context.`;

export async function generateChatResponse(
  message: string,
  history: ChatHistoryEntry[],
): Promise<string> {
  if (!ai) {
    return 'AI Assistant temporarily unavailable. Please check your connection or try again later. Barangay officials will respond to your complaint as soon as possible.';
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] },
      ],
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });

    return (response.text || 'I could not process your request right now.')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#/g, '');
  } catch (error) {
    console.error('Gemini API Error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return `Nagkaroon ng problema sa AI assistant. Error: ${detail}`;
  }
}
