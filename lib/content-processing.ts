/**
 * Content Processing Pipeline
 * 
 * Handles the flow from user content → knowledge graph → study materials
 * 
 * Usage:
 * 1. User uploads/records content
 * 2. Call processContentAndGenerateMaterials() to extract knowledge graph AND generate materials
 * 3. Store graph + materials locally + sync to Firebase
 * 4. Materials ready to use in UI
 */

import type { Concept, KnowledgeGraph, StudyMaterialSet } from './knowledge-graph';
import {
  createKnowledgeGraph,
  getKnowledgeGraphByContentHash,
  saveKnowledgeGraph,
} from './knowledge-graph-storage';
import {
  generateFlashcards,
  generateQuizQuestions,
  generateWrittenQuestions,
  generateFillInBlankQuestions,
  generateNotes,
} from './knowledge-graph-derivation';
import {
  generateAllMaterialsWithAI,
  generateSelectedMaterialsWithAI,
  type MaterialType,
} from './ai-material-generation';
import {
  createStudyMaterialSet,
  getMaterialsByGraphId,
  saveMaterials,
  updateMaterials,
} from './study-materials-storage';
import { callOpenAI, isOpenAIConfigured } from './openai-service';

const METHOD_TO_TYPE: Record<string, MaterialType> = {
  notes: 'notes',
  flashcards: 'flashcards',
  quiz: 'quiz',
  written: 'written',
  fill: 'fill',
  tutor: 'notes',
};

/**
 * Process user content into a knowledge graph
 * 
 * This is where you'd integrate with OpenAI or other AI services
 * to extract concepts from raw content.
 */
export async function processContent(
  userId: string,
  content: string,
  sourceType: 'lecture' | 'text' | 'upload',
  metadata?: Record<string, any>
): Promise<KnowledgeGraph> {
  
  // TODO: Replace with actual AI service call
  // For now, returns a mock knowledge graph
  const concepts = await extractConceptsFromContent(content);
  
  const contentHash = await hashContent(content);
  const graph = createKnowledgeGraph(
    userId,
    {
      type: sourceType,
      content_hash: contentHash,
      metadata,
    },
    concepts
  );
  
  // Save immediately to local cache
  await saveKnowledgeGraph(graph);
  
  return graph;
}

/**
 * Extract concepts from content using AI
 */
async function extractConceptsFromContent(content: string): Promise<Concept[]> {
  if (!isOpenAIConfigured()) {
    console.warn('OpenAI not configured, using mock data');
    // Return mock data for testing
    return [
      {
        id: 'example_concept',
        definition: 'This is an example concept extracted from the content',
        dependencies: [],
        common_mistakes: ['Common mistake 1', 'Common mistake 2'],
      },
    ];
  }

  try {
    const response = await callOpenAI<{ concepts: Concept[] }>(
      KNOWLEDGE_GRAPH_SYSTEM_PROMPT,
      content
    );
    
    return response.concepts;
  } catch (error) {
    console.error('Failed to extract concepts with AI:', error);
    throw error;
  }
}

/**
 * Generate all study materials from a knowledge graph using AI or templates
 */
export async function generateAllMaterials(
  graph: KnowledgeGraph,
  useAI: boolean = true
): Promise<{
  flashcards: StudyMaterialSet['flashcards'];
  quizzes: StudyMaterialSet['quiz_questions'];
  written: StudyMaterialSet['written_questions'];
  fillBlanks: StudyMaterialSet['fill_in_blank_questions'];
  notes: string;
  method: 'ai' | 'template';
  model?: string;
}> {
  if (useAI && isOpenAIConfigured()) {
    try {
      const materials = await generateAllMaterialsWithAI(graph);
      return {
        flashcards: materials.flashcards,
        quizzes: materials.quizzes,
        written: materials.written,
        fillBlanks: materials.fillBlanks,
        notes: materials.notes,
        method: 'ai',
        model: 'gpt-4o-mini',
      };
    } catch (error) {
      console.error('AI generation failed, falling back to templates:', error);
      // Fall through to template generation
    }
  }

  // Template-based generation (fallback)
  return {
    flashcards: generateFlashcards(graph),
    quizzes: generateQuizQuestions(graph),
    written: generateWrittenQuestions(graph),
    fillBlanks: generateFillInBlankQuestions(graph),
    notes: generateNotes(graph),
    method: 'template',
  };
}

