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

// --- NOVA LÓGICA DE PARSING ROBUSTA ---

/**
 * Procura recursivamente pela maior array dentro de um objeto JSON.
 * Isso resolve problemas onde os dados estão aninhados em estruturas como { response: { result: [ ... ] } }
 */
const findBestDataArray = (obj: any, depth = 0): any[] => {
    if (depth > 4) return []; // Limite de segurança para evitar loops infinitos
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    
    if (typeof obj !== 'object') return [];

    let bestArray: any[] = [];

    // Atalhos para padrões comuns do Google Sheets
    if (Array.isArray(obj.values) && obj.values.length > bestArray.length) bestArray = obj.values;
    if (Array.isArray(obj.data) && obj.data.length > bestArray.length) bestArray = obj.data;
    if (Array.isArray(obj.items) && obj.items.length > bestArray.length) bestArray = obj.items;
    if (Array.isArray(obj.rows) && obj.rows.length > bestArray.length) bestArray = obj.rows;

    // Se achou algo grande logo de cara, retorna
    if (bestArray.length > 0) return bestArray;

    // Busca genérica em todas as chaves
    const keys = Object.keys(obj);
    for (const key of keys) {
        const val = obj[key];
        // Ignora strings gigantes ou nulos
        if (!val || typeof val !== 'object') continue;

        const candidate = findBestDataArray(val, depth + 1);
        if (candidate.length > bestArray.length) {
            bestArray = candidate;
        }
    }
    
    return bestArray;
};

