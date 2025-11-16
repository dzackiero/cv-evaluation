export interface RagieRetrievalResponse {
  scored_chunks: Array<{
    document_id: string;
    chunk_id: string;
    text: string;
    score: number;
    metadata: Record<string, any>;
  }>;
}
