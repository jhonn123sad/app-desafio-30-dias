export enum Period {
  MORNING = 'Manhã',
  AFTERNOON = 'Tarde',
  NIGHT = 'Noite',
}

export interface Task {
  id: string;
  label: string;
  period: Period;
  completed: boolean;
  points: number;
}

export interface DayData {
  date: string; // YYYY-MM-DD
  totalPoints: number;
  tasks: Record<string, boolean>; // taskId -> completed
}

export interface AppConfig {
  supabaseUrl: string;
}

export interface User {
  id: string;
  email: string;
}

export interface TaskDefinition {
  id: string;
  label: string;
  period: Period;
  points: number;
}