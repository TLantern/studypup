/**
 * Knowledge Graph Storage
 * 
 * Utilities for storing and retrieving knowledge graphs from:
 * - Local device cache (AsyncStorage)
 * - Firebase Firestore
 * 
 * Implements a cache-first strategy with background sync.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KnowledgeGraph } from './knowledge-graph';

// Local Storage Keys
const KG_PREFIX = 'kg_';
const KG_INDEX_KEY = 'kg_index'; // List of all graph IDs

/**
 * Local Storage Functions
 */

export async function saveKnowledgeGraphLocally(graph: KnowledgeGraph): Promise<void> {
  try {
    const key = `${KG_PREFIX}${graph.id}`;
    await AsyncStorage.setItem(key, JSON.stringify(graph));
    
    // Update index
    await addToIndex(graph.id);
  } catch (error) {
    console.error('Failed to save knowledge graph locally:', error);
    throw error;
  }
}

export async function getKnowledgeGraphLocally(graphId: string): Promise<KnowledgeGraph | null> {
  try {
    const key = `${KG_PREFIX}${graphId}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get knowledge graph locally:', error);
    return null;
  }
}

export async function deleteKnowledgeGraphLocally(graphId: string): Promise<void> {
  try {
    const key = `${KG_PREFIX}${graphId}`;
    await AsyncStorage.removeItem(key);
    await removeFromIndex(graphId);
  } catch (error) {
    console.error('Failed to delete knowledge graph locally:', error);
    throw error;
  }
}

export async function listLocalKnowledgeGraphs(): Promise<string[]> {
  try {
    const indexData = await AsyncStorage.getItem(KG_INDEX_KEY);
    return indexData ? JSON.parse(indexData) : [];
  } catch (error) {
    console.error('Failed to list local knowledge graphs:', error);
    return [];
  }
}

export async function getKnowledgeGraphByContentHash(
  userId: string,
  contentHash: string
): Promise<KnowledgeGraph | null> {
  const graphIds = await listLocalKnowledgeGraphs();
  for (const id of graphIds) {
    const graph = await getKnowledgeGraphLocally(id);
    if (graph && graph.user_id === userId && graph.source?.content_hash === contentHash) {
      return graph;
    }
  }
  return null;
}

/**
 * Index Management
 */

async function addToIndex(graphId: string): Promise<void> {
  const index = await listLocalKnowledgeGraphs();
  if (!index.includes(graphId)) {
    index.push(graphId);
    await AsyncStorage.setItem(KG_INDEX_KEY, JSON.stringify(index));
  }
}

async function removeFromIndex(graphId: string): Promise<void> {
  const index = await listLocalKnowledgeGraphs();
  const filtered = index.filter(id => id !== graphId);
  await AsyncStorage.setItem(KG_INDEX_KEY, JSON.stringify(filtered));
}

/**
 * Firebase Storage Functions
 * 
 * Note: Firebase imports are commented out since Firebase may not be fully configured yet.
 * Uncomment and configure when Firebase is ready.
 */

/*
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const db = getFirestore();

export async function saveKnowledgeGraphToFirebase(graph: KnowledgeGraph): Promise<void> {
  try {
    const userId = graph.user_id;
    const docRef = doc(db, 'users', userId, 'knowledge_graphs', graph.id);
    await setDoc(docRef, graph);
  } catch (error) {
    console.error('Failed to save knowledge graph to Firebase:', error);
    throw error;
  }
}

export async function getKnowledgeGraphFromFirebase(
  userId: string,
  graphId: string
): Promise<KnowledgeGraph | null> {
  try {
    const docRef = doc(db, 'users', userId, 'knowledge_graphs', graphId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as KnowledgeGraph) : null;
  } catch (error) {
    console.error('Failed to get knowledge graph from Firebase:', error);
    return null;
  }
}

export async function deleteKnowledgeGraphFromFirebase(
  userId: string,
  graphId: string
): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'knowledge_graphs', graphId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Failed to delete knowledge graph from Firebase:', error);
    throw error;
  }
}

export async function listFirebaseKnowledgeGraphs(userId: string): Promise<KnowledgeGraph[]> {
  try {
    const graphsRef = collection(db, 'users', userId, 'knowledge_graphs');
    const q = query(graphsRef);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as KnowledgeGraph);
  } catch (error) {
    console.error('Failed to list Firebase knowledge graphs:', error);
    return [];
  }
}
*/

/**
 * Unified Storage API (Cache-First Strategy)
 * 
 * These functions try local cache first, then fall back to Firebase.
 * Writes go to local immediately, then sync to Firebase in background.
 */

export async function saveKnowledgeGraph(graph: KnowledgeGraph): Promise<void> {
  // Always save locally first for immediate access
  await saveKnowledgeGraphLocally(graph);
  
  // TODO: Background sync to Firebase when network available
  // await saveKnowledgeGraphToFirebase(graph);
}

export async function getKnowledgeGraph(
  graphId: string,
  userId?: string
): Promise<KnowledgeGraph | null> {
  // Try local cache first
  const localGraph = await getKnowledgeGraphLocally(graphId);
  if (localGraph) {
    return localGraph;
  }
  
  // TODO: Fall back to Firebase if not found locally
  // if (userId) {
  //   const firebaseGraph = await getKnowledgeGraphFromFirebase(userId, graphId);
  //   if (firebaseGraph) {
  //     // Cache it locally for next time
  //     await saveKnowledgeGraphLocally(firebaseGraph);
  //     return firebaseGraph;
  //   }
  // }
  
  return null;
}

export async function deleteKnowledgeGraph(
  graphId: string,
  userId?: string
): Promise<void> {
  // Delete from local cache
  await deleteKnowledgeGraphLocally(graphId);
  
  // TODO: Delete from Firebase
  // if (userId) {
  //   await deleteKnowledgeGraphFromFirebase(userId, graphId);
  // }
}

export async function listKnowledgeGraphs(userId?: string): Promise<KnowledgeGraph[]> {
  // Get list from local cache
  const graphIds = await listLocalKnowledgeGraphs();
  const graphs: KnowledgeGraph[] = [];
  
  for (const id of graphIds) {
    const graph = await getKnowledgeGraphLocally(id);
    if (graph) {
      graphs.push(graph);
    }
  }
  
  // TODO: Merge with Firebase graphs and sync
  // if (userId) {
  //   const firebaseGraphs = await listFirebaseKnowledgeGraphs(userId);
  //   // Merge and deduplicate
  //   // Update local cache with any missing graphs
  // }
  
  return graphs;
}

/**
 * Generate a new knowledge graph ID
 */
export function generateKnowledgeGraphId(): string {
  return `kg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new knowledge graph with metadata
 */
export function createKnowledgeGraph(
  userId: string,
  source: KnowledgeGraph['source'],
  concepts: KnowledgeGraph['concepts']
): KnowledgeGraph {
  const now = new Date().toISOString();
  return {
    id: generateKnowledgeGraphId(),
    user_id: userId,
    created_at: now,
    updated_at: now,
    source,
    concepts,
  };
}
