import React, { useState, useEffect } from 'react';
import { Sun, Sunset, Moon, CheckCircle, Circle, Zap, Loader2, Save, RotateCcw, Calendar, CloudCheck, Cloud } from 'lucide-react';
import { Task, Period, DayData } from './types';
import { INITIAL_TASKS, TOTAL_POSSIBLE_POINTS } from './constants';
import { getStoredData, saveStoredData, syncWithCloud, loadFromCloud } from './services/storageService';
import { ProgressChart } from './components/Chart';
import { ConfigModal } from './components/ConfigModal';

const App: React.FC = () => {
  // State
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [history, setHistory] = useState<Record<string, DayData>>({});
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Initialize & Auto-Sync
  useEffect(() => {
    const init = async () => {
      const today = new Date().toISOString().split('T')[0];
      setCurrentDate(today);
      
      // 1. Load Local Data immediately for speed
      const storedHistory = getStoredData();
      setHistory(storedHistory);
      
      // Initial render with local data
      loadTasksForDate(today, storedHistory);

      // 2. Fetch from Cloud in background
      try {
        const result = await loadFromCloud();
        
        if (result.success && result.data) {
          // Merge: Cloud data overwrites local if there's a conflict
          const mergedHistory = { ...storedHistory, ...result.data };
          setHistory(mergedHistory);
          saveStoredData(mergedHistory);
          
          // Update view again with cloud data
          loadTasksForDate(today, mergedHistory);
        }
      } catch (e) {
        console.error("Auto-sync failed", e);
      } finally {
        setIsInitialLoading(false);
      }
    };

    init();
  }, []);

  const loadTasksForDate = (date: string, currentHistory: Record<string, DayData>) => {
    if (currentHistory[date]) {
      const dayData = currentHistory[date];
      setTasks(prev => prev.map(t => ({
        ...t,
        completed: dayData.tasks[t.id] || false
      })));
    } else {
      // Reset tasks if no data for this date
      setTasks(INITIAL_TASKS.map(t => ({ ...t, completed: false })));
    }
  };

  // Calculate points
  const completedCount = tasks.filter(t => t.completed).length;
  const totalPoints = tasks.reduce((acc, t) => t.completed ? acc + t.points : acc, 0);
  const progressPercentage = (totalPoints / TOTAL_POSSIBLE_POINTS) * 100;

  // Handlers
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setCurrentDate(newDate);
    loadTasksForDate(newDate, history);
  };

  const handleToggleTask = (taskId: string) => {
    const newTasks = tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    setTasks(newTasks);
    
    // Update History immediately for local storage
    const newTotalPoints = newTasks.reduce((acc, t) => t.completed ? acc + t.points : acc, 0);
    const taskMap = newTasks.reduce((acc, t) => ({ ...acc, [t.id]: t.completed }), {});
    
    const newHistory = {
      ...history,
      [currentDate]: {
        date: currentDate,
        totalPoints: newTotalPoints,
        tasks: taskMap
      }
    };
    
    setHistory(newHistory);
    saveStoredData(newHistory);
  };

  const handleResetDay = async () => {
    if (confirm('Tem certeza que deseja resetar os dados deste dia?')) {
      setIsSyncing(true); // Show saving spinner during reset
      
      // 1. Reset State
      const resetTasks = tasks.map(t => ({ ...t, completed: false }));
      setTasks(resetTasks);
      
      // 2. Prepare Empty Data
      const emptyDayData: DayData = {
          date: currentDate,
          totalPoints: 0,
          tasks: resetTasks.reduce((acc, t) => ({ ...acc, [t.id]: false }), {})
      };

      // 3. Update Local
      const newHistory = {
        ...history,
        [currentDate]: emptyDayData
      };
      setHistory(newHistory);
      saveStoredData(newHistory);

      // 4. Force Sync to Cloud (Critical Fix)
      // We must tell Supabase that this day is now empty, otherwise auto-sync will bring back old data
      await syncWithCloud(emptyDayData);
      
      setIsSyncing(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    const todayData: DayData = {
      date: currentDate,
      totalPoints,
      tasks: tasks.reduce((acc, t) => ({ ...acc, [t.id]: t.completed }), {})
    };
    
    const success = await syncWithCloud(todayData);
    
    setIsSyncing(false);

    if (success) {
        // Subtle feedback
    } else {
        alert("Erro na sincronização. Verifique sua conexão.");
    }
  };

  // Helper to filter tasks
  const getTasksByPeriod = (period: Period) => tasks.filter(t => t.period === period);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 pb-20 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-white">Desafio 30 Dias</h1>
              {/* Cloud Status Indicator */}
              <div className="mt-1" title={isInitialLoading ? "Baixando dados..." : "Sincronizado"}>
                 {isInitialLoading ? (
                    <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                 ) : (
                    <CloudCheck className="w-5 h-5 text-emerald-500/50" />
                 )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2 bg-slate-800 p-1.5 rounded-lg border border-slate-700 w-fit">
              <Calendar className="w-4 h-4 text-slate-400 ml-1" />
              <input 
                type="date" 
                value={currentDate}
                onChange={handleDateChange}
                className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none font-mono"
              />
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            
            <button 
                onClick={handleSync}
                disabled={isSyncing}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Salvar no Supabase"
            >
                {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {isSyncing ? 'Salvando...' : 'Salvar'}
            </button>
            <button 
              onClick={handleResetDay}
              className="p-2.5 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-400 rounded-lg border border-slate-700 transition-colors"
              title="Resetar Dia Atual"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsConfigOpen(true)}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            >
              <Zap className="w-5 h-5 text-yellow-400" />
            </button>
          </div>
        </header>

        {/* Main Score Card */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-800 border border-slate-700 rounded-2xl p-6 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-700">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex items-end justify-between mt-2">
            <div>
              <span className="block text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Pontuação ({currentDate.split('-').reverse().join('/')})</span>
              <div className="text-5xl font-bold text-white tracking-tighter">
                {totalPoints} <span className="text-2xl text-slate-500 font-normal">/ {TOTAL_POSSIBLE_POINTS}</span>
              </div>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                progressPercentage >= 80 ? 'bg-emerald-500/20 text-emerald-400' : 
                progressPercentage >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 
                'bg-red-500/20 text-red-400'
              }`}>
                {progressPercentage >= 80 ? 'Excelente' : progressPercentage >= 50 ? 'Moderado' : 'Baixo'}
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <ProgressChart history={history} />

        {/* Task Sections */}
        <div className="grid gap-6">
          {/* Morning */}
          <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Sun className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="font-semibold text-lg text-blue-100">Manhã</h2>
            </div>
            <div className="p-4 grid gap-3 sm:grid-cols-2">
              {getTasksByPeriod(Period.MORNING).map(task => (
                <TaskItem key={task.id} task={task} onToggle={handleToggleTask} />
              ))}
            </div>
          </section>

          {/* Afternoon */}
          <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Sunset className="w-5 h-5 text-orange-400" />
              </div>
              <h2 className="font-semibold text-lg text-orange-100">Tarde</h2>
            </div>
            <div className="p-4 grid gap-3 sm:grid-cols-2">
              {getTasksByPeriod(Period.AFTERNOON).map(task => (
                <TaskItem key={task.id} task={task} onToggle={handleToggleTask} />
              ))}
            </div>
          </section>

          {/* Night */}
          <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Moon className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 className="font-semibold text-lg text-indigo-100">Noite (18h+)</h2>
            </div>
            <div className="p-4 grid gap-3 sm:grid-cols-2">
              {getTasksByPeriod(Period.NIGHT).map(task => (
                <TaskItem key={task.id} task={task} onToggle={handleToggleTask} />
              ))}
            </div>
          </section>
        </div>
      </div>

      <ConfigModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
      />
    </div>
  );
};

// Sub-component for list items to keep App clean
const TaskItem: React.FC<{ task: Task; onToggle: (id: string) => void }> = ({ task, onToggle }) => {
  return (
    <div 
      onClick={() => onToggle(task.id)}
      className={`
        group flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all duration-200 select-none
        ${task.completed 
          ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20' 
          : 'bg-slate-800 border-slate-700 hover:bg-slate-750 hover:border-slate-600'}
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`transition-colors ${task.completed ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
          {task.completed ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
        </div>
        <span className={`font-medium ${task.completed ? 'text-emerald-100 line-through decoration-emerald-500/50' : 'text-slate-300'}`}>
          {task.label}
        </span>
      </div>
      {task.completed && <span className="text-xs font-bold text-emerald-400">+{task.points}</span>}
    </div>
  );
};

export default App;