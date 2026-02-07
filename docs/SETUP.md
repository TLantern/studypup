# StudyPup Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OpenAI (Required for AI features)

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
# Get key from: https://platform.openai.com/api-keys
```

Your `.env` should look like:
```env
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-actual-key-here
```

### 3. Run the App

```bash
# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

### 4. Running on a physical iPhone (iOS)

The app needs **Local Network** access to load the JS bundle from Metro. Grant it before opening the app:

1. **Settings → Privacy & Security → Local Network** → turn **StudyPup** ON.
2. If StudyPup isn’t listed, launch the app once (it may crash), then return to Settings and enable it.
3. Start Metro (`npx expo start`), then open the app on the device.

Without this, you’ll see: “No script URL provided” and the app won’t load.

## Project Structure

```
studypup/
├── app/                      # Screens and routes (Expo Router)
│   ├── (tabs)/              # Tab navigation screens
│   ├── choose-methods.tsx   # Select study methods
│   ├── generate-quiz.tsx    # Main study interface
│   └── ...
├── components/              # Reusable UI components
│   ├── FlashcardStudy.tsx  # Flashcard interface
│   ├── WrittenStudy.tsx    # Written questions interface
│   └── FillInBlankStudy.tsx # Fill-in-blank interface
├── lib/                     # Core business logic
│   ├── knowledge-graph.ts          # Type definitions
│   ├── knowledge-graph-storage.ts  # Local + Firebase storage
│   ├── knowledge-graph-derivation.ts # Template-based generation
│   ├── openai-service.ts           # OpenAI API wrapper
│   ├── ai-material-generation.ts   # AI-powered generation
│   ├── study-materials-storage.ts  # Material storage
│   └── content-processing.ts       # Main pipeline
└── docs/                    # Documentation
    ├── knowledge-graph-spec.md     # Knowledge graph format
    ├── knowledge-graph-readme.md   # Architecture overview
    ├── ai-integration-guide.md     # AI setup and usage
    └── SETUP.md                    # This file
```

## Feature Overview

### Content Processing Pipeline

```
User Content → Knowledge Graph → Study Materials → Local Storage → Firebase
```

1. **User provides content** (lecture recording, text, upload)
2. **AI extracts concepts** into a knowledge graph
3. **AI generates materials** (flashcards, quizzes, notes)
4. **Saved locally first** for offline access
5. **Synced to Firebase** in background

### Study Methods

- **Flashcards**: Flip cards with Q&A
- **Quiz**: Multiple choice questions
- **Written**: Essay-style questions
- **Fill in the Blank**: Cloze deletion exercises
- **Notes**: Structured markdown notes

### AI vs Template Generation

| Feature | AI (OpenAI) | Template |
|---------|-------------|----------|
| Quality | High | Medium |
| Variety | High | Low |
| Cost | ~$0.02/lecture | Free |
| Speed | 5-15 seconds | < 1 second |
| Offline | No | Yes |

The system automatically falls back to templates if AI is unavailable.

## Testing the AI Pipeline

### 1. Verify OpenAI Connection

```typescript
import { isOpenAIConfigured } from '@/lib/openai-service';

console.log('OpenAI configured:', isOpenAIConfigured());
// Should print: true
```

### 2. Run Example Workflow

```typescript
import { exampleWorkflow } from '@/lib/content-processing';

// This will:
// - Extract a knowledge graph from sample content
// - Generate all study materials using AI
// - Save everything to local storage
// - Print results to console

await exampleWorkflow();
```

### 3. Check Generated Materials

```typescript
import { listAllMaterials } from '@/lib/study-materials-storage';

const materials = await listAllMaterials();
console.log(`Found ${materials.length} material sets`);
console.log('First set:', materials[0]);
```

## Development Workflow

### Working with the App

1. **Start Metro bundler**: `npm start`
2. **Run on simulator**: Press `i` (iOS) or `a` (Android)
3. **Open DevTools**: Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android)
4. **Reload**: Press `r` in Metro or `Cmd+R` in simulator

### Adding New Features

**Example: Add a new study method**

1. Create component in `components/`:
   ```typescript
   // components/MyNewStudyMethod.tsx
   export function MyNewStudyMethod({ items }: { items: MyItem[] }) {
     return <View>...</View>;
   }
   ```

2. Add to `generate-quiz.tsx`:
   ```typescript
   {activeTab === 'my_method' && <MyNewStudyMethod items={items} />}
   ```

3. Add to `choose-methods.tsx` METHODS array:
   ```typescript
   { id: 'my_method', label: 'My Method', icon: require('...') }
   ```

### Adding AI Generation for New Materials

