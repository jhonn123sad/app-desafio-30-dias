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

// Fuzzy matcher: removes non-alphanumeric to compare "Minoxidil 1" with "minoxidil_1"
const fuzzyMatch = (key1: string, key2: string): boolean => {
    if (!key1 || !key2) return false;
    const n1 = key1.toString().toLowerCase().replace(/[^a-z0-9]/g, "");
    const n2 = key2.toString().toLowerCase().replace(/[^a-z0-9]/g, "");
    return n1 === n2;
};

const looksLikeDate = (val: any): boolean => {
    if (!val) return false;
    if (typeof val === 'number' && val > 40000) return true; 
    if (typeof val !== 'string') return false;
    const s = val.trim();
    return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s);
};

interface LoadResult {
    success: boolean;
    data: Record<string, DayData> | null;
    message: string;
    debug?: string;
}

// Diagnostic function to help user debug the connection
export const diagnoseSheetConnection = async (scriptUrl: string): Promise<any> => {
    try {
        const response = await fetch(scriptUrl);
        const text = await response.text();
        
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            return {
                status: response.status,
                error: "Não foi possível ler o JSON. A URL pode estar retornando HTML (página de login ou erro).",
                rawPreview: text.substring(0, 200)
            };
        }

        let rows: any[] = [];
        if (Array.isArray(json)) rows = json;
        else if (typeof json === 'object' && json.data && Array.isArray(json.data)) rows = json.data;
        else if (typeof json === 'object') rows = Object.values(json).filter(v => Array.isArray(v)).flat();
        else rows = [json];

        return {
            status: response.status,
            rowCount: rows.length,
            headersDetected: rows.length > 0 ? Object.keys(rows[0]) : [],
            firstRowSample: rows.length > 0 ? rows[0] : null,
            rawStructure: Array.isArray(json) ? "Array" : "Object"
        };
    } catch (error: any) {
        return { error: error.message };
    }
};

export const loadFromGoogleSheets = async (scriptUrl: string): Promise<LoadResult> => {
  if (!scriptUrl) return { success: false, data: null, message: "URL não configurada." };

  try {
    const response = await fetch(scriptUrl);
    if (!response.ok) return { success: false, data: null, message: `Erro HTTP: ${response.status}` };

    const rawData = await response.json();
    
    let potentialRows: any[] = [];
    if (Array.isArray(rawData)) potentialRows = rawData;
    else if (rawData && typeof rawData === 'object') {
         // Try to find the array inside the object
         const possibleArray = Object.values(rawData).find(v => Array.isArray(v));
         if (possibleArray) potentialRows = possibleArray as any[];
         else potentialRows = [rawData]; // Maybe it's a single object?
    }

    if (!potentialRows.length) return { success: false, data: null, message: "Planilha vazia ou formato inválido." };

    // Normalize rows if they are arrays (headers in row 0) vs objects
    let processedRows = potentialRows;
    if (Array.isArray(potentialRows[0])) {
         const headers = potentialRows[0].map(String);
         processedRows = potentialRows.slice(1).map((row: any[]) => {
             const obj: any = {};
             headers.forEach((h, i) => obj[h] = row[i]);
             return obj;
         });
    }

    if (processedRows.length === 0) return { success: false, data: null, message: "Sem dados para processar." };

    const normalizedData: Record<string, DayData> = {};
    const firstRow = processedRows[0];
    const rowKeys = Object.keys(firstRow);

    // Detect Date Column
    let dateKey = rowKeys.find(k => k.toLowerCase() === 'data' || k.toLowerCase() === 'date' || k.toLowerCase() === 'dia');
    
    // Fallback: check values
    if (!dateKey) {
        for (const k of rowKeys) {
            if (looksLikeDate(firstRow[k])) {
                dateKey = k;
                break;
            }
        }
    }

    if (!dateKey) {
        return { 
            success: false, 
            data: null, 
            message: "Coluna de Data não encontrada.",
            debug: `Chaves encontradas: ${rowKeys.join(', ')}. Nenhuma parece ser uma data.`
        };
    }

    processedRows.forEach((row: any) => {
        // Parse Date
        const valDate = row[dateKey!];
        let dateStr = '';
        
        if (typeof valDate === 'string') {
             // Try to grab YYYY-MM-DD
             const match = valDate.match(/\d{4}-\d{2}-\d{2}/);
             if (match) dateStr = match[0];
             else {
                 // Try DD/MM/YYYY
                 const brMatch = valDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                 if (brMatch) dateStr = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
             }
        } else if (typeof valDate === 'number' && valDate > 40000) {
            // Excel date
            const d = new Date((valDate - 25569) * 86400 * 1000);
            dateStr = d.toISOString().split('T')[0];
        }

        // Fallback for date object
        if (!dateStr && valDate) {
            const d = new Date(valDate);
            if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
        }

        if (!dateStr) return;

        // Parse Tasks
        const tasksMap: Record<string, boolean> = {};
        const rowKeys = Object.keys(row);

        INITIAL_TASKS.forEach(task => {
            // Find key in row that fuzzy matches task.id
            // task.id = "minoxidil_1" -> row key might be "minoxidil_1" or "Minoxidil 1" or "minoxidil1"
            const matchingKey = rowKeys.find(k => fuzzyMatch(k, task.id));
            if (matchingKey) {
                tasksMap[task.id] = normalizeBoolean(row[matchingKey]);
            } else {
                tasksMap[task.id] = false;
            }
        });

        // Parse Points
        const pointKey = rowKeys.find(k => k.toLowerCase().includes('pontos') || k.toLowerCase().includes('total'));
        const points = pointKey ? Number(row[pointKey]) : 0;

        normalizedData[dateStr] = {
            date: dateStr,
            totalPoints: isNaN(points) ? 0 : points,
            tasks: tasksMap
        };
    });

    return { 
        success: true, 
        data: normalizedData, 
        message: `${Object.keys(normalizedData).length} dias processados.` 
    };

  } catch (error: any) {
    return { success: false, data: null, message: "Erro ao processar JSON.", debug: error.message };
  }
};