import { DayData, AppConfig } from '../types';
import { INITIAL_TASKS } from '../constants';

const DATA_KEY = 'routine_tracker_data';
const CONFIG_KEY = 'routine_tracker_config';

export const getStoredData = (): Record<string, DayData> => {
  const stored = localStorage.getItem(DATA_KEY);
  return stored ? JSON.parse(stored) : {};
};

export const saveStoredData = (data: Record<string, DayData>) => {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
};

export const getStoredConfig = (): AppConfig => {
  const stored = localStorage.getItem(CONFIG_KEY);
  return stored ? JSON.parse(stored) : { googleSheetScriptUrl: '' };
};

export const saveStoredConfig = (config: AppConfig) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export const syncWithGoogleSheets = async (data: DayData, scriptUrl: string): Promise<boolean> => {
  if (!scriptUrl) return false;

  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors', 
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(data),
    });
    return true;
  } catch (error) {
    console.error("Sync failed:", error);
    return false;
  }
};

const normalizeBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        return ['sim', 's', 'true', 'yes', 'y', 'verdadeiro', '1'].includes(lower);
    }
    return false;
};

export const loadFromGoogleSheets = async (scriptUrl: string): Promise<Record<string, DayData> | null> => {
  if (!scriptUrl) return null;

  try {
    console.log("Iniciando fetch da URL:", scriptUrl);
    const response = await fetch(scriptUrl);
    
    if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
    }

    const rawData = await response.json();
    console.log("Dados brutos recebidos:", rawData);
    
    if (rawData.error) {
        console.error("Google Script Error:", rawData.error);
        return null;
    }

    // Determine array of rows
    let rows: any[] = [];
    if (Array.isArray(rawData)) {
        rows = rawData;
    } else if (typeof rawData === 'object' && rawData !== null) {
         // Try to find an array property
         const arrayProp = Object.values(rawData).find(val => Array.isArray(val));
         if (arrayProp) {
             rows = arrayProp as any[];
         } else {
             // Treat object values as rows
             rows = Object.values(rawData);
         }
    }

    if (rows.length === 0) return {};

    const normalizedData: Record<string, DayData> = {};

    rows.forEach((row: any) => {
        if (!row || typeof row !== 'object') return;

        // 1. Find Date Column (Case Insensitive)
        const keys = Object.keys(row);
        const dateKeyMatch = keys.find(k => ['data', 'date', 'dia'].includes(k.toLowerCase().trim()));
        
        if (!dateKeyMatch) return;
        
        let rawDate = row[dateKeyMatch];
        let dateKey = '';
        
        try {
            if (rawDate) {
                if (typeof rawDate === 'string') {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
                        // Already YYYY-MM-DD
                        dateKey = rawDate;
                    } else if (rawDate.includes('T')) {
                        // ISO String
                        dateKey = rawDate.split('T')[0];
                    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
                        // DD/MM/YYYY
                        const [d, m, y] = rawDate.split('/');
                        dateKey = `${y}-${m}-${d}`;
                    } else {
                        // Try Date constructor as fallback
                        const d = new Date(rawDate);
                        if (!isNaN(d.getTime())) {
                             dateKey = d.toISOString().split('T')[0];
                        }
                    }
                } else if (rawDate instanceof Date) { // Unlikely from JSON but handled
                     dateKey = rawDate.toISOString().split('T')[0];
                }
            }
        } catch (e) {
            console.warn("Date parse error", rawDate);
        }

        if (!dateKey) return;

        // 2. Find Total Points (Case Insensitive)
        const pointsKeyMatch = keys.find(k => 
            ['pontostotal', 'pontos total', 'totalpoints', 'total points', 'points'].includes(k.toLowerCase().replace(/_/g, ' ').trim())
        );
        const points = pointsKeyMatch ? Number(row[pointsKeyMatch]) || 0 : 0;

        // 3. Map Tasks
        const taskMap: Record<string, boolean> = {};

        INITIAL_TASKS.forEach(task => {
            // Try exact match first
            let val = row[task.id];
            
            // If not found, try case insensitive match
            if (val === undefined) {
                const taskKeyMatch = keys.find(k => k.toLowerCase().trim() === task.id.toLowerCase().trim());
                if (taskKeyMatch) val = row[taskKeyMatch];
            }

            taskMap[task.id] = normalizeBoolean(val);
        });

        normalizedData[dateKey] = {
            date: dateKey,
            totalPoints: points,
            tasks: taskMap
        };
    });

    console.log("Dados processados:", Object.keys(normalizedData).length);
    return normalizedData;
  } catch (error) {
    console.error("Load failed full error:", error);
    return null;
  }
};