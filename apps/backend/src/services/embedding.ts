import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

/**
 * Generate embeddings for text using OpenAI
 */
export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Failed to generate embeddings:', error);
    throw error;
  }
}

/**
 * Split text into chunks for embedding
 */
export function splitTextIntoChunks(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search for similar documents using vector similarity
 */
export async function searchSimilarDocuments(
  query: string,
  documents: Array<{ id: string; content: string; embedding?: number[]; [key: string]: any }>,
  limit = 5
): Promise<Array<{ id: string; content: string; similarity: number; [key: string]: any }>> {
  // Generate embedding for query
  const queryEmbedding = await generateEmbeddings(query);

  // Calculate similarity scores
  const results = documents
    .filter((doc) => doc.embedding && doc.embedding.length > 0)
    .map((doc) => {
      const { embedding, ...rest } = doc;
      return {
        ...rest,
        similarity: cosineSimilarity(queryEmbedding, embedding!),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * Retrieve relevant knowledge from the database for a specific novel
 */
import { db, schema } from '../database';
import { inArray, eq } from 'drizzle-orm';

export async function retrieveRelevantKnowledge(
  query: string,
  novelId: string,
  limit = 3,
  similarityThreshold = 0.5
): Promise<string[]> {
  try {
    // 1. Get all Knowledge Bases for this novel
    const knowledgeBases = await db.query.knowledgeBases.findMany({
      where: eq(schema.knowledgeBases.novelId, novelId),
    });

    if (knowledgeBases.length === 0) return [];

    const kbIds = knowledgeBases.map((kb) => kb.id);

    // 2. Get all Documents in these Knowledge Bases
    const documents = await db.query.knowledgeDocuments.findMany({
      where: inArray(schema.knowledgeDocuments.knowledgeBaseId, kbIds),
    });

    if (documents.length === 0) return [];

    // 3. Prepare documents with parsed embeddings for search
    const docsWithEmbeddings = documents.map((doc) => ({
      id: doc.id,
      content: doc.content,
      embedding: doc.embedding ? JSON.parse(doc.embedding as string) : undefined,
    }));

    // Filter out docs without valid embeddings
    const searchableDocs = docsWithEmbeddings.filter(d => Boolean(d.embedding && d.embedding.length > 0));
    
    if (searchableDocs.length === 0) return [];

    // 4. Perform vector search
    const searchResults = await searchSimilarDocuments(query, searchableDocs, limit);
    
    // 5. Filter by threshold and map to extracted content
    return searchResults
      .filter(res => res.similarity >= similarityThreshold)
      .map(res => res.content);

  } catch (error) {
    console.error('Failed to retrieve relevant knowledge:', error);
    return []; // Return empty context on failure rather than breaking the AI flow
  }
}