1. Define type in `lib/knowledge-graph.ts`:
   ```typescript
   export type MyMaterial = {
     id: string;
     concept_id: string;
     content: string;
   };
   ```

2. Create generation function in `lib/ai-material-generation.ts`:
   ```typescript
   export async function generateMyMaterialWithAI(
     graph: KnowledgeGraph
   ): Promise<MyMaterial[]> {
     const systemPrompt = `...`;
     const userPrompt = `...`;
     const response = await callOpenAI(...);
     return response.items;
   }
   ```

3. Add to `StudyMaterialSet` type:
   ```typescript
   export type StudyMaterialSet = {
     // ... existing fields
     my_materials: MyMaterial[];
   };
   ```

4. Update `generateAllMaterialsWithAI()` to include it

## Environment Variables

### Required

- `EXPO_PUBLIC_OPENAI_API_KEY`: OpenAI API key for AI features

### Optional

- `EXPO_PUBLIC_FIREBASE_*`: Firebase configuration (for sync)
- `EXPO_PUBLIC_SUPERWALL_*`: Paywall configuration (already set up)

## Storage

### Local (AsyncStorage)

All data is cached locally first:
- Knowledge graphs: `kg_{id}`
- Study materials: `materials_{id}`
- Indexes: `kg_index`, `materials_index`

### Firebase (Firestore)

Data syncs to Firebase when online:
```
/users/{userId}/
  ├── knowledge_graphs/{graphId}
  └── study_materials/{materialId}
```

To enable Firebase sync:
1. Add Firebase config to `.env`
2. Uncomment Firebase code in storage files
3. Initialize Firebase in `app/_layout.tsx`

## Common Tasks

### Clear Local Storage

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Clear everything
await AsyncStorage.clear();

// Clear specific items
await AsyncStorage.removeItem('kg_abc123');
await AsyncStorage.removeItem('materials_xyz789');
```

### Export Study Materials

```typescript
import { getMaterials } from '@/lib/study-materials-storage';

const materials = await getMaterials(materialId);
const json = JSON.stringify(materials, null, 2);

// Save to file or share
```

### Debug AI Calls

```typescript
import { callOpenAI } from '@/lib/openai-service';

// Test a raw API call
const result = await callOpenAI(
  'You are a helpful assistant.',
  'What is 2+2?'
);
console.log(result);
```

## Troubleshooting

### "OpenAI API key not configured"

- Check `.env` file exists in project root
- Verify `EXPO_PUBLIC_OPENAI_API_KEY` is set
- Restart Metro bundler after changing `.env`

### "Network request failed"

- Check internet connection
- Verify OpenAI API key is valid
- Check OpenAI service status

### Materials not generating

- Check console for errors
- Verify knowledge graph exists
- Try template generation (set `useAI: false`)

### Slow performance

- Check if AI generation is timing out
- Reduce material counts in generation calls
- Enable template generation as fallback

### "No script URL provided" (iOS dev build)

- **Metro must be running** before or when the app launches. In one terminal run `npx expo start`, wait until it says "Metro waiting on...", then in another terminal run `npx expo run:ios`. Or run `npx expo run:ios` and wait for Metro to start before the app opens.
- If the app still can't load the bundle, regenerate the native project: `npx expo prebuild --clean` then `npx expo run:ios`.

### "Firebase app has not yet been configured" / Bundle ID inconsistent

- The project uses `expo-firebase-core` so native Firebase is initialized from `GoogleService-Info.plist`. Ensure `app.json` → `ios.bundleIdentifier` matches the `BUNDLE_ID` in `GoogleService-Info.plist` (e.g. `com.studypup.app`).
- If you still see a bundle ID mismatch, regenerate the native project: `npx expo prebuild --clean` then `npx expo run:ios`. If your plist has a different bundle ID, either change `app.json` to match or download a new `GoogleService-Info.plist` from Firebase Console for your app’s bundle ID.

## Next Steps

1. **Read the docs**:
   - [Knowledge Graph Spec](./knowledge-graph-spec.md)
   - [AI Integration Guide](./ai-integration-guide.md)
   - [Architecture Overview](./knowledge-graph-readme.md)

2. **Test the pipeline**:
   - Run `exampleWorkflow()`
   - Generate materials from test content
   - Verify storage works

3. **Integrate with UI**:
   - Connect Choose Methods → Generate flow
   - Load materials in study screens
   - Add loading states

4. **Deploy**:
   - Set up Firebase
   - Configure environment for production
   - Test on physical devices

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)

## Support

For help:
1. Check this guide and related documentation
2. Review console logs for errors
3. Test with template generation to isolate issues
4. Check service status pages (OpenAI, Firebase, etc.)
