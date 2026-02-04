# AI Integration Guide

## Overview

StudyPup uses OpenAI to transform user content into high-quality study materials through a two-stage AI pipeline:

1. **Content → Knowledge Graph**: Extract atomic concepts from raw content
2. **Knowledge Graph → Study Materials**: Generate flashcards, quizzes, notes, etc.

This guide explains how to set up, use, and customize the AI integration.

## Architecture

```
User Content (lecture, text, etc.)
         ↓
    [OpenAI GPT-4]
         ↓
  Knowledge Graph (JSON)
         ↓
   [Local Storage] ← Cache first
         ↓
   [OpenAI GPT-4] ← Generate materials
         ↓
Study Materials (flashcards, quizzes, etc.)
         ↓
   [Local Storage] ← Cache first
         ↓
    [Firebase] ← Background sync
```

## Setup

### 1. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

### 2. Configure Environment

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```env
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-actual-key-here
```

**Important**: Never commit `.env` to version control. It's already in `.gitignore`.

### 3. Verify Installation

```bash
# OpenAI package should already be installed
npm list openai
```

If not installed:

```bash
npm install openai
```

## Usage

### Basic Workflow

```typescript
import { processContentAndGenerateMaterials } from '@/lib/content-processing';

// Process user content in one call
const result = await processContentAndGenerateMaterials(
  userId,
  userContent,
  'lecture', // or 'text' or 'upload'
  { subject: 'Biology', topic: 'Cell Biology' }
);

// Access generated materials
console.log(`Generated ${result.materials.flashcards.length} flashcards`);
console.log(`Generated ${result.materials.quiz_questions.length} quiz questions`);

// Materials are automatically saved to local storage
// and queued for Firebase sync
```

### Step-by-Step Process

If you need more control:

```typescript
import { processContent } from '@/lib/content-processing';
import { generateAllMaterialsWithAI } from '@/lib/ai-material-generation';
import { createStudyMaterialSet, saveMaterials } from '@/lib/study-materials-storage';

// Step 1: Extract knowledge graph
const graph = await processContent(
  userId,
  content,
  'lecture'
);

// Step 2: Generate materials with AI
const materials = await generateAllMaterialsWithAI(graph, {
  flashcardCount: 15,
  quizCount: 10,
  writtenCount: 5,
  fillBlankCount: 12,
});

// Step 3: Save to storage
const materialSet = createStudyMaterialSet(
  graph.id,
  userId,
  materials,
  'ai',
  'gpt-4o-mini'
);

await saveMaterials(materialSet);
```

### Individual Material Generation

Generate specific material types:

```typescript
import {
  generateFlashcardsWithAI,
  generateQuizQuestionsWithAI,
  generateWrittenQuestionsWithAI,
  generateFillInBlankQuestionsWithAI,
  generateNotesWithAI,
} from '@/lib/ai-material-generation';

// Generate only flashcards
const flashcards = await generateFlashcardsWithAI(graph, 20);

// Generate only quiz questions
const quizzes = await generateQuizQuestionsWithAI(graph, 15);

// Generate structured notes
const notes = await generateNotesWithAI(graph);
```

## AI Prompts

### Knowledge Graph Extraction

The system uses a carefully crafted prompt to extract concepts:

```typescript
// From lib/content-processing.ts
export const KNOWLEDGE_GRAPH_SYSTEM_PROMPT = `You are an expert at extracting knowledge from educational content...

Rules:
1. ATOMIC CONCEPTS: Each concept should represent ONE distinct idea
2. REQUIRED FIELDS: id, definition, dependencies, common_mistakes
3. OPTIONAL FIELDS: inputs, outputs, process_steps
4. SCOPE: Extract ONLY concepts present in the content
...`;
```

**Key features**:
- Extracts atomic concepts (one idea per node)
- Captures dependencies for prerequisite tracking
- Identifies common student mistakes
- Preserves user's scope and level

### Study Material Generation

Each material type has a specialized prompt:

**Flashcards**: Creates clear Q&A pairs focusing on key concepts

**Quizzes**: Generates multiple-choice with plausible distractors from common_mistakes

