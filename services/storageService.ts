
import { DayData, TaskDefinition, Period } from '../types';
import { INITIAL_TASKS } from '../constants';

// Keys
const DATA_KEY_HISTORY = 'routine_tracker_history_v2';
const DATA_KEY_DEFS = 'routine_tracker_definitions_v1';

// --- Task Definitions (Structure) ---

export const getStoredTaskDefinitions = (): TaskDefinition[] => {
  const stored = localStorage.getItem(DATA_KEY_DEFS);
  if (stored) {
    return JSON.parse(stored);
  }
  
  // First run: Seed with INITIAL_TASKS from constants
  const initialDefs: TaskDefinition[] = INITIAL_TASKS.map(t => ({
    id: t.id,
    label: t.label,
    period: t.period,
    points: t.points
  }));
  
  saveStoredTaskDefinitions(initialDefs);
  return initialDefs;
};

export const saveStoredTaskDefinitions = (defs: TaskDefinition[]) => {
  localStorage.setItem(DATA_KEY_DEFS, JSON.stringify(defs));
};

// --- Progress History ---

export const getStoredHistory = (): Record<string, DayData> => {
  const stored = localStorage.getItem(DATA_KEY_HISTORY);
  return stored ? JSON.parse(stored) : {};
};

export const saveDayProgress = (dayData: DayData) => {
  const history = getStoredHistory();
  history[dayData.date] = dayData;
  localStorage.setItem(DATA_KEY_HISTORY, JSON.stringify(history));
};

export const clearAllData = () => {
  localStorage.removeItem(DATA_KEY_HISTORY);
  localStorage.removeItem(DATA_KEY_DEFS);
};
