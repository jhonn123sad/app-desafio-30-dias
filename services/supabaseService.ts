
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, INITIAL_TASKS } from '../constants';
import { TaskDefinition, DayData, Period } from '../types';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Task Definitions Management ---

export const getUserTaskDefinitions = async (userId: string): Promise<TaskDefinition[]> => {
  const { data, error } = await supabase
    .from('task_definitions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching definitions:', error);
    return [];
  }

  // If no definitions exist (new user), seed with INITIAL_TASKS
  if (!data || data.length === 0) {
    await seedInitialTasks(userId);
    return INITIAL_TASKS.map(t => ({
        id: t.id,
        label: t.label,
        period: t.period,
        points: t.points
    }));
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
  if (error) console.error("Error seeding tasks:", error);
};

export const saveUserTaskDefinitions = async (userId: string, tasks: TaskDefinition[]) => {
  // Strategy: Delete all for user and re-insert (Simple sync)
  // In a production app with huge data, we would diff/update, but for <50 tasks this is fine and robust.
  
  const { error: deleteError } = await supabase
    .from('task_definitions')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    throw new Error("Falha ao limpar tarefas antigas: " + deleteError.message);
  }

  const tasksToInsert = tasks.map(t => ({
    user_id: userId,
    label: t.label,
    period: t.period,
    points: t.points
  }));

  const { error: insertError } = await supabase
    .from('task_definitions')
    .insert(tasksToInsert);

  if (insertError) {
    throw new Error("Falha ao salvar novas tarefas: " + insertError.message);
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
    console.error("Error fetching day:", error);
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
    
  if (error) return {};

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

  if (error) console.error("Error saving progress:", error);
};
