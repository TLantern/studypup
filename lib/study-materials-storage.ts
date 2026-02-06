/**
 * Study Materials Storage
 * 
 * Storage and retrieval for generated study material sets
 * Implements cache-first strategy with background sync to Firebase
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StudyMaterialSet } from './knowledge-graph';

// Local Storage Keys
const MATERIALS_PREFIX = 'materials_';
const MATERIALS_INDEX_KEY = 'materials_index';

/**
 * Local Storage Functions
 */

export async function saveMaterialsLocally(materials: StudyMaterialSet): Promise<void> {
  try {
    const key = `${MATERIALS_PREFIX}${materials.id}`;
    await AsyncStorage.setItem(key, JSON.stringify(materials));
    await addToMaterialsIndex(materials.id);
  } catch (error) {
    console.error('Failed to save materials locally:', error);
    throw error;
  }
}

export async function getMaterialsLocally(materialId: string): Promise<StudyMaterialSet | null> {
  try {
    const key = `${MATERIALS_PREFIX}${materialId}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get materials locally:', error);
    return null;
  }
}

export async function getMaterialsByGraphId(graphId: string): Promise<StudyMaterialSet | null> {
  try {
    const allIds = await listLocalMaterials();
    for (const id of allIds) {
      const materials = await getMaterialsLocally(id);
      if (materials && materials.knowledge_graph_id === graphId) {
        return materials;
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to get materials by graph ID:', error);
    return null;
  }
}

export async function deleteMaterialsLocally(materialId: string): Promise<void> {
  try {
    const key = `${MATERIALS_PREFIX}${materialId}`;
    await AsyncStorage.removeItem(key);
    await removeFromMaterialsIndex(materialId);
  } catch (error) {
    console.error('Failed to delete materials locally:', error);
    throw error;
  }
}

export async function listLocalMaterials(): Promise<string[]> {
  try {
    const indexData = await AsyncStorage.getItem(MATERIALS_INDEX_KEY);
    return indexData ? JSON.parse(indexData) : [];
  } catch (error) {
    console.error('Failed to list local materials:', error);
    return [];
  }
}

/**
 * Index Management
 */

async function addToMaterialsIndex(materialId: string): Promise<void> {
  const index = await listLocalMaterials();
  if (!index.includes(materialId)) {
    index.push(materialId);
    await AsyncStorage.setItem(MATERIALS_INDEX_KEY, JSON.stringify(index));
  }
}

async function removeFromMaterialsIndex(materialId: string): Promise<void> {
  const index = await listLocalMaterials();
  const filtered = index.filter(id => id !== materialId);
  await AsyncStorage.setItem(MATERIALS_INDEX_KEY, JSON.stringify(filtered));
}

/**
 * Firebase Storage Functions
 * 
 * TODO: Uncomment when Firebase is configured
 */

/*
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

const db = getFirestore();

export async function saveMaterialsToFirebase(materials: StudyMaterialSet): Promise<void> {
  try {
    const userId = materials.user_id;
    const docRef = doc(db, 'users', userId, 'study_materials', materials.id);
    await setDoc(docRef, materials);
  } catch (error) {
    console.error('Failed to save materials to Firebase:', error);
    throw error;
  }
}

export async function getMaterialsFromFirebase(
  userId: string,
  materialId: string
): Promise<StudyMaterialSet | null> {
  try {
    const docRef = doc(db, 'users', userId, 'study_materials', materialId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as StudyMaterialSet) : null;
  } catch (error) {
    console.error('Failed to get materials from Firebase:', error);
    return null;
  }
}

export async function getMaterialsByGraphIdFromFirebase(
  userId: string,
  graphId: string
): Promise<StudyMaterialSet | null> {
  try {
    const materialsRef = collection(db, 'users', userId, 'study_materials');
    const q = query(materialsRef, where('knowledge_graph_id', '==', graphId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    return querySnapshot.docs[0].data() as StudyMaterialSet;
  } catch (error) {
    console.error('Failed to get materials by graph ID from Firebase:', error);
    return null;
  }
}

export async function deleteMaterialsFromFirebase(
  userId: string,
  materialId: string
): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'study_materials', materialId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Failed to delete materials from Firebase:', error);
    throw error;
  }
}

export async function listFirebaseMaterials(userId: string): Promise<StudyMaterialSet[]> {
  try {
    const materialsRef = collection(db, 'users', userId, 'study_materials');
    const q = query(materialsRef);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as StudyMaterialSet);
  } catch (error) {
    console.error('Failed to list Firebase materials:', error);
    return [];
  }
}
*/

/**
 * Unified Storage API (Cache-First Strategy)
 */

export async function saveMaterials(materials: StudyMaterialSet): Promise<void> {
  await saveMaterialsLocally(materials);
}

export async function updateMaterials(
  materialId: string,
  updates: Partial<Pick<StudyMaterialSet, 'flashcards' | 'quiz_questions' | 'written_questions' | 'fill_in_blank_questions' | 'notes' | 'progress' | 'user_answers' | 'updated_at'>>
): Promise<StudyMaterialSet | null> {
  const existing = await getMaterialsLocally(materialId);
  if (!existing) return null;
  const updated: StudyMaterialSet = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  await saveMaterialsLocally(updated);
  return updated;
}

export async function getMaterials(
  materialId: string,
  userId?: string
): Promise<StudyMaterialSet | null> {
  // Try local cache first
  const localMaterials = await getMaterialsLocally(materialId);
  if (localMaterials) {
    return localMaterials;
  }
  
  // TODO: Fall back to Firebase
  // if (userId) {
  //   const firebaseMaterials = await getMaterialsFromFirebase(userId, materialId);
  //   if (firebaseMaterials) {
  //     await saveMaterialsLocally(firebaseMaterials);
  //     return firebaseMaterials;
  //   }
  // }
  
  return null;
}

export async function getMaterialsForGraph(
  graphId: string,
  userId?: string
): Promise<StudyMaterialSet | null> {
  // Try local cache first
  const localMaterials = await getMaterialsByGraphId(graphId);
  if (localMaterials) {
    return localMaterials;
  }
  
  // TODO: Fall back to Firebase
  // if (userId) {
  //   const firebaseMaterials = await getMaterialsByGraphIdFromFirebase(userId, graphId);
  //   if (firebaseMaterials) {
  //     await saveMaterialsLocally(firebaseMaterials);
  //     return firebaseMaterials;
  //   }
  // }
  
  return null;
}

export async function deleteMaterials(
  materialId: string,
  userId?: string
): Promise<void> {
  await deleteMaterialsLocally(materialId);
  
  // TODO: Delete from Firebase
  // if (userId) {
  //   await deleteMaterialsFromFirebase(userId, materialId);
  // }
}

export async function listAllMaterials(userId?: string): Promise<StudyMaterialSet[]> {
  const materialIds = await listLocalMaterials();
  const materials: StudyMaterialSet[] = [];
  
  for (const id of materialIds) {
    const mat = await getMaterialsLocally(id);
    if (mat) {
      materials.push(mat);
    }
  }
  
  // TODO: Merge with Firebase materials
  // if (userId) {
  //   const firebaseMaterials = await listFirebaseMaterials(userId);
  //   // Merge and deduplicate
  // }
  
  return materials;
}

/**
 * Generate a new materials ID
 */
export function generateMaterialsId(): string {
  return `mat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new StudyMaterialSet
 */
export function createStudyMaterialSet(
  knowledgeGraphId: string,
  userId: string,
  materials: {
    flashcards: StudyMaterialSet['flashcards'];
    quiz_questions: StudyMaterialSet['quiz_questions'];
    written_questions: StudyMaterialSet['written_questions'];
    fill_in_blank_questions: StudyMaterialSet['fill_in_blank_questions'];
    notes: string;
  },
  generationMethod: 'ai' | 'template' = 'ai',
  model?: string,
  title?: string,
  emoji?: string
): StudyMaterialSet {
  const now = new Date().toISOString();
  return {
    id: generateMaterialsId(),
    knowledge_graph_id: knowledgeGraphId,
    user_id: userId,
    created_at: now,
    updated_at: now,
    flashcards: materials.flashcards,
    quiz_questions: materials.quiz_questions,
    written_questions: materials.written_questions,
    fill_in_blank_questions: materials.fill_in_blank_questions,
    notes: materials.notes,
    generation_method: generationMethod,
    model,
    title,
    emoji,
  };
}
