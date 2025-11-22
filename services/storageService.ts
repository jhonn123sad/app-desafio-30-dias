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
        // Adicionado suporte explícito para Sim/Não
        return ['sim', 's', 'true', 'yes', 'y', 'verdadeiro', '1'].includes(lower);
    }
    return false;
};

const normalizeKey = (key: string): string => {
    return key.toLowerCase().replace(/_/g, '').replace(/\s+/g, '').trim();
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
    console.log("Dados brutos recebidos (amostra):", Array.isArray(rawData) ? rawData.slice(0, 2) : rawData);
    
    if (rawData && rawData.error) {
        console.error("Google Script Error:", rawData.error);
        return null;
    }

    let rows: any[] = [];
    
    // Normalização da estrutura de entrada (Array de Objetos ou Array de Arrays)
    if (Array.isArray(rawData)) {
        // Verifica se é uma matriz 2D (values sem headers) ou lista de objetos
        if (rawData.length > 0 && Array.isArray(rawData[0])) {
            // É uma matriz 2D. A primeira linha são os headers.
            const headers = rawData[0].map((h: any) => String(h));
            const dataRows = rawData.slice(1);
            
            rows = dataRows.map((rowArray: any[]) => {
                const obj: any = {};
                headers.forEach((header: string, index: number) => {
                    obj[header] = rowArray[index];
                });
                return obj;
            });
        } else {
            // Já é lista de objetos
            rows = rawData;
        }
    } else if (typeof rawData === 'object' && rawData !== null) {
         const arrayProp = Object.values(rawData).find(val => Array.isArray(val));
         if (arrayProp) {
             rows = arrayProp as any[];
         } else {
             rows = Object.values(rawData);
         }
    }

    if (rows.length === 0) return {};

    const normalizedData: Record<string, DayData> = {};

    rows.forEach((row: any) => {
        if (!row || typeof row !== 'object') return;

        // Cria um mapa de chaves normalizadas para facilitar a busca
        // Ex: "Pontos Total" -> "pontostotal", "Data" -> "data", "vacum" -> "vacum"
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
        
        try {
            if (rawDate) {
                // Se vier do Excel/Sheets as vezes vem como número serial, mas assumindo string YYYY-MM-DD do print
                if (typeof rawDate === 'string') {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
                        dateKey = rawDate;
                    } else if (rawDate.includes('T')) {
                        dateKey = rawDate.split('T')[0];
                    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
                        const [d, m, y] = rawDate.split('/');
                        dateKey = `${y}-${m}-${d}`; // Converte para ISO
                    } else {
                         // Tenta converter data genérica
                         const d = new Date(rawDate);
                         if (!isNaN(d.getTime())) dateKey = d.toISOString().split('T')[0];
                    }
                }
            }
        } catch (e) {
            console.warn("Erro ao processar data:", rawDate);
        }

        if (!dateKey) return; // Pula linha se não tiver data válida

        // 2. Encontrar Pontos
        // Busca 'pontostotal', 'totalpoints', 'pontos'
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