/**
 * Full pipeline: Process content AND generate study materials
 * Reuses existing KG when content hash matches; generates only selected material types
 */
export async function processContentAndGenerateMaterials(
  userId: string,
  content: string,
  sourceType: 'lecture' | 'text' | 'upload',
  metadata?: Record<string, any>,
  useAI: boolean = true,
  selectedMethods: string[] = ['quiz', 'flashcards', 'written', 'fill', 'notes']
): Promise<{
  graph: KnowledgeGraph;
  materials: StudyMaterialSet;
}> {
  const contentHash = await hashContent(content);
  const selectedTypes = [...new Set(selectedMethods.map((m) => METHOD_TO_TYPE[m]).filter(Boolean))];

  // Step 1: Get or create knowledge graph
  let graph = await getKnowledgeGraphByContentHash(userId, contentHash);
  if (graph) {
    console.log('✓ Reusing existing knowledge graph');
  } else {
    console.log('Step 1: Extracting knowledge graph...');
    graph = await processContent(userId, content, sourceType, { ...metadata, content_hash: contentHash });
    console.log(`✓ Created knowledge graph with ${graph.concepts.length} concepts`);
  }

  // Step 2: Check existing materials for this graph
  const existingMaterials = await getMaterialsByGraphId(graph.id);

  // Step 3: Determine which types to generate (selected + not already present)
  const typesToGenerate = selectedTypes.filter((t) => {
    if (!existingMaterials) return true;
    if (t === 'flashcards' && (!existingMaterials.flashcards?.length)) return true;
    if (t === 'quiz' && (!existingMaterials.quiz_questions?.length)) return true;
    if (t === 'written' && (!existingMaterials.written_questions?.length)) return true;
    if (t === 'fill' && (!existingMaterials.fill_in_blank_questions?.length)) return true;
    if (t === 'notes' && !existingMaterials.notes) return true;
    return false;
  });

  if (typesToGenerate.length === 0) {
    if (!existingMaterials) throw new Error('No materials found');
    return { graph, materials: existingMaterials };
  }

  // Step 4: Generate only selected types
  console.log(`Step 2: Generating ${typesToGenerate.join(', ')}...`);
  const generated = await generateSelectedMaterials(graph, typesToGenerate, useAI);

  // Step 5: Merge with existing or create new
  const base = existingMaterials ?? createStudyMaterialSet(graph.id, userId, {
    flashcards: [],
    quiz_questions: [],
    written_questions: [],
    fill_in_blank_questions: [],
    notes: '',
  }, 'template');

  const merged: StudyMaterialSet = {
    ...base,
    flashcards: generated.flashcards.length ? generated.flashcards : base.flashcards,
    quiz_questions: generated.quizzes.length ? generated.quizzes : base.quiz_questions,
    written_questions: generated.written.length ? generated.written : base.written_questions,
    fill_in_blank_questions: generated.fillBlanks.length ? generated.fillBlanks : base.fill_in_blank_questions,
    notes: generated.notes || base.notes,
    updated_at: new Date().toISOString(),
  };

  if (existingMaterials) {
    await updateMaterials(merged.id, {
      flashcards: merged.flashcards,
      quiz_questions: merged.quiz_questions,
      written_questions: merged.written_questions,
      fill_in_blank_questions: merged.fill_in_blank_questions,
      notes: merged.notes,
    });
  } else {
    await saveMaterials(merged);
  }

  return { graph, materials: merged };
}

