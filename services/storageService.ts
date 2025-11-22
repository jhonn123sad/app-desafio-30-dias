import { DayData } from '../types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';
import { createClient } from '@supabase/supabase-js';

const DATA_KEY = 'routine_tracker_data';
const CONFIG_KEY = 'routine_tracker_config';

// Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Local Storage (Backup & Offline) ---

export const getStoredData = (): Record<string, DayData> => {
  const stored = localStorage.getItem(DATA_KEY);
  return stored ? JSON.parse(stored) : {};
};

export const saveStoredData = (data: Record<string, DayData>) => {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
};

// --- Supabase Integration ---

interface CloudResult {
    success: boolean;
    data?: Record<string, DayData>;
    message?: string;
    error?: any;
}

/**
 * Salva (Upsert) um único dia no Supabase
 */
export const syncWithCloud = async (data: DayData): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('daily_logs')
      .upsert({ 
        date: data.date, 
        total_points: data.totalPoints, 
        tasks: data.tasks 
      }, { onConflict: 'date' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Supabase Sync failed:", error);
    return false;
  }
};

/**
 * Carrega todo o histórico do Supabase
 */
export const loadFromCloud = async (): Promise<CloudResult> => {
  try {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*');

    if (error) throw error;

    if (!data || data.length === 0) {
        return { success: true, data: {}, message: "Nenhum dado encontrado no banco de dados." };
    }

    const normalizedData: Record<string, DayData> = {};
    
    data.forEach((row: any) => {
        // Supabase returns straight data, no parsing needed
        normalizedData[row.date] = {
            date: row.date,
            totalPoints: Number(row.total_points),
            tasks: row.tasks // JSONB column comes as Object automatically
        };
    });

    return { 
        success: true, 
        data: normalizedData, 
        message: `${data.length} dias recuperados do Supabase.` 
    };

  } catch (error: any) {
    return { success: false, message: "Erro ao conectar com Supabase", error: error.message };
  }
};