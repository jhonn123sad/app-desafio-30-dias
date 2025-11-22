import { Period, Task } from './types';

export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzV_m_V4PqG61CoyihemSpIkDJn5tbY4hjeSSs4sSNG_7OFU6AMyeqYBggWYGwl3-i_MA/exec';

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
  { id: 'cicino', label: 'Cícino', period: Period.NIGHT, completed: false, points: 1 },
  { id: 'academia', label: 'Academia', period: Period.NIGHT, completed: false, points: 1 },
  { id: 'escrever_finalizar', label: 'Escrever / Finalizar dia', period: Period.NIGHT, completed: false, points: 1 },
];

export const TOTAL_POSSIBLE_POINTS = INITIAL_TASKS.reduce((acc, task) => acc + task.points, 0);