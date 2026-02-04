/**
 * Knowledge Graph Derivation
 * 
 * Functions to generate study materials from knowledge graph concepts:
 * - Flashcards
 * - Quiz questions
 * - Written questions
 * - Fill-in-the-blank questions
 * - Notes
 */

import type {
  Concept,
  KnowledgeGraph,
  Flashcard,
  QuizQuestion,
  WrittenQuestion,
  FillInBlankQuestion,
} from './knowledge-graph';

/**
 * Generate flashcards from knowledge graph
 */
export function generateFlashcards(graph: KnowledgeGraph): Flashcard[] {
  const flashcards: Flashcard[] = [];
  
  for (const concept of graph.concepts) {
    // Basic definition flashcard
    flashcards.push({
      id: `fc_${concept.id}_def`,
      concept_id: concept.id,
      front: `What is ${formatConceptName(concept.id)}?`,
      back: concept.definition,
    });
    
    // Input/output flashcard if applicable
    if (concept.inputs && concept.inputs.length > 0) {
      flashcards.push({
        id: `fc_${concept.id}_inputs`,
        concept_id: concept.id,
        front: `What are the inputs for ${formatConceptName(concept.id)}?`,
        back: concept.inputs.join(', '),
      });
    }
    
    if (concept.outputs && concept.outputs.length > 0) {
      flashcards.push({
        id: `fc_${concept.id}_outputs`,
        concept_id: concept.id,
        front: `What are the outputs of ${formatConceptName(concept.id)}?`,
        back: concept.outputs.join(', '),
      });
    }
    
    // Process steps flashcard if applicable
    if (concept.process_steps && concept.process_steps.length > 0) {
      flashcards.push({
        id: `fc_${concept.id}_steps`,
        concept_id: concept.id,
        front: `What are the steps in ${formatConceptName(concept.id)}?`,
        back: concept.process_steps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
      });
    }
  }
  
  return flashcards;
}

/**
 * Generate quiz questions from knowledge graph
 */
export function generateQuizQuestions(graph: KnowledgeGraph): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  
  for (const concept of graph.concepts) {
    // Definition-based multiple choice
    const otherConcepts = graph.concepts.filter(c => c.id !== concept.id);
    if (otherConcepts.length >= 3) {
      const distractors = shuffleArray(otherConcepts)
        .slice(0, 3)
        .map(c => c.definition);
      
      const options = shuffleArray([concept.definition, ...distractors]);
      const correctIndex = options.indexOf(concept.definition);
      
      questions.push({
        id: `quiz_${concept.id}_def`,
        concept_id: concept.id,
        question: `What is ${formatConceptName(concept.id)}?`,
        options,
        correct_answer_index: correctIndex,
      });
    }
    
    // Process steps question if applicable
    if (concept.process_steps && concept.process_steps.length > 1) {
      const correctOrder = concept.process_steps;
      const shuffledSteps = shuffleArray([...concept.process_steps]);
      
      // Only create if shuffled is different from correct
      if (JSON.stringify(shuffledSteps) !== JSON.stringify(correctOrder)) {
        questions.push({
          id: `quiz_${concept.id}_order`,
          concept_id: concept.id,
          question: `What is the correct order of steps in ${formatConceptName(concept.id)}?`,
          options: [
            correctOrder.join(' → '),
            shuffledSteps.join(' → '),
            shuffleArray([...concept.process_steps]).join(' → '),
            shuffleArray([...concept.process_steps]).join(' → '),
          ],
          correct_answer_index: 0,
        });
      }
    }
  }
  
  return questions;
}

/**
 * Generate written questions from knowledge graph
 */
