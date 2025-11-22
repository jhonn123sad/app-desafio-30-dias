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

const cleanKey = (key: string) => key.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, "");

const fuzzyMatch = (key1: string, key2: string): boolean => {
    if (!key1 || !key2) return false;
    return cleanKey(key1) === cleanKey(key2);
};

const looksLikeDate = (val: any): boolean => {
    if (!val) return false;
    if (typeof val === 'number' && val > 30000 && val < 60000) return true; // Excel serial date
    if (typeof val !== 'string') return false;
    const s = val.trim();
    // Matches YYYY-MM-DD, DD/MM/YYYY, or ISO strings starting with year
    return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s) || /^\d{4}-\d{2}-\d{2}T/.test(s);
};

interface LoadResult {
    success: boolean;
    data: Record<string, DayData> | null;
    message: string;
    debug?: string;
}

// Diagnostic function
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
                error: "Não foi possível ler o JSON. A resposta não é um JSON válido.",
                rawPreview: text.substring(0, 500) // Show HTML or error text
            };
        }

        let rows: any[] = [];
        let structureType = "Unknown";

        if (Array.isArray(json)) {
            rows = json;
            structureType = "Array Root";
        } else if (typeof json === 'object') {
            if (Array.isArray(json.data)) { rows = json.data; structureType = "Object with .data"; }
            else if (Array.isArray(json.values)) { rows = json.values; structureType = "Object with .values"; }
            else if (Array.isArray(json.items)) { rows = json.items; structureType = "Object with .items"; }
            else {
                const arr = Object.values(json).find(v => Array.isArray(v));
                if (arr) { rows = arr as any[]; structureType = "Object with auto-detected array"; }
                else { rows = [json]; structureType = "Single Object"; }
            }
        }

        return {
            status: response.status,
            rowCount: rows.length,
            structureType,
            headersDetected: rows.length > 0 ? (typeof rows[0] === 'object' ? Object.keys(rows[0]) : ['Raw Array']) : [],
            firstRowSample: rows.length > 0 ? rows[0] : null,
            rawJsonSnippet: JSON.stringify(json).substring(0, 300) + "..."
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
    
    // 1. Robust Structure Detection
    let potentialRows: any[] = [];
    if (Array.isArray(rawData)) potentialRows = rawData;
    else if (rawData && typeof rawData === 'object') {
         if (Array.isArray(rawData.data)) potentialRows = rawData.data;
         else if (Array.isArray(rawData.values)) potentialRows = rawData.values;
         else if (Array.isArray(rawData.items)) potentialRows = rawData.items;
         else if (Array.isArray(rawData.rows)) potentialRows = rawData.rows;
         else {
             // Fallback: find any property that is an array
             const possibleArray = Object.values(rawData).find(v => Array.isArray(v));
             if (possibleArray) potentialRows = possibleArray as any[];
             else potentialRows = [rawData]; 
         }
    }

    if (!potentialRows.length) return { success: false, data: null, message: "Planilha vazia ou formato inválido." };

    // 2. Normalize Rows (Handle Array of Arrays vs Array of Objects)
    let processedRows = potentialRows;
    // If the first item is an array, it's likely [["Header1", "Header2"], ["Val1", "Val2"]]
    // OR it's a list of values without headers if the script is simple.
    // We assume if it's a 2D array, Row 0 = Headers.
    if (Array.isArray(potentialRows[0])) {
         const headers = potentialRows[0].map(String);
         processedRows = potentialRows.slice(1).map((row: any[]) => {
             const obj: any = {};
             headers.forEach((h, i) => obj[h] = row[i]);
             return obj;
         });
    }

    if (processedRows.length === 0) return { success: false, data: null, message: "Sem dados para processar." };

    const firstRow = processedRows[0];
    const rowKeys = Object.keys(firstRow);

    // 3. Advanced Date Column Detection
    
    // Strategy A: Name match
    let dateKey = rowKeys.find(k => {
        const c = cleanKey(k);
        return c === 'data' || c === 'date' || c === 'dia' || c === 'timestamp' || c === 'dt';
    });
    
    // Strategy B: Content Scan (Check first 5 rows)
    if (!dateKey) {
        const sampleRows = processedRows.slice(0, 5);
        const columnScores: Record<string, number> = {};
        
        for (const k of rowKeys) {
            let validDates = 0;
            for (const row of sampleRows) {
                if (looksLikeDate(row[k])) validDates++;
            }
            if (validDates > 0) columnScores[k] = validDates;
        }
        
        // Pick column with most valid dates
        const bestCol = Object.keys(columnScores).sort((a, b) => columnScores[b] - columnScores[a])[0];
        if (bestCol) dateKey = bestCol;
    }

    // Strategy C: Force Index 0 (The "Column A" fallback)
    if (!dateKey && rowKeys.length > 0) {
        // If the first column has *any* data, assume it's the date column as a last resort
        // But verify it looks vaguely like a date or string
        const firstColKey = rowKeys[0];
        const val = firstRow[firstColKey];
        if (looksLikeDate(val) || (typeof val === 'string' && val.length >= 8)) {
            dateKey = firstColKey;
        }
    }

    if (!dateKey) {
        return { 
            success: false, 
            data: null, 
            message: "Coluna de Data não encontrada.",
            debug: `Chaves detectadas: [${rowKeys.join(', ')}].\nValor da primeira coluna (exemplo): ${rowKeys.length ? firstRow[rowKeys[0]] : 'N/A'}`
        };
    }

    const normalizedData: Record<string, DayData> = {};

    processedRows.forEach((row: any) => {
        const valDate = row[dateKey!];
        let dateStr = '';
        
        // Date Parsing Logic
        if (typeof valDate === 'string') {
             const match = valDate.match(/\d{4}-\d{2}-\d{2}/); // YYYY-MM-DD
             if (match) dateStr = match[0];
             else {
                 const brMatch = valDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // DD/MM/YYYY
                 if (brMatch) {
                     const y = brMatch[3].length === 2 ? `20${brMatch[3]}` : brMatch[3];
                     const m = brMatch[2].padStart(2, '0');
                     const d = brMatch[1].padStart(2, '0');
                     dateStr = `${y}-${m}-${d}`;
                 }
             }
             // Try generic Date parse if manual regex failed
             if (!dateStr) {
                 const d = new Date(valDate);
                 if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
             }
        } else if (typeof valDate === 'number') {
            // Excel date (approximate)
            if (valDate > 30000) {
                const d = new Date((valDate - 25569) * 86400 * 1000);
                dateStr = d.toISOString().split('T')[0];
            }
        }

        if (!dateStr) return; // Skip invalid dates

        const tasksMap: Record<string, boolean> = {};
        const currentRowKeys = Object.keys(row);

        INITIAL_TASKS.forEach(task => {
            const matchingKey = currentRowKeys.find(k => fuzzyMatch(k, task.id));
            if (matchingKey) {
                tasksMap[task.id] = normalizeBoolean(row[matchingKey]);
            } else {
                tasksMap[task.id] = false;
            }
        });

        // Find points column
        const pointKey = currentRowKeys.find(k => {
            const c = cleanKey(k);
            return c.includes('ponto') || c.includes('total');
        });
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
        message: `${Object.keys(normalizedData).length} dias processados com sucesso.` 
    };

  } catch (error: any) {
    return { success: false, data: null, message: "Erro ao processar JSON.", debug: error.message };
  }
};