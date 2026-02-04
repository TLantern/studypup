# Knowledge Graph System

## Overview

The Knowledge Graph system is the core architecture for content generation in StudyPup. It converts user-provided learning material into a canonical, normalized representation that serves as the single source of truth for all study materials.

## Why Knowledge Graphs?

**Problem**: Traditional approaches generate study materials directly from raw content (lecture transcripts, notes, etc.). This leads to:
- Inconsistent quality across different material types
- Difficulty maintaining coherence between flashcards, quizzes, and notes
- No way to update or improve materials systematically
- Limited ability to track what users have learned

**Solution**: Extract content into a knowledge graph first, then derive all materials from it.

```
User Content → Knowledge Graph → Study Materials
                     ↓
                 (Canonical)
```

## Architecture

### Data Flow

```
┌─────────────────┐
│  User Uploads   │
│  - Lecture      │
│  - Text         │
│  - Images       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Processing  │
│  (OpenAI, etc.) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Knowledge Graph │  ◄─── Canonical representation
│     (JSON)      │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐  ┌────────┐
│ Local  │  │Firebase│
│ Cache  │  │  Sync  │
└────────┘  └────────┘
    │
    └────────┬────────────────────┐
             ▼                    ▼
    ┌────────────────┐   ┌────────────────┐
    │  Study Cards   │   │ Learning Paths │
    │  - Flashcards  │   │  - Progress    │
    │  - Quizzes     │   │  - Analytics   │
    │  - Written     │   │  - Tutoring    │
    │  - Fill Blank  │   │                │
    └────────────────┘   └────────────────┘
```

## File Structure

```
studypup/
├── docs/
│   ├── knowledge-graph-spec.md       # Full specification
│   └── knowledge-graph-readme.md     # This file
├── lib/
│   ├── knowledge-graph.ts            # TypeScript types
│   ├── knowledge-graph-storage.ts    # Local + Firebase storage
│   └── knowledge-graph-derivation.ts # Material generation
└── components/
    ├── FlashcardStudy.tsx            # Uses derived flashcards
    ├── WrittenStudy.tsx              # Uses derived questions
    └── FillInBlankStudy.tsx          # Uses derived questions
```

## Quick Start

### 1. Create a Knowledge Graph

```typescript
import { createKnowledgeGraph } from '@/lib/knowledge-graph-storage';
import type { Concept } from '@/lib/knowledge-graph';

const concepts: Concept[] = [
  {
    id: 'photosynthesis',
    definition: 'Process by which plants convert sunlight into chemical energy',
    inputs: ['sunlight', 'water', 'carbon_dioxide'],
    outputs: ['glucose', 'oxygen'],
    process_steps: [
      'Light-dependent reactions capture energy',
      'Calvin cycle produces glucose',
    ],
    dependencies: ['chloroplasts'],
    common_mistakes: [
      'Confusing photosynthesis with cellular respiration',
      'Thinking it only happens during the day',
    ],
  },
  {
    id: 'chloroplasts',
    definition: 'Organelles in plant cells where photosynthesis occurs',
    dependencies: [],
    common_mistakes: [],
  },
];

const graph = createKnowledgeGraph(
  'user_123',
  { type: 'text', metadata: { source: 'Biology textbook' } },
  concepts
);
```

### 2. Save the Graph

```typescript
import { saveKnowledgeGraph } from '@/lib/knowledge-graph-storage';

await saveKnowledgeGraph(graph);
// Saved to local cache + queued for Firebase sync
```

### 3. Generate Study Materials

```typescript
import {
  generateFlashcards,
  generateQuizQuestions,
  generateWrittenQuestions,
  generateFillInBlankQuestions,
  generateNotes,
} from '@/lib/knowledge-graph-derivation';

// Generate all material types
const flashcards = generateFlashcards(graph);
const quizzes = generateQuizQuestions(graph);
const written = generateWrittenQuestions(graph);
const fillBlanks = generateFillInBlankQuestions(graph);
const notes = generateNotes(graph);

console.log(`Generated:
  ${flashcards.length} flashcards
  ${quizzes.length} quiz questions
  ${written.length} written questions
  ${fillBlanks.length} fill-in-the-blank questions
`);
```

### 4. Use in Components

```typescript
// In your study screen
import { FlashcardStudy } from '@/components/FlashcardStudy';
import { getKnowledgeGraph } from '@/lib/knowledge-graph-storage';
import { generateFlashcards } from '@/lib/knowledge-graph-derivation';

function StudyScreen() {
  const [cards, setCards] = useState([]);
  
  useEffect(() => {
    async function load() {
      const graph = await getKnowledgeGraph('kg_abc123');
      if (graph) {
        const flashcards = generateFlashcards(graph);
        setCards(flashcards.map(fc => ({
          question: fc.front,
          answer: fc.back,
        })));
      }
    }
    load();
  }, []);
  
  return <FlashcardStudy cards={cards} />;
}
```

