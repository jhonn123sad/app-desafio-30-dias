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

const cleanKey = (key: string) => key ? key.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, "") : "";

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

// Helper to safely get text from response even if not JSON
const safeGetText = async (response: Response) => {
    try {
        return await response.text();
    } catch (e) {
        return "Erro ao ler corpo da resposta.";
    }
};

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
                error: "O retorno não é um JSON válido.",
                rawPreview: text.substring(0, 1000) // Mostra o HTML ou erro texto
            };
        }

        // Deep search for rows
        let rows: any[] = [];
        let structureType = "Unknown";
        let headersDetected = [];

        if (Array.isArray(json)) {
            rows = json;
            structureType = "Raiz é Array";
        } else if (typeof json === 'object') {
            // Procura a maior array dentro do objeto
            const candidates = Object.entries(json).filter(([k, v]) => Array.isArray(v));
            if (candidates.length > 0) {
                // Pega a array com mais itens ou a primeira
                const bestCandidate = candidates.sort((a: any, b: any) => b[1].length - a[1].length)[0];
                rows = bestCandidate[1] as any[];
                structureType = `Objeto com propriedade '${bestCandidate[0]}'`;
            } else {
                // Fallback: O próprio objeto pode ser um item único?
                rows = [json];
                structureType = "Objeto Único (provavelmente errado)";
            }
        }

        // Check first row
        if (rows.length > 0) {
             const firstRow = rows[0];
             if (Array.isArray(firstRow)) {
                 structureType += " (Array de Arrays)";
                 // Try to find string headers
                 if (firstRow.every(c => typeof c === 'string')) {
                     headersDetected = firstRow;
                 } else {
                     headersDetected = firstRow.map((_, i) => `col_${i}`);
                 }
             } else if (typeof firstRow === 'object') {
                 structureType += " (Array de Objetos)";
                 headersDetected = Object.keys(firstRow);
             }
        }

        return {
            status: response.status,
            rowCount: rows.length,
            structureType,
            headersDetected,
            firstRowSample: rows.length > 0 ? rows[0] : null,
            rawJsonSnippet: JSON.stringify(json, null, 2)
        };
    } catch (error: any) {
        return { error: error.message };
    }
};

