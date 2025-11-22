import { Period, Task } from './types';

// Supabase Configuration
export const SUPABASE_URL = 'https://bnpvmjehsvvesijsdgiu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucHZtamVoc3Z2ZXNpanNkZ2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4Mjk4OTksImV4cCI6MjA3OTQwNTg5OX0.BB-fkAqyq_cmdFA77YRl3v-lbcLX0t9Ww5_bBWml5cg';

export const INITIAL_TASKS: Task[] = [
  // Manhã
  { id: 'vacum', label: 'Vacum', period: Period.MORNING, completed: false, points: 1 },
  { id: 'corrida', label: 'Corrida', period: Period.MORNING, completed: false, points: 1 },
  { id: 'minoxidil_1', label: 'Minoxidil 1', period: Period.MORNING, completed: false, points: 1 },
  { id: 'leitura', label: 'Leitura', period: Period.MORNING, completed: false, points: 1 },
  { id: 'kegel_alongamento', label: 'Kegel e Alongamento', period: Period.MORNING, completed: false, points: 1 },
  { id: 'arrumar_ambiente', label: 'Arrumar Ambiente', period: Period.MORNING, completed: false, points: 1 },

  // Tarde
  { id: 'prospectar_100', label: 'Prospectar 100', period: Period.AFTERNOON, completed: false, points: 1 },
  { id: 'postar_3_videos', label: 'Postar 3 vídeos', period: Period.AFTERNOON, completed: false, points: 1 },
  { id: 'minoxidil_2', label: 'Minoxidil 2', period: Period.AFTERNOON, completed: false, points: 1 },
  { id: 'ultima_refeicao', label: 'Última Refeição', period: Period.AFTERNOON, completed: false, points: 1 },

  // Noite (18h)
  { id: 'cicino', label: 'Rícino', period: Period.NIGHT, completed: false, points: 1 },
  { id: 'academia', label: 'Academia', period: Period.NIGHT, completed: false, points: 1 },
  { id: 'escrever_finalizar', label: 'Escrever / Finalizar dia', period: Period.NIGHT, completed: false, points: 1 },
];

export const TOTAL_POSSIBLE_POINTS = INITIAL_TASKS.reduce((acc, task) => acc + task.points, 0);