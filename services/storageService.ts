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
        // Adicionado suporte explícito para Sim/Não e variações
        return ['sim', 's', 'true', 'yes', 'y', 'verdadeiro', '1'].includes(lower);
    }
    return false;
};

const normalizeKey = (key: string): string => {
    if (!key) return '';
    // Remove accents, special chars, spaces, underscores, lower case
    return key.toString().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, ""); // keep only alphanumeric
};

export const loadFromGoogleSheets = async (scriptUrl: string): Promise<Record<string, DayData> | null> => {
  if (!scriptUrl) return null;

  try {
    console.log("Iniciando fetch da URL:", scriptUrl);
    const response = await fetch(scriptUrl);
    
    if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
    }

    let rawData = await response.json();
    
    if (rawData && rawData.error) {
        console.error("Google Script Error:", rawData.error);
        return null;
    }

    // 1. Extract potential rows from various JSON structures
    let potentialRows: any[] = [];
    
    if (Array.isArray(rawData)) {
        potentialRows = rawData;
    } else if (typeof rawData === 'object' && rawData !== null) {
        // Try to find an array property (like 'data', 'values', 'items', 'records')
        // Or use Object.values if it looks like a keyed list
        const arrayProp = Object.values(rawData).find(val => Array.isArray(val));
        if (arrayProp) {
            potentialRows = arrayProp as any[];
        } else {
            // Fallback: maybe the object itself is a map of ID -> Object
            potentialRows = Object.values(rawData);
        }
    }

    if (potentialRows.length === 0) return {};

    // 2. Normalize to List of Objects (Handle 2D Arrays vs Objects)
    let processedRows: any[] = [];

    // Check if it's a 2D array (list of lists) - Common in Sheets API values
    if (potentialRows.length > 0 && Array.isArray(potentialRows[0])) {
        // It's headers + values
        const headers = potentialRows[0].map((h: any) => String(h));
        const dataLines = potentialRows.slice(1);
        
        processedRows = dataLines.map((line: any[]) => {
            const obj: any = {};
            headers.forEach((h, i) => {
                // Handle case where row might be shorter than headers
                obj[h] = line[i] !== undefined ? line[i] : ''; 
            });
            return obj;
        });
    } else {
        // It's already a list of objects
        processedRows = potentialRows;
    }

    const normalizedData: Record<string, DayData> = {};

    processedRows.forEach((row: any) => {
        if (!row || typeof row !== 'object') return;

        // Cria um mapa de chaves normalizadas para facilitar a busca
        // Ex: "Pontos Total" -> "pontostotal", "Data" -> "data", "minoxidil_1" -> "minoxidil1"
        const rowKeys = Object.keys(row);
        const normalizedRowMap: Record<string, any> = {};
        
        rowKeys.forEach(key => {
            const cleanKey = normalizeKey(key);
            normalizedRowMap[cleanKey] = row[key];
        });

        // 1. Encontrar a Data
        // Procura por chaves comuns: 'data', 'date', 'dia'
        let rawDate = normalizedRowMap['data'] || normalizedRowMap['date'] || normalizedRowMap['dia'];
        
        let dateKey = '';
        
        if (rawDate) {
            if (typeof rawDate === 'string') {
                const cleanDate = rawDate.trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
                    dateKey = cleanDate;
                } else if (cleanDate.includes('T')) {
                    dateKey = cleanDate.split('T')[0];
                } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
                    const [d, m, y] = cleanDate.split('/');
                    dateKey = `${y}-${m}-${d}`; // ISO
                } else {
                     const d = new Date(cleanDate);
                     if (!isNaN(d.getTime())) dateKey = d.toISOString().split('T')[0];
                }
            } else if (typeof rawDate === 'number') {
                 // Handle Excel Serial Date if necessary (unlikely via JSON but possible)
                 // 25569 is offset for 1970-01-01
                 if (rawDate > 40000) { 
                    const d = new Date((rawDate - 25569) * 86400 * 1000);
                    if (!isNaN(d.getTime())) dateKey = d.toISOString().split('T')[0];
                 }
            }
        }

        if (!dateKey) return; // Pula linha se não tiver data válida

        // 2. Encontrar Pontos
        const pointsVal = normalizedRowMap['pontostotal'] || normalizedRowMap['totalpoints'] || normalizedRowMap['pontos'];
        const points = Number(pointsVal) || 0;

        // 3. Mapear Tarefas
        const taskMap: Record<string, boolean> = {};

        INITIAL_TASKS.forEach(task => {
            // Normaliza o ID da tarefa (ex: minoxidil_1 -> minoxidil1) para busca
            const searchKey = normalizeKey(task.id);
            
            // Tenta achar o valor usando a chave normalizada
            const val = normalizedRowMap[searchKey];
            
            taskMap[task.id] = normalizeBoolean(val);
        });

        normalizedData[dateKey] = {
            date: dateKey,
            totalPoints: points,
            tasks: taskMap
        };
    });

    console.log(`Sucesso! ${Object.keys(normalizedData).length} dias processados.`);
    return normalizedData;
  } catch (error) {
    console.error("Load failed full error:", error);
    return null;
  }
};