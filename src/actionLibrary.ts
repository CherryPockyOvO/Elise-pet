import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { Heading } from './eliseTurns';

export type ActionKind = 'gesture' | 'walk';
export type ImportedAction = {
  id: string;
  heading: Heading;
  name: string;
  kind: ActionKind;
  fps: number;
  frameCount: number;
  footOffset: number;
  frames: string[];
};

const DISABLED_KEY = 'elise-pet.actions.disabled';

function withFrameUrls(action: ImportedAction): ImportedAction {
  return { ...action, frames: action.frames.map(frame => convertFileSrc(frame)) };
}

export async function loadActionLibrary() {
  return (await invoke<ImportedAction[]>('list_imported_actions')).map(withFrameUrls);
}

export async function importActionFolder(heading: Heading, kind: ActionKind, fps: number) {
  const action = await invoke<ImportedAction | null>('import_action_folder', { heading, kind, fps });
  return action && withFrameUrls(action);
}

export function loadDisabledActions(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(DISABLED_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveDisabledActions(disabled: string[]) {
  localStorage.setItem(DISABLED_KEY, JSON.stringify(disabled));
}

export function preloadImportedAction(action: ImportedAction) {
  action.frames.forEach(source => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = source;
  });
}