export const loadFromGoogleSheets = async (scriptUrl: string): Promise<LoadResult> => {
  if (!scriptUrl) return { success: false, data: null, message: "URL não configurada." };

  try {
    const response = await fetch(scriptUrl);
    const responseText = await response.text();
    
    if (!response.ok) return { success: false, data: null, message: `Erro HTTP: ${response.status}` };

    let rawData;
    try {
        rawData = JSON.parse(responseText);
    } catch (e) {
        return { 
            success: false, 
            data: null, 
            message: "Resposta não é JSON válido.", 
            debug: `Preview da resposta:\n${responseText.substring(0, 200)}...` 
        };
    }
    
    // 1. ROBUST STRUCTURE DETECTION
    // Find the array with data anywhere in the object
    let potentialRows: any[] = [];
    
    if (Array.isArray(rawData)) {
        potentialRows = rawData;
    } else if (rawData && typeof rawData === 'object') {
         // Prioritize common names
         if (Array.isArray(rawData.data)) potentialRows = rawData.data;
         else if (Array.isArray(rawData.values)) potentialRows = rawData.values;
         else if (Array.isArray(rawData.items)) potentialRows = rawData.items;
         else if (Array.isArray(rawData.rows)) potentialRows = rawData.rows;
         else {
             // Brute force: find ANY array property
             const keys = Object.keys(rawData);
             for(const k of keys) {
                 if (Array.isArray(rawData[k])) {
                     potentialRows = rawData[k];
                     break;
                 }
             }
             // If still nothing, maybe rawData itself is the single row object?
             if (potentialRows.length === 0 && Object.keys(rawData).length > 0) {
                 potentialRows = [rawData];
             }
         }
    }

    if (!potentialRows.length) return { success: false, data: null, message: "Planilha vazia ou estrutura irreconhecível." };

    // 2. NORMALIZE ROWS (Array of Arrays vs Array of Objects)
    let processedRows: any[] = [];
    
    // Check if it's a 2D Array (Values only or Headers+Values)
    if (Array.isArray(potentialRows[0])) {
        // Heuristic: Find the header row. It usually contains mostly strings.
        // Check top 5 rows.
        let headerRowIndex = -1;
        const maxScan = Math.min(potentialRows.length, 5);
        
        for(let i=0; i < maxScan; i++) {
            const row = potentialRows[i];
            if (Array.isArray(row) && row.length > 0) {
                const stringCount = row.filter(c => typeof c === 'string').length;
                // If > 80% are strings, assume headers
                if (stringCount / row.length > 0.8) {
                    headerRowIndex = i;
                    break;
                }
            }
        }

        let headers: string[] = [];
        let dataStartIndex = 0;

        if (headerRowIndex !== -1) {
            headers = potentialRows[headerRowIndex].map(String);
            dataStartIndex = headerRowIndex + 1;
        } else {
            // No headers found? Generate artificial ones (col_0, col_1...)
            // We assume the first row IS data then.
            const maxCols = Math.max(...potentialRows.map((r: any) => Array.isArray(r) ? r.length : 0));
            for(let c=0; c<maxCols; c++) headers.push(`col_${c}`);
            dataStartIndex = 0;
        }

        // Process rows into objects
        processedRows = potentialRows.slice(dataStartIndex).map((row: any) => {
             // Skip if row is not an array or empty
             if (!Array.isArray(row)) return null;
             const obj: any = {};
             headers.forEach((h, i) => {
                 // Use 'col_i' if header is empty string
                 const key = h ? h : `col_${i}`;
                 obj[key] = row[i];
             });
             return obj;
        }).filter(r => r !== null);

    } else {
        // Already objects
        processedRows = potentialRows;
    }

    if (processedRows.length === 0) return { success: false, data: null, message: "Nenhum dado válido encontrado após processamento." };

    const firstRow = processedRows[0];
    const rowKeys = Object.keys(firstRow);

    // 3. ROBUST DATE COLUMN DETECTION
    let dateKey = rowKeys.find(k => {
        const c = cleanKey(k);
        return ['data', 'date', 'dia', 'dt', 'timestamp', 'created', 'when'].some(t => c.includes(t));
    });

    // Fallback: Force Index 0 (Column A) if no name match
    if (!dateKey && rowKeys.length > 0) {
        // If user says "Column A is Date", it's likely the first key in the object
        // (Object keys order is generally preserved for JSON)
        dateKey = rowKeys[0];
    }

    if (!dateKey) {
        return { 
            success: false, 
            data: null, 
            message: "Não foi possível identificar a coluna de Data.",
            debug: `Chaves encontradas: [${rowKeys.join(', ')}]`
        };
    }

    const normalizedData: Record<string, DayData> = {};
    let processedCount = 0;

    processedRows.forEach((row: any) => {
        const valDate = row[dateKey!];
        let dateStr = '';
        
        // Generic Date Parsing
        if (valDate) {
            if (typeof valDate === 'string') {
                // Try YYYY-MM-DD
                const isoMatch = valDate.match(/\d{4}-\d{2}-\d{2}/);
                if (isoMatch) dateStr = isoMatch[0];
                else {
                    // Try DD/MM/YYYY
                    const brMatch = valDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
                    if (brMatch) {
                        let y = brMatch[3];
                        if (y.length === 2) y = '20' + y;
                        const m = brMatch[2].padStart(2, '0');
                        const d = brMatch[1].padStart(2, '0');
                        dateStr = `${y}-${m}-${d}`;
                    } else {
                        // Try native parse
                        const d = new Date(valDate);
                        if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
                    }
                }
            } else if (typeof valDate === 'number') {
                 // Excel Serial Date
                 if (valDate > 30000) {
                    const d = new Date((valDate - 25569) * 86400 * 1000);
                    dateStr = d.toISOString().split('T')[0];
                 }
            } else if (valDate instanceof Date) {
                dateStr = valDate.toISOString().split('T')[0];
            }
        }

        if (!dateStr) return; // Skip invalid dates

        const tasksMap: Record<string, boolean> = {};
        const currentRowKeys = Object.keys(row);

        // Map Tasks
        INITIAL_TASKS.forEach(task => {
            // Try to find matching column
            const matchingKey = currentRowKeys.find(k => fuzzyMatch(k, task.id) || fuzzyMatch(k, task.label));
            
            if (matchingKey) {
                tasksMap[task.id] = normalizeBoolean(row[matchingKey]);
            } else {
                // If using artificial keys (col_0, col_1), we can't map by name.
                // But we can leave it false. The User will see tasks unchecked.
                // This is better than failing entirely.
                tasksMap[task.id] = false;
            }
        });

        // Find points (optional)
        const pointKey = currentRowKeys.find(k => cleanKey(k).includes('ponto') || cleanKey(k).includes('total'));
        const points = pointKey ? Number(row[pointKey]) : 0;

        normalizedData[dateStr] = {
            date: dateStr,
            totalPoints: isNaN(points) ? 0 : points,
            tasks: tasksMap
        };
        processedCount++;
    });

    return { 
        success: true, 
        data: normalizedData, 
        message: `${processedCount} dias recuperados com sucesso.`,
        debug: processedCount === 0 ? "Nenhum dia válido processado. Verifique o formato das datas." : undefined
    };

  } catch (error: any) {
    return { success: false, data: null, message: "Erro crítico no processamento.", debug: error.message };
  }
};