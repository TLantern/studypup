/**
 * Knowledge Graph Types
 * 
 * TypeScript definitions for the canonical knowledge graph format.
 * See docs/knowledge-graph-spec.md for full specification.
 */

export type Concept = {
  /** Stable snake_case identifier (e.g., "mitochondria_energy_production") */
  id: string;
  
  /** Concise, factual explanation of the concept */
  definition: string;
  
  /** What inputs this concept takes (optional) */
  inputs?: string[];
  
  /** What outputs this concept produces (optional) */
  outputs?: string[];
  
  /** Ordered process steps if this concept represents a process (optional) */
  process_steps?: string[];
  
  /** Array of concept IDs this concept depends on (empty if no dependencies) */
  dependencies: string[];
  
  /** Common student mistakes, confusions, or misconceptions */
  common_mistakes: string[];
};

export type KnowledgeGraphSource = {
  /** Type of source material */
  type: 'lecture' | 'text' | 'upload' | 'manual';
  
  /** Hash of content for deduplication (optional) */
  content_hash?: string;
  
  /** Additional metadata (filename, duration, etc.) */
  metadata?: Record<string, any>;
};

export type KnowledgeGraph = {
  /** Unique identifier for this knowledge graph */
  id: string;
  
  /** Firebase user ID who owns this graph */
  user_id: string;
  
  /** ISO 8601 timestamp of creation */
  created_at: string;
  
  /** ISO 8601 timestamp of last update */
  updated_at: string;
  
  /** Information about the source material */
  source: KnowledgeGraphSource;
  
  /** Array of concepts extracted from the material */
  concepts: Concept[];
  
  /** Short topic title (e.g. "Electromagnetism") from AI */
  title?: string;
  /** Single emoji for the topic (e.g. "⚡") from AI */
  emoji?: string;
};

/**
 * Derived study material types
 */

export type Flashcard = {
  id: string;
  concept_id: string; // References Concept.id
  front: string;
  back: string;
};

export type QuizQuestion = {
  id: string;
  concept_id: string; // References Concept.id
  question: string;
  options: string[];
  correct_answer_index: number;
  explanation?: string; // Why the correct answer is correct
};

export type WrittenQuestion = {
  id: string;
  concept_id: string; // References Concept.id
  question: string;
  rubric?: string[];
  sample_answer?: string; // Example good answer
};

export type FillInBlankQuestion = {
  id: string;
  concept_id: string; // References Concept.id
  text: string; // Text with ___ for blanks
  answer: string;
  context?: string; // Additional context for the blank
};

/**
 * Study Material Set
 * 
 * Container for all generated study materials from a knowledge graph
 */
export type StudyMaterialSet = {
  id: string; // Unique ID for this material set
  knowledge_graph_id: string; // References KnowledgeGraph.id
  user_id: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  
  // Generated materials
  flashcards: Flashcard[];
  quiz_questions: QuizQuestion[];
  written_questions: WrittenQuestion[];
  fill_in_blank_questions: FillInBlankQuestion[];
  notes: string; // Markdown formatted notes
  
  // Metadata
  generation_method: 'ai' | 'template'; // How materials were generated
  model?: string; // AI model used (if ai)
  /** Display title (from knowledge graph) */
  title?: string;
  /** Display emoji (from knowledge graph) */
  emoji?: string;
  /** Completed-question counts per category (correct answers). Totals come from array lengths. */
  progress?: {
    multipleChoice?: number;
    flashcards?: number;
    fillInBlanks?: number;
    written?: number;
  };
  /** User answers for each study method */
  user_answers?: {
    quiz_questions?: Record<string, number>; // question id -> selected answer index
    flashcards?: Record<string, 'correct' | 'incorrect'>; // flashcard id -> user assessment
    written_questions?: Record<string, { answer: string; correct: boolean; explanation?: string }>; // question id -> answer data
    fill_in_blank_questions?: Record<string, { answer: string; correct: boolean; explanation?: string }>; // question id -> answer data
  };
};