async function generateSelectedMaterials(
  graph: KnowledgeGraph,
  types: MaterialType[],
  useAI: boolean
): Promise<{
  flashcards: StudyMaterialSet['flashcards'];
  quizzes: StudyMaterialSet['quiz_questions'];
  written: StudyMaterialSet['written_questions'];
  fillBlanks: StudyMaterialSet['fill_in_blank_questions'];
  notes: string;
}> {
  if (useAI && isOpenAIConfigured()) {
    try {
      return await generateSelectedMaterialsWithAI(graph, types);
    } catch (error) {
      console.error('AI generation failed, falling back to templates:', error);
    }
  }
  const all = {
    flashcards: generateFlashcards(graph),
    quizzes: generateQuizQuestions(graph),
    written: generateWrittenQuestions(graph),
    fillBlanks: generateFillInBlankQuestions(graph),
    notes: generateNotes(graph),
  };
  return {
    flashcards: types.includes('flashcards') ? all.flashcards : [],
    quizzes: types.includes('quiz') ? all.quizzes : [],
    written: types.includes('written') ? all.written : [],
    fillBlanks: types.includes('fill') ? all.fillBlanks : [],
    notes: types.includes('notes') ? all.notes : '',
  };
}

/**
 * Hash content for deduplication
 */
async function hashContent(content: string): Promise<string> {
  // Simple hash for now - could use crypto.subtle.digest in production
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hash_${Math.abs(hash).toString(36)}`;
}

/**
 * Example: Full content processing workflow
 */
export async function exampleWorkflow() {
  const userId = 'user_123';
  const lectureTranscript = `
    Photosynthesis is the process by which plants convert sunlight into chemical energy.
    It occurs in the chloroplasts of plant cells. The process takes in carbon dioxide and water,
    and produces glucose and oxygen. There are two main stages: the light-dependent reactions
    and the Calvin cycle. Many students confuse photosynthesis with cellular respiration,
    but they are opposite processes.
  `;
  
  console.log('=== Content Processing Workflow ===\n');
  
  // Full pipeline: Extract graph + generate materials + save to storage
  const result = await processContentAndGenerateMaterials(
    userId,
    lectureTranscript,
    'lecture',
    { subject: 'Biology', topic: 'Photosynthesis' },
    true // Use AI if configured
  );
  
  console.log('\n=== Results ===');
  console.log(`Knowledge Graph ID: ${result.graph.id}`);
  console.log(`Materials ID: ${result.materials.id}`);
  console.log(`Generation Method: ${result.materials.generation_method}`);
  console.log(`\nMaterials Generated:`);
  console.log(`  - ${result.materials.flashcards.length} flashcards`);
  console.log(`  - ${result.materials.quiz_questions.length} quiz questions`);
  console.log(`  - ${result.materials.written_questions.length} written questions`);
  console.log(`  - ${result.materials.fill_in_blank_questions.length} fill-in-the-blank questions`);
  console.log(`  - Notes: ${result.materials.notes.split('\n').length} lines`);
  
  console.log('\n✓ All materials saved to local storage (and queued for Firebase sync)');
  console.log('\nExample flashcard:', result.materials.flashcards[0]);
  
  return result;
}

/**
 * System prompt for AI knowledge graph extraction
 */
export const KNOWLEDGE_GRAPH_SYSTEM_PROMPT = `You are an expert at extracting knowledge from educational content and organizing it into structured knowledge graphs.

Your task is to analyze the provided content and extract atomic concepts following these rules:

1. ATOMIC CONCEPTS: Each concept should represent ONE distinct idea
2. REQUIRED FIELDS: Every concept must have:
   - id: snake_case stable identifier (e.g., "photosynthesis")
   - definition: Concise, factual explanation
   - dependencies: Array of concept IDs this relies on (empty array if none)
   - common_mistakes: Array of student confusions/misconceptions

3. OPTIONAL FIELDS (include when applicable):
   - inputs: Array of things that go into this concept
   - outputs: Array of things produced by this concept
   - process_steps: Array of ordered steps (for processes)

4. SCOPE: Extract ONLY concepts present in the content. Do NOT add advanced material not mentioned.

5. DEPENDENCIES: List dependencies accurately to show prerequisite relationships.

6. COMMON MISTAKES: Capture any student confusions mentioned or implied in the content.

Output valid JSON in this exact format:
{
  "concepts": [
    {
      "id": "concept_name",
      "definition": "Clear, concise definition",
      "inputs": ["optional"],
      "outputs": ["optional"],
      "process_steps": ["optional"],
      "dependencies": ["concept_id_this_relies_on"],
      "common_mistakes": ["confusion 1", "confusion 2"]
    }
  ]
}`;
