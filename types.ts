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
  // geminiApiKey removido pois a IA foi desativada
  googleSheetScriptUrl: string; // Google Apps Script Web App URL
}