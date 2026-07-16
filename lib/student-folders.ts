import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StudentFolder {
  id: string;
  name: string;
  createdAt: number;
}

const FOLDERS_KEY = 'student_folders:v1';
const MATERIAL_FOLDER_MAP_KEY = 'student_material_folder_map:v1';

export async function getAllFolders(): Promise<StudentFolder[]> {
  const raw = await AsyncStorage.getItem(FOLDERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function createFolder(name: string): Promise<StudentFolder> {
  const folders = await getAllFolders();
  const folder: StudentFolder = {
    id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify([folder, ...folders]));
  return folder;
}

export async function deleteFolder(id: string): Promise<void> {
  const folders = await getAllFolders();
  await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders.filter((f) => f.id !== id)));
  const map = await getMaterialFolderMap();
  const nextMap: Record<string, string> = {};
  for (const [materialId, folderId] of Object.entries(map)) {
    if (folderId !== id) nextMap[materialId] = folderId;
  }
  await AsyncStorage.setItem(MATERIAL_FOLDER_MAP_KEY, JSON.stringify(nextMap));
}

export async function getMaterialFolderMap(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(MATERIAL_FOLDER_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function setMaterialFolder(materialId: string, folderId: string | null): Promise<void> {
  const map = await getMaterialFolderMap();
  if (folderId) {
    map[materialId] = folderId;
  } else {
    delete map[materialId];
  }
  await AsyncStorage.setItem(MATERIAL_FOLDER_MAP_KEY, JSON.stringify(map));
}