**Written Questions**: Creates essay prompts with rubrics

**Fill-in-the-Blank**: Generates context-rich cloze deletion exercises

**Notes**: Produces comprehensive markdown notes with logical organization

## Storage & Sync

### Local Storage (Primary)

All materials are stored locally using AsyncStorage for:
- **Offline access**: Study without internet
- **Fast loading**: No network latency
- **Privacy**: Data stays on device

```typescript
import { getMaterialsForGraph } from '@/lib/study-materials-storage';

// Retrieve materials by knowledge graph ID
const materials = await getMaterialsForGraph(graphId);
```

### Firebase Sync (Background)

Materials are synced to Firebase for:
- **Cross-device access**: Same materials on phone and tablet
- **Backup**: Don't lose work if device is lost
- **Collaboration**: Share materials with study groups (future)

Firestore structure:
```
/users/{userId}/knowledge_graphs/{graphId}
/users/{userId}/study_materials/{materialId}
```

## Integration with UI

### In Study Screens

```typescript
// Example: Flashcard screen
import { FlashcardStudy } from '@/components/FlashcardStudy';
import { getMaterialsForGraph } from '@/lib/study-materials-storage';

function FlashcardScreen() {
  const [cards, setCards] = useState([]);
  
  useEffect(() => {
    async function loadMaterials() {
      const materials = await getMaterialsForGraph(graphId);
      if (materials) {
        // Transform to component format
        setCards(materials.flashcards.map(fc => ({
          question: fc.front,
          answer: fc.back,
        })));
      }
    }
    loadMaterials();
  }, [graphId]);
  
  return <FlashcardStudy cards={cards} />;
}
```

### In Generate Flow

```typescript
// When user clicks "Generate" on choose-methods page
import { processContentAndGenerateMaterials } from '@/lib/content-processing';

async function handleGenerate() {
  setLoading(true);
  
  try {
    const result = await processContentAndGenerateMaterials(
      userId,
      contentFromRecording,
      'lecture',
      { subject, gradeLevel }
    );
    
    // Navigate to study materials with the generated content
    router.push({
      pathname: '/generate-quiz',
      params: {
        methods: selectedMethods.join(','),
        materialId: result.materials.id,
      },
    });
  } catch (error) {
    console.error('Generation failed:', error);
    Alert.alert('Error', 'Failed to generate materials');
  } finally {
    setLoading(false);
  }
}
```

## Cost Optimization

### Token Usage

Typical costs per generation (using gpt-4o-mini at $0.150 per 1M input tokens):

- **Knowledge Graph Extraction**: ~$0.002-0.005 per lecture (1K-3K tokens)
- **Material Generation**: ~$0.005-0.015 per set (3K-10K tokens)
- **Total per lecture**: ~$0.007-0.020

For 100 lectures/month: **~$2/month**

### Best Practices

1. **Batch Generation**: Generate all material types in parallel (already implemented)
2. **Cache Aggressively**: Check local storage before calling API
3. **Use gpt-4o-mini**: Cheaper and faster than gpt-4 for structured tasks
4. **Limit Material Counts**: Default to 10 flashcards, 10 quizzes, etc.

```typescript
// Customize counts to control costs
const materials = await generateAllMaterialsWithAI(graph, {
  flashcardCount: 5,  // Reduce from 10
  quizCount: 5,       // Reduce from 10
  writtenCount: 3,    // Reduce from 5
  fillBlankCount: 5,  // Reduce from 10
});
```

5. **Implement Rate Limiting**: Prevent abuse

```typescript
// Example rate limit check
const lastGeneration = await getLastGenerationTime(userId);
if (Date.now() - lastGeneration < 60000) { // 1 minute
  throw new Error('Please wait before generating again');
}
```

## Error Handling

### Graceful Degradation

The system automatically falls back to template-based generation if AI fails:

```typescript
// In content-processing.ts
if (useAI && isOpenAIConfigured()) {
  try {
    return await generateAllMaterialsWithAI(graph);
  } catch (error) {
    console.error('AI generation failed, falling back to templates:', error);
    // Falls through to template generation
  }
}

// Template-based generation (no AI required)
return {
  flashcards: generateFlashcards(graph),
  quizzes: generateQuizQuestions(graph),
  // ...
  method: 'template',
};
```

### Common Errors

**"OpenAI API key not configured"**
- Solution: Add `EXPO_PUBLIC_OPENAI_API_KEY` to `.env`

**"Rate limit exceeded"**
- Solution: Implement backoff retry or reduce generation frequency

**"Invalid JSON response"**
- Solution: Already handled with try/catch and fallback to templates

**"Insufficient quota"**
- Solution: Add credits to OpenAI account or use template generation

## Testing

### Test with Mock Data

```typescript
// Disable AI for testing
const result = await processContentAndGenerateMaterials(
  userId,
  content,
  'lecture',
  metadata,
  false // useAI = false → uses templates
);
```

### Test AI Generation

```bash
# In a React Native dev tools console or test file
import { exampleWorkflow } from '@/lib/content-processing';

// Run full pipeline
await exampleWorkflow();
```

### Monitor API Calls

```typescript
import { estimateTokens } from '@/lib/openai-service';

const contentTokens = estimateTokens(userContent);
console.log(`Estimated cost: $${(contentTokens / 1000000 * 0.150).toFixed(4)}`);
```

## Customization

### Adjust AI Behavior

Edit prompts in `lib/ai-material-generation.ts`:

```typescript
// Make flashcards more challenging
const systemPrompt = `You are an expert at creating educational flashcards.
Create CHALLENGING flashcards that test deep understanding, not just recall.
...`;
```

### Add New Material Types

1. Define type in `lib/knowledge-graph.ts`
2. Create generation function in `lib/ai-material-generation.ts`
3. Add to `generateAllMaterialsWithAI()`
4. Create UI component

Example - Concept Map:

```typescript
export type ConceptMap = {
  id: string;
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ from: string; to: string; label: string }>;
};

export async function generateConceptMapWithAI(
  graph: KnowledgeGraph
): Promise<ConceptMap> {
  // AI prompt to generate graph visualization
  ...
}
```

## Security

### API Key Protection

- **Never** commit API keys to git
- **Never** expose keys in client-side code (they're in env vars)
- **Always** use `EXPO_PUBLIC_` prefix for Expo to inject at build time
- **Consider** proxying API calls through your backend for added security

### Content Privacy

- Content is processed by OpenAI (read their privacy policy)
- For sensitive content, use template generation (no AI)
- Future: Add option to self-host AI models

## Future Enhancements

### 1. Streaming Responses

```typescript
// Real-time generation updates
for await (const chunk of generateFlashcardsStreaming(graph)) {
  setFlashcards(prev => [...prev, chunk]);
}
```

### 2. Fine-Tuned Models

Train custom models on high-quality educational content for better results.

### 3. Multi-Modal Input

Process images, diagrams, and videos alongside text.

### 4. Adaptive Difficulty

Adjust question difficulty based on student performance history.

### 5. Collaborative Filtering

Suggest study materials based on what helped similar students.

## Troubleshooting

### Issue: Materials seem low quality

**Solutions**:
- Check if template generation is being used (check `materials.generation_method`)
- Verify OpenAI API key is set correctly
- Improve knowledge graph quality (better concepts → better materials)
- Adjust AI prompts for your specific domain

### Issue: Generation is slow

**Solutions**:
- Materials are generated in parallel already
- Use gpt-4o-mini instead of gpt-4
- Reduce material counts (fewer flashcards, quizzes, etc.)
- Show loading indicator to set expectations

### Issue: High API costs

**Solutions**:
- Implement per-user rate limiting
- Cache generated materials aggressively
- Use template generation for less critical content
- Batch multiple student requests together

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Pricing](https://openai.com/pricing)
- [Knowledge Graph Spec](./knowledge-graph-spec.md)
- [StudyPup Architecture](./knowledge-graph-readme.md)

## Support

For issues or questions:
1. Check this guide and related docs
2. Review error messages and logs
3. Test with template generation to isolate AI issues
4. Check OpenAI status page for service issues