## Integration with AI

### Prompt Template for Knowledge Graph Extraction

```typescript
const KNOWLEDGE_GRAPH_PROMPT = `
You are an expert at extracting knowledge from educational content.

Task: Convert the following material into a normalized knowledge graph in JSON format.

Rules:
1. Extract atomic concepts only (one idea per node)
2. Each concept must include: id, definition, dependencies, common_mistakes
3. Include inputs/outputs/process_steps when applicable
4. Preserve the user's scope - do NOT add material beyond what's present
5. Use snake_case IDs that are stable and descriptive

Material:
"""
{USER_CONTENT}
"""

Output valid JSON only, no prose. Use this schema:
{
  "concepts": [
    {
      "id": "string",
      "definition": "string",
      "inputs": ["string"],
      "outputs": ["string"],
      "process_steps": ["string"],
      "dependencies": ["string"],
      "common_mistakes": ["string"]
    }
  ]
}
`;

async function extractKnowledgeGraph(content: string): Promise<Concept[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: KNOWLEDGE_GRAPH_PROMPT.replace('{USER_CONTENT}', content) },
    ],
    response_format: { type: 'json_object' },
  });
  
  const data = JSON.parse(response.choices[0].message.content);
  return data.concepts;
}
```

## Benefits

### 1. Consistency
All study materials are derived from the same canonical representation, ensuring consistency across flashcards, quizzes, and notes.

### 2. Traceability
Every flashcard, quiz question, etc. references its source concept via `concept_id`, enabling:
- Analytics: "Which concepts does the user struggle with?"
- Adaptive learning: "Show more questions on weak concepts"
- Progress tracking: "User has mastered 8/10 concepts"

### 3. Maintainability
To improve study materials, update the derivation functions once. All generated content improves automatically.

### 4. Extensibility
Adding new material types (e.g., concept maps, practice problems) only requires:
1. Define the new type in `knowledge-graph.ts`
2. Add a generator function in `knowledge-graph-derivation.ts`
3. Create a UI component to display it

### 5. Offline-First
Knowledge graphs are cached locally, so study materials work offline. Sync happens in the background when online.

## Best Practices

### Concept Granularity
✅ **Good**: Atomic concepts
```typescript
{ id: "mitochondria", definition: "Organelles that produce ATP" }
{ id: "atp", definition: "Energy currency of cells" }
```

❌ **Bad**: Compound concepts
```typescript
{ id: "cell_energy", definition: "Mitochondria produce ATP for energy" }
```

### Dependencies
Always specify dependencies to enable:
- Prerequisite checking ("Learn X before Y")
- Knowledge graph visualization
- Intelligent tutoring ("You need to understand A to understand B")

### Common Mistakes
This field is crucial for:
- Generating better distractor options in quizzes
- Providing targeted explanations in tutoring
- Understanding where students struggle

## Future Enhancements

### 1. Spaced Repetition
Use concept mastery data to schedule reviews:
```typescript
{
  concept_id: "photosynthesis",
  next_review: "2026-02-05T10:00:00Z",
  ease_factor: 2.5,
  interval: 3,
}
```

### 2. Concept Relationships
Add relationship types beyond dependencies:
```typescript
{
  id: "photosynthesis",
  relationships: [
    { type: "opposite_of", target: "cellular_respiration" },
    { type: "occurs_in", target: "chloroplasts" },
    { type: "produces", target: "glucose" },
  ]
}
```

### 3. Multi-Modal Content
Extend concepts to include:
- Diagrams/images
- Video timestamps
- Interactive simulations

### 4. Collaborative Learning
Share knowledge graphs between users:
- "Study this topic using community-curated graphs"
- Upvote/downvote concepts for quality
- Contribute corrections and improvements

## Troubleshooting

### Issue: Generated materials are low quality
**Solution**: Improve the knowledge graph first. Better atomic concepts → better derived materials.

### Issue: Concepts have circular dependencies
**Solution**: Refactor concepts to break cycles. Use `topologicalSort` to detect issues.

### Issue: Too many/too few concepts
**Solution**: Adjust AI prompt or post-process to merge/split concepts to the right granularity.

### Issue: Local and Firebase data out of sync
**Solution**: Implement conflict resolution strategy (last-write-wins, or merge by timestamp).

## See Also

- [Full Specification](./knowledge-graph-spec.md)
- [TypeScript Types](../lib/knowledge-graph.ts)
- [Storage API](../lib/knowledge-graph-storage.ts)
- [Derivation Functions](../lib/knowledge-graph-derivation.ts)