export function generateWrittenQuestions(graph: KnowledgeGraph): WrittenQuestion[] {
  const questions: WrittenQuestion[] = [];
  
  for (const concept of graph.concepts) {
    const rubric: string[] = [];
    
    // Base question
    let question = `Explain ${formatConceptName(concept.id)}.`;
    
    // Add rubric items
    rubric.push(`Provides accurate definition: ${concept.definition}`);
    
    if (concept.inputs && concept.inputs.length > 0) {
      question += ` Include what inputs it requires.`;
      rubric.push(`Mentions inputs: ${concept.inputs.join(', ')}`);
    }
    
    if (concept.outputs && concept.outputs.length > 0) {
      question += ` Include what outputs it produces.`;
      rubric.push(`Mentions outputs: ${concept.outputs.join(', ')}`);
    }
    
    if (concept.process_steps && concept.process_steps.length > 0) {
      question += ` Describe the main steps involved.`;
      rubric.push(`Describes process steps in order`);
    }
    
    if (concept.dependencies.length > 0) {
      const deps = concept.dependencies
        .map(id => formatConceptName(id))
        .join(', ');
      rubric.push(`Explains relationship to: ${deps}`);
    }
    
    questions.push({
      id: `written_${concept.id}`,
      concept_id: concept.id,
      question,
      rubric,
    });
  }
  
  return questions;
}

/**
 * Generate fill-in-the-blank questions from knowledge graph
 */
export function generateFillInBlankQuestions(graph: KnowledgeGraph): FillInBlankQuestion[] {
  const questions: FillInBlankQuestion[] = [];
  
  for (const concept of graph.concepts) {
    // Create fill-in-the-blank from definition
    const conceptName = formatConceptName(concept.id);
    const text = concept.definition.replace(
      new RegExp(`\\b${escapeRegex(conceptName)}\\b`, 'i'),
      '___'
    );
    
    // Only add if we successfully created a blank
    if (text.includes('___')) {
      questions.push({
        id: `fib_${concept.id}_name`,
        concept_id: concept.id,
        text,
        answer: conceptName,
      });
    }
    
    // Create fill-in-the-blank for key terms in definition
    const words = concept.definition.split(' ');
    const keyWords = words.filter(w => w.length > 5 && /^[A-Z]/.test(w));
    
    for (const keyWord of keyWords.slice(0, 2)) { // Limit to 2 per concept
      const blankText = concept.definition.replace(keyWord, '___');
      if (blankText !== concept.definition) {
        questions.push({
          id: `fib_${concept.id}_${keyWord.toLowerCase()}`,
          concept_id: concept.id,
          text: blankText,
          answer: keyWord,
        });
      }
    }
  }
  
  return questions;
}

/**
 * Generate structured notes from knowledge graph
 * Uses the same format as AI notes: Title, Core Idea, Key Sections, etc.
 */
export function generateNotes(graph: KnowledgeGraph): string {
  const topic = graph.concepts[0] ? formatConceptName(graph.concepts[0].id) : 'Study Notes';
  const sorted = topologicalSort(graph.concepts);
  let coreIdea = '';
  const sections: string[] = [];

  for (const concept of sorted) {
    coreIdea += concept.definition + ' ';
    let section = `### ${formatConceptName(concept.id)}\n- Explanation:\n  ${concept.definition}\n`;
    if (concept.process_steps?.length) {
      section += '- Steps / Mechanism:\n';
      concept.process_steps.forEach((s) => { section += `  - ${s}\n`; });
    }
    sections.push(section);
  }

  return `## 📌 Title
${topic}

## 🧠 Core Idea
${coreIdea.trim()}

## ⚙️ Key Sections
${sections.join('\n')}

## 🧮 Equations / Formulas (if applicable)
Not applicable

## ✨ Simplified Summary
Key concepts from the material for quick review.

## ⭐ Why This Matters
Understanding these concepts helps with exams and real-world applications.
`;
}

/**
 * Utility: Format concept ID to readable name
 * e.g., "mitochondria_energy_production" -> "Mitochondria energy production"
 */
function formatConceptName(id: string): string {
  return id
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Utility: Shuffle array (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Utility: Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Utility: Topological sort of concepts by dependencies
 */
function topologicalSort(concepts: Concept[]): Concept[] {
  const sorted: Concept[] = [];
  const visited = new Set<string>();
  const conceptMap = new Map(concepts.map(c => [c.id, c]));
  
  function visit(concept: Concept) {
    if (visited.has(concept.id)) return;
    visited.add(concept.id);
    
    // Visit dependencies first
    for (const depId of concept.dependencies) {
      const dep = conceptMap.get(depId);
      if (dep) visit(dep);
    }
    
    sorted.push(concept);
  }
  
  concepts.forEach(visit);
  return sorted;
}
