
import { getDb } from '../../db.ts';

export async function searchKnowledgeBase(query: string) {
  const db = getDb();
  // Simple keyword matching for demo purposes
  // In a real app, this would be vector search, but for SQLite we use LIKE
  const words = query.split(' ').filter(w => w.length > 3);
  
  if (words.length === 0) return null;

  try {
    // Try to find a direct match
    const directMatch = await db.get(
      "SELECT * FROM knowledge_base WHERE question LIKE ? OR answer LIKE ? LIMIT 1",
      [`%${query}%`, `%${query}%`]
    );

    if (directMatch) return directMatch.answer;

    // Try to find match by keywords
    for (const word of words) {
      const match = await db.get(
        "SELECT * FROM knowledge_base WHERE question LIKE ? LIMIT 1",
        [`%${word}%`]
      );
      if (match) return match.answer;
    }

    return null;
  } catch (error) {
    console.error('KB Search Error:', error);
    return null;
  }
}

export async function learnToKnowledgeBase(question: string, answer: string) {
  const db = getDb();
  try {
    // Don't learn if answer is too short or just a fallback
    if (answer.length < 20 || answer.includes("Paumanhin")) return;

    // Check if we already have something similar
    const exists = await db.get("SELECT id FROM knowledge_base WHERE question = ? LIMIT 1", [question]);
    if (!exists) {
      await db.run(
        "INSERT INTO knowledge_base (question, answer, source) VALUES (?, ?, ?)",
        [question, answer, 'learned_from_chat']
      );
    }
  } catch (error) {
    console.error('KB Learning Error:', error);
  }
}
