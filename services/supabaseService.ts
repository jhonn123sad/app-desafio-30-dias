
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, INITIAL_TASKS } from '../constants';
import { TaskDefinition, DayData, Period } from '../types';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Task Definitions Management ---

export const getUserTaskDefinitions = async (userId: string): Promise<TaskDefinition[]> => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('task_definitions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Supabase Error fetching definitions:', JSON.stringify(error, null, 2));
    return []; 
  }

  // If no definitions exist (new user), seed with INITIAL_TASKS
  if (!data || data.length === 0) {
    try {
        await seedInitialTasks(userId);
        // FETCH AGAIN to get the generated UUIDs! 
        // Returning INITIAL_TASKS directly causes ID mismatch between Frontend (static IDs) and Backend (UUIDs).
        return getUserTaskDefinitions(userId);
    } catch (e) {
        console.warn("Seeding failed (likely RLS or offline), using memory defaults.", e);
        // Only fallback to static IDs if DB is absolutely unreachable
        return INITIAL_TASKS.map(t => ({
          id: t.id,
          label: t.label,
          period: t.period,
          points: t.points
      }));
    }
  }

  return data.map((d: any) => ({
    id: d.id, // Supabase UUID
    label: d.label,
    period: d.period as Period,
    points: d.points
  }));
};

const seedInitialTasks = async (userId: string) => {
  const tasksToInsert = INITIAL_TASKS.map(t => ({
    user_id: userId,
    label: t.label,
    period: t.period,
    points: t.points
  }));

  const { error } = await supabase.from('task_definitions').insert(tasksToInsert);
  if (error) throw error;
};

export const saveUserTaskDefinitions = async (userId: string, tasks: TaskDefinition[]) => {
  // 1. Delete all existing definitions for this user
  // We use this "Delete All + Insert All" strategy for simplicity, 
  // BUT we must re-insert with the SAME IDs to preserve history.
  const { error: deleteError } = await supabase
    .from('task_definitions')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    console.error("Error clearing old tasks:", JSON.stringify(deleteError));
    throw new Error("Falha na sincronização (Delete).");
  }

  // 2. Prepare tasks for insertion, preserving IDs
  const tasksToInsert = tasks.map(t => {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id);
    return {
      user_id: userId,
      // If it's a valid UUID, send it to preserve identity. 
      // If it's a legacy ID or temp ID that isn't a UUID, let Supabase gen a new one (history might be lost for that specific task).
      id: isUUID ? t.id : undefined, 
      label: t.label,
      period: t.period,
      points: t.points
    };
  });

  const { error: insertError } = await supabase
    .from('task_definitions')
    .insert(tasksToInsert);

  if (insertError) {
    console.error("Error inserting new tasks:", JSON.stringify(insertError));
    throw new Error("Falha na sincronização (Insert).");
  }
};

// --- Daily Progress Management ---

export const getDayProgress = async (userId: string, date: string): Promise<DayData | null> => {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
    console.warn("Error fetching day:", JSON.stringify(error));
  }

  if (!data) return null;

  // Convert array of completed IDs to Record<string, boolean>
  const tasksMap: Record<string, boolean> = {};
  if (data.completed_tasks) {
      data.completed_tasks.forEach((id: string) => {
          tasksMap[id] = true;
      });
  }

  return {
    date: data.date,
    totalPoints: data.total_points,
    tasks: tasksMap
  };
};

export const getMonthHistory = async (userId: string): Promise<Record<string, DayData>> => {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId);
    
  if (error) {
    console.warn("Error fetching history:", JSON.stringify(error));
    return {};
  }

  const history: Record<string, DayData> = {};
  data.forEach((row: any) => {
      const tasksMap: Record<string, boolean> = {};
      row.completed_tasks?.forEach((id: string) => tasksMap[id] = true);
      
      history[row.date] = {
          date: row.date,
          totalPoints: row.total_points,
          tasks: tasksMap
      };
  });

  return history;
};

export const saveDayProgress = async (userId: string, dayData: DayData) => {
  // Convert tasks map back to array of IDs for storage
  const completedTaskIds = Object.entries(dayData.tasks)
    .filter(([_, completed]) => completed)
    .map(([id, _]) => id);

  const { error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      date: dayData.date,
      completed_tasks: completedTaskIds,
      total_points: dayData.totalPoints,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, date' });

  if (error) {
      console.error("Error saving progress:", JSON.stringify(error));
      throw error;
  }
};
