import { GoogleGenAI } from "@google/genai";

// Configurable model (via VITE_GEMINI_MODEL env or hardcoded fallback)
const MODEL = ((import.meta as any).env?.VITE_GEMINI_MODEL || "gemini-flash-lite-latest") as string;

const GEMINI_API_KEY = ((import.meta as any).env?.VITE_GEMINI_API_KEY || "") as string;
if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY missing - AI Chatbot will use fallback responses');
}
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Analyze available models on startup
let availableModels: string[] = [];
const analyzeModels = async () => {
  if (!ai) return;
  try {
    const result = await ai.models.list();
    availableModels = (result as any).models?.map((m: any) => m.name.replace('models/', '')) || [];
    console.log('📊 Available Gemini models:', availableModels);
    console.log(`🎯 Current model "${MODEL}" ${availableModels.includes(MODEL) ? '✅ supported' : '⚠️ check availability'}`);
  } catch (err) {
    console.warn('❌ Model list fetch failed:', err);
    availableModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-flash-lite-latest'];
  }
};

if (ai) analyzeModels();

const SYSTEM_INSTRUCTION = `You are the "San Andres AI Assistant", a friendly and helpful representative of the Barangay San Andres community.
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

If a user asks about the status of the barangay or local services, provide helpful information based on general knowledge of modern barangay systems while staying grounded in the "San Andres" context.
`;

export async function getChatResponse(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = []) {
  if (!ai) {
    return "AI Assistant temporarily unavailable. Please check your connection or try again later. Barangay officials will respond to your complaint as soon as possible.";
  }
  try {
    console.log(`🤖 Gemini "${MODEL}" responding...`);

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        ...history.map(h => ({ role: h.role, parts: h.parts })),
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8,
      },
    });

    // In @google/genai, response object has a text getter
    let text = (response as any).text || "I could not process your request right now.";
    
    // Defensive check for nested candidates if .text is missing
    if (!text || text.includes("Paumanhin") && (response as any).candidates?.[0]?.content?.parts?.[0]?.text) {
      text = (response as any).candidates[0].content.parts[0].text;
    }

    // Clean markdown just in case the model ignored instructions
    text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');
    
    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Return a specific string that the component recognizes for KB fallback
    return "Nagkaroon ng problema sa AI assistant. Error: " + (error as Error).message;
  }
}


