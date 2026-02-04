import { noteStyles, parseMarkdown } from '@/lib/notes-renderer';
import { ScrollView, StyleSheet, View } from 'react-native';

type Props = { notes?: string };

const SCAFFOLD_NOTES = `## 📌 Title
Photosynthesis: Converting Light into Life

## 🧠 Core Idea
**Photosynthesis** is the fundamental biochemical process by which **green plants, algae, and some bacteria** transform **light energy** from the sun into **chemical energy** stored in **glucose (sugar)**. This process also releases **oxygen** as a byproduct. It occurs primarily in **chloroplasts**, using the green pigment **chlorophyll**, and involves two interconnected stages: **light-dependent reactions** and the **light-independent reactions (Calvin cycle)**.

## ⚙️ Key Sections
### Light-Dependent Reactions
- Explanation:
  Occur in the thylakoid membranes. Light energy is captured and converted to chemical energy (ATP and NADPH).
- Steps / Mechanism:
  - Light absorption by chlorophyll
  - Water splitting (releases oxygen)
  - ATP and NADPH production

### Calvin Cycle (Light-Independent)
- Explanation:
  Occurs in the stroma. Uses ATP and NADPH to fix carbon dioxide into glucose.
- Steps / Mechanism:
  - CO2 fixation
  - Reduction phase
  - Regeneration of RuBP

## 🧮 Equations / Formulas (if applicable)
6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂

## ✨ Simplified Summary
Plants use sunlight + water + CO₂ to make sugar and release oxygen.

## ⭐ Why This Matters
Essential for life on Earth. Common exam topic in biology. Understanding helps with ecology and climate science.`;

export function NotesStudy({ notes = SCAFFOLD_NOTES }: Props) {
  const content = notes.trim() || SCAFFOLD_NOTES;

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={noteStyles.card}>
        {parseMarkdown(content)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { paddingVertical: 16, paddingBottom: 48 },
});