interface LoadResult {
    success: boolean;
    data: Record<string, DayData> | null;
    message: string;
    debug?: string;
}

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
                rawPreview: text.substring(0, 1000)
            };
        }

        // Usa a mesma lógica recursiva para diagnóstico
        const rows = findBestDataArray(json);
        let structureType = "Objeto JSON Genérico";
        let headersDetected = [];

        if (rows.length > 0) {
             structureType = `Array com ${rows.length} itens encontrado.`;
             const firstRow = rows[0];
             
             if (Array.isArray(firstRow)) {
                 structureType += " (Formato Matriz/Planilha)";
                 // Tenta detectar cabeçalhos strings
                 if (firstRow.every(c => typeof c === 'string')) {
                     headersDetected = firstRow;
                 } else {
                     headersDetected = firstRow.map((_, i) => `col_${i}`);
                 }
             } else if (typeof firstRow === 'object') {
                 structureType += " (Formato Lista de Objetos)";
                 headersDetected = Object.keys(firstRow);
             }
        } else {
            structureType = "Nenhuma lista (Array) encontrada no JSON.";
            // Tenta ver se é um objeto único
            if (Object.keys(json).length > 0) {
                 structureType += " (Parece ser um Objeto Único)";
                 headersDetected = Object.keys(json);
            }
        }

        return {
            status: response.status,
            rowCount: rows.length,
            structureType,
            headersDetected,
            firstRowSample: rows.length > 0 ? rows[0] : (Object.keys(json).length > 0 ? json : null),
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
    
    // 1. BUSCA PROFUNDA POR ARRAY DE DADOS
    let potentialRows = findBestDataArray(rawData);

    // Fallback: Se não achou array, mas o objeto raiz tem chaves, pode ser um único registro ou um mapa
    if (potentialRows.length === 0 && rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        // Verifica se parece com um dado (tem data ou tarefas)
        const keys = Object.keys(rawData).map(cleanKey);
        const hasDate = keys.some(k => k.includes('date') || k.includes('data') || k.includes('dia'));
        const hasTask = keys.some(k => INITIAL_TASKS.some(t => fuzzyMatch(k, t.id)));
        
        if (hasDate || hasTask || keys.length > 3) {
            potentialRows = [rawData]; // Trata como uma única linha
        }
    }

    if (!potentialRows.length) {
        return { 
            success: false, 
            data: null, 
            message: "Planilha vazia ou estrutura irreconhecível.",
            debug: `Recebido:\n${JSON.stringify(rawData).substring(0, 300)}...`
        };
    }

    // 2. NORMALIZAÇÃO DE LINHAS (Matriz vs Objetos)
    let processedRows: any[] = [];
    
    if (Array.isArray(potentialRows[0])) {
        // Lógica para Matriz (Planilha crua)
        // Tenta achar linha de cabeçalho
        let headerRowIndex = -1;
        const maxScan = Math.min(potentialRows.length, 5);
        
        for(let i=0; i < maxScan; i++) {
            const row = potentialRows[i];
            if (Array.isArray(row) && row.length > 0) {
                const stringCount = row.filter(c => typeof c === 'string').length;
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
            // Sem cabeçalhos? Cria col_0, col_1...
            const maxCols = Math.max(...potentialRows.map((r: any) => Array.isArray(r) ? r.length : 0));
            for(let c=0; c<maxCols; c++) headers.push(`col_${c}`);
            dataStartIndex = 0;
        }

        processedRows = potentialRows.slice(dataStartIndex).map((row: any) => {
             if (!Array.isArray(row)) return null;
             const obj: any = {};
             headers.forEach((h, i) => {
                 const key = h ? h : `col_${i}`;
                 obj[key] = row[i];
             });
             return obj;
        }).filter(r => r !== null);

    } else {
        // Já são objetos
        processedRows = potentialRows;
    }

    if (processedRows.length === 0) return { success: false, data: null, message: "Nenhum dado válido encontrado após processamento." };

    // 3. DETECÇÃO ROBUSTA DE DATA
    const firstRow = processedRows[0];
    const rowKeys = Object.keys(firstRow);

    // Tenta achar coluna com nome de data
    let dateKey = rowKeys.find(k => {
        const c = cleanKey(k);
        return ['data', 'date', 'dia', 'dt', 'timestamp', 'created', 'when'].some(t => c.includes(t));
    });

    // Fallback 1: Se tiver colunas artificiais (col_0), a primeira (A) geralmente é a data
    if (!dateKey && rowKeys.includes('col_0')) {
        dateKey = 'col_0';
    }
    
    // Fallback 2: Se não achou pelo nome, pega a primeira chave do objeto (JSON preserva ordem de inserção geralmente)
    if (!dateKey && rowKeys.length > 0) {
        dateKey = rowKeys[0];
    }

    if (!dateKey) {
        return { 
            success: false, 
            data: null, 
            message: "Não foi possível identificar a coluna de Data.",
            debug: `Chaves: [${rowKeys.join(', ')}]`
        };
    }

    const normalizedData: Record<string, DayData> = {};
    let processedCount = 0;

    processedRows.forEach((row: any) => {
        const valDate = row[dateKey!];
        let dateStr = '';
        
        // Parsing de Data Genérico
        if (valDate) {
            if (typeof valDate === 'string') {
                // ISO YYYY-MM-DD
                const isoMatch = valDate.match(/\d{4}-\d{2}-\d{2}/);
                if (isoMatch) dateStr = isoMatch[0];
                else {
                    // BR DD/MM/YYYY
                    const brMatch = valDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
                    if (brMatch) {
                        let y = brMatch[3];
                        if (y.length === 2) y = '20' + y;
                        const m = brMatch[2].padStart(2, '0');
                        const d = brMatch[1].padStart(2, '0');
                        dateStr = `${y}-${m}-${d}`;
                    } else {
                        // Try Date constructor
                        const d = new Date(valDate);
                        if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
                    }
                }
            } else if (typeof valDate === 'number') {
                 // Excel Serial
                 if (valDate > 30000) {
                    const d = new Date((valDate - 25569) * 86400 * 1000);
                    dateStr = d.toISOString().split('T')[0];
                 }
            } else if (valDate instanceof Date) {
                dateStr = valDate.toISOString().split('T')[0];
            }
        }

        if (!dateStr) return; 

        const tasksMap: Record<string, boolean> = {};
        const currentRowKeys = Object.keys(row);

        INITIAL_TASKS.forEach(task => {
            // Procura correspondência exata ou fuzzy no nome da coluna
            const matchingKey = currentRowKeys.find(k => fuzzyMatch(k, task.id) || fuzzyMatch(k, task.label));
            
            if (matchingKey) {
                tasksMap[task.id] = normalizeBoolean(row[matchingKey]);
            } else {
                // Se for coluna indexada (col_X), tenta mapear por ordem se as chaves forem artificiais?
                // Por segurança, deixa falso se não achar o nome.
                tasksMap[task.id] = false;
            }
        });

        // Tenta achar pontos
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
        debug: processedCount === 0 ? "Nenhum dia válido encontrado. Verifique o formato das datas na coluna " + dateKey : undefined
    };

  } catch (error: any) {
    return { success: false, data: null, message: "Erro crítico no processamento.", debug: error.message };
  }
};