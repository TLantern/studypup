# Knowledge Graph Specification

## Overview

This document specifies the canonical representation for all user learning content in StudyPup. User-provided material (lectures, notes, text, etc.) is converted into a normalized knowledge graph stored as JSON. This graph serves as the single source of truth from which all study materials are derived: notes, flashcards, quizzes, written questions, fill-in-the-blank exercises, and tutoring responses.

## Storage

- **Local Cache**: Stored on device using AsyncStorage or local file system for offline access
- **Firebase Backend**: Synced to Firestore under `/users/{userId}/knowledge_graphs/{graphId}`

## Task

Convert user-provided learning material into a normalized knowledge graph in JSON format.

## Rules

### 1. Atomic Concepts Only
- One concept = one node
- Each concept represents a single, indivisible idea
- Do NOT combine multiple distinct ideas into one node

### 2. Required Fields for Each Concept

Every concept node MUST include:

```typescript
{
  id: string;              // snake_case, stable identifier
  definition: string;      // concise, factual explanation
  inputs?: string[];       // what goes into this concept (if applicable)
  outputs?: string[];      // what results from this concept (if applicable)
  process_steps?: string[]; // ordered steps (if concept is a process)
  dependencies: string[];  // concept IDs this relies on (empty array if none)
  common_mistakes: string[]; // student confusions/misconceptions
}
```

### 3. Scope Preservation
- Extract ONLY concepts present in the user's material
- Match the user's depth/level — do not add advanced material
- Do NOT assume prior knowledge beyond the input

### 4. Stability
- IDs must be deterministic (same input → same IDs)
- Use descriptive snake_case (e.g., `mitochondria_energy_production`, not `concept_1`)

### 5. Output Format
- Valid JSON only
- No prose outside the JSON structure
- Must be parseable by `JSON.parse()`

## JSON Schema

```typescript
type KnowledgeGraph = {
  id: string;           // Unique graph ID (UUID or hash of content)
  user_id: string;      // Firebase user ID
  created_at: string;   // ISO 8601 timestamp
  updated_at: string;   // ISO 8601 timestamp
  source: {
    type: 'lecture' | 'text' | 'upload' | 'manual';
    content_hash?: string;  // For deduplication
    metadata?: Record<string, any>; // Original filename, duration, etc.
  };
  concepts: Concept[];
};

type Concept = {
  id: string;              // snake_case, stable
  definition: string;      // Concise, factual
  inputs?: string[];       // Optional: what goes in
  outputs?: string[];      // Optional: what comes out
  process_steps?: string[]; // Optional: ordered steps
  dependencies: string[];  // Concept IDs this relies on (can be empty)
  common_mistakes: string[]; // Student confusions
};
```

## Example

### Input Material

> "Mitochondria are the powerhouse of the cell. They convert glucose and oxygen into ATP through a process called cellular respiration. Without mitochondria, cells would not have enough energy to function. The process has three main stages: glycolysis, the Krebs cycle, and the electron transport chain."

### Output Knowledge Graph

```json
{
  "id": "kg_abc123",
  "user_id": "user_xyz789",
  "created_at": "2026-02-03T16:00:00Z",
  "updated_at": "2026-02-03T16:00:00Z",
  "source": {
    "type": "text",
    "content_hash": "sha256:..."
  },
  "concepts": [
    {
      "id": "mitochondria",
      "definition": "Organelles in cells that produce energy",
      "inputs": ["glucose", "oxygen"],
      "outputs": ["atp", "carbon_dioxide", "water"],
      "dependencies": [],
      "common_mistakes": [
        "Confusing mitochondria with other organelles like chloroplasts",
        "Thinking all cells have mitochondria (red blood cells don't)"
      ]
    },
    {
      "id": "cellular_respiration",
      "definition": "Process that converts glucose and oxygen into ATP in mitochondria",
      "inputs": ["glucose", "oxygen"],
      "outputs": ["atp", "carbon_dioxide", "water"],
      "process_steps": [
        "Glycolysis: glucose broken down into pyruvate",
        "Krebs cycle: pyruvate processed to release energy",
        "Electron transport chain: most ATP produced"
      ],
      "dependencies": ["mitochondria", "glucose", "oxygen"],
      "common_mistakes": [
        "Confusing cellular respiration with breathing",
        "Forgetting that oxygen is required",
        "Not understanding the three stages occur in sequence"
      ]
    },
    {
      "id": "atp",
      "definition": "Adenosine triphosphate; the primary energy currency of cells",
      "outputs": ["cellular_energy"],
      "dependencies": ["cellular_respiration"],
      "common_mistakes": [
        "Thinking ATP is stored long-term (it's used immediately)",
        "Not understanding ATP is constantly regenerated"
      ]
    },
    {
      "id": "glucose",
      "definition": "Simple sugar molecule that serves as the primary energy source for cellular respiration",
      "outputs": ["pyruvate"],
      "dependencies": [],
      "common_mistakes": [
        "Confusing glucose with other sugars",
        "Not understanding glucose comes from food we eat"
      ]
    },
    {
      "id": "oxygen",
      "definition": "Gas required for aerobic cellular respiration",
      "dependencies": [],
      "common_mistakes": [
        "Thinking oxygen is produced by mitochondria (it's consumed)"
      ]
    }
  ]
}
```

## Derivation Examples

### From Knowledge Graph → Flashcard

**Concept**: `mitochondria`

**Front**: "What is the function of mitochondria?"

**Back**: "Organelles in cells that produce energy (ATP) from glucose and oxygen through cellular respiration."

---

### From Knowledge Graph → Quiz Question

**Concept**: `cellular_respiration`

**Question**: "What are the three main stages of cellular respiration?"

**Options**:
- A) Photosynthesis, glycolysis, fermentation
- B) Glycolysis, Krebs cycle, electron transport chain ✓
- C) Transcription, translation, replication
- D) Mitosis, meiosis, cytokinesis

---

### From Knowledge Graph → Fill-in-the-Blank

**Concept**: `mitochondria`

**Question**: "The ___ are organelles that convert glucose and oxygen into ATP."

**Answer**: "mitochondria"

---

### From Knowledge Graph → Written Question

**Concept**: `cellular_respiration`

**Question**: "Explain how cellular respiration produces energy for the cell. Include the inputs, outputs, and main stages in your answer."

**Grading Rubric** (derived from concept):
- ✓ Mentions glucose and oxygen as inputs
- ✓ Mentions ATP as primary output
- ✓ Lists three stages: glycolysis, Krebs cycle, electron transport chain
- ✓ Explains process occurs in mitochondria

---

## Implementation Guidelines

### Local Storage (React Native)

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Save knowledge graph locally
async function saveKnowledgeGraphLocally(graph: KnowledgeGraph): Promise<void> {
  const key = `kg_${graph.id}`;
  await AsyncStorage.setItem(key, JSON.stringify(graph));
}

// Retrieve knowledge graph locally
async function getKnowledgeGraphLocally(graphId: string): Promise<KnowledgeGraph | null> {
  const key = `kg_${graphId}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}
```

### Firebase Storage (Firestore)

```typescript
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Save knowledge graph to Firebase
async function saveKnowledgeGraphToFirebase(
  userId: string,
  graph: KnowledgeGraph
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'knowledge_graphs', graph.id);
  await setDoc(docRef, graph);
}

// Retrieve knowledge graph from Firebase
async function getKnowledgeGraphFromFirebase(
  userId: string,
  graphId: string
): Promise<KnowledgeGraph | null> {
  const docRef = doc(db, 'users', userId, 'knowledge_graphs', graphId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() as KnowledgeGraph : null;
}
```

### Sync Strategy

1. **Content Upload/Recording**:
   - User provides content (lecture recording, text, etc.)
   - Content sent to AI service (OpenAI, etc.) for knowledge graph extraction
   - AI returns JSON knowledge graph following this spec

2. **Save Locally First**:
   - Save to AsyncStorage immediately for offline access
   - Update UI to show generated content

3. **Background Sync to Firebase**:
   - Upload to Firestore when network available
   - Handle conflicts (last-write-wins or merge strategies)

4. **Retrieval Priority**:
   - Check local cache first (fast)
   - Fall back to Firebase if not found locally
   - Cache Firebase results locally for subsequent access

## Common Mistakes to Avoid

### ❌ Bad: Vague or Compound Concepts
```json
{
  "id": "cell_stuff",
  "definition": "Mitochondria and chloroplasts do energy things",
  "dependencies": []
}
```

### ✅ Good: Atomic, Specific Concepts
```json
{
  "id": "mitochondria",
  "definition": "Organelles in cells that produce energy through cellular respiration",
  "dependencies": []
},
{
  "id": "chloroplasts",
  "definition": "Organelles in plant cells that perform photosynthesis",
  "dependencies": []
}
```

---

### ❌ Bad: Adding Unstated Material
```json
{
  "id": "krebs_cycle",
  "definition": "Second stage of cellular respiration involving citric acid",
  "process_steps": [
    "Acetyl-CoA enters the cycle",
    "Citric acid is formed",
    "NADH and FADH2 are produced",
    "GTP is generated"
  ]
}
```
*If the user's material only mentioned "Krebs cycle" as a stage, don't add detailed steps.*

### ✅ Good: Scope-Preserving
```json
{
  "id": "krebs_cycle",
  "definition": "Second stage of cellular respiration that processes pyruvate to release energy",
  "dependencies": ["cellular_respiration", "pyruvate"],
  "common_mistakes": []
}
```

---

## Next Steps

Once the knowledge graph is generated and stored:

1. **Notes Generation**: Render concepts as structured notes with headers, definitions, and relationships
2. **Flashcard Generation**: Create front/back pairs from concept definitions and Q&A
3. **Quiz Generation**: Generate multiple-choice questions using concepts and common_mistakes
4. **Written Questions**: Create open-ended questions targeting key concepts
5. **Fill-in-the-Blank**: Use definitions to create cloze deletion exercises
6. **Tutoring**: Use graph to answer student questions and explain relationships between concepts

Each derivation should reference the source concept IDs for tracking and analytics.
