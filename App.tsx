
import React, { useState, useEffect } from 'react';
import { Sun, Sunset, Moon, CheckCircle, Circle, RotateCcw, Calendar, Edit3, Save, Loader2, Cloud, WifiOff, AlertTriangle, Database, Check } from 'lucide-react';
import { Task, Period, DayData, TaskDefinition } from './types';
import { ProgressChart } from './components/Chart';
import { TaskEditor } from './components/TaskEditor';
import { ConfigModal } from './components/ConfigModal';
import { authenticateSilently } from './services/authService';
import { 
  getUserTaskDefinitions, 
  saveUserTaskDefinitions, 
  getMonthHistory,
  saveDayProgress
} from './services/supabaseService';
import { 
  getStoredTaskDefinitions, 
  saveStoredTaskDefinitions, 
  getStoredHistory, 
  saveDayProgress as saveLocalDayProgress 
} from './services/storageService';
import { INITIAL_TASKS } from './constants';

const App: React.FC = () => {
  // Data State
  const [userId, setUserId] = useState<string | null>(null);
  const [taskDefinitions, setTaskDefinitions] = useState<TaskDefinition[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<Record<string, DayData>>({});
  const [currentDate, setCurrentDate] = useState<string>('');
  
  // UI State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isResetDayModalOpen, setIsResetDayModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline' | 'error'>('connected');
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  // 1. Initial Load
  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        
        let activeUserId: string;

        try {
            const user = await authenticateSilently();
            activeUserId = user?.id || 'local_fallback_id';
            setConnectionStatus('connected');
        } catch (authErr: any) {
            console.warn("Auth failed, using offline ID:", authErr.message);
            // If auth fails (e.g. Email Confirmation required), we use a consistent local ID
            // to ensure the app works locally without blocking the user.
            let localId = localStorage.getItem('rt_local_fallback_id');
            if (!localId) {
                localId = 'local_' + Date.now().toString(36);
                localStorage.setItem('rt_local_fallback_id', localId);
            }
            activeUserId = localId;
            setConnectionStatus('offline');
            if (authErr.message === "CONFIRMATION_REQUIRED") {
                setConnectionMessage("Supabase: Confirmação de email necessária para sincronização.");
            } else {
                setConnectionMessage("Sincronização temporariamente indisponível. Seus dados estão salvos neste dispositivo.");
            }
        }

        setUserId(activeUserId);
        const today = new Date().toISOString().split('T')[0];
        setCurrentDate(today);

        // Load Data: Try Supabase first, fallback to LocalStorage if offline/fail
        try {
            // If offline, throw immediately to jump to catch
            if (connectionStatus === 'offline') throw new Error("Offline mode");

            const [defs, hist] = await Promise.all([
                getUserTaskDefinitions(activeUserId),
                getMonthHistory(activeUserId)
            ]);
            
            // If cloud returns empty definitions (but not error), it might be a new user. 
            // Check local storage just in case we have unsynced changes.
            const localDefs = getStoredTaskDefinitions();
            const activeDefs = defs.length > 0 ? defs : (localDefs.length > 0 ? localDefs : INITIAL_TASKS.map(t => ({
                id: t.id,
                label: t.label,
                period: t.period,
                points: t.points
            })));

            setTaskDefinitions(activeDefs);
            setHistory(hist);
            constructDayView(today, activeDefs, hist);
        } catch (dbError: any) {
            console.warn("Cloud load failed, loading from device:", dbError);
            
            // Fallback to LocalStorage
            const localDefs = getStoredTaskDefinitions();
            const localHistory = getStoredHistory(); // Note: getStoredHistory logic in storageService might need activeUserId filtering if multi-user, but usually it's single bucket in localstorage.
            
            const activeDefs = localDefs.length > 0 ? localDefs : INITIAL_TASKS.map(t => ({
                id: t.id,
                label: t.label,
                period: t.period,
                points: t.points
            }));
            
            setTaskDefinitions(activeDefs);
            setHistory(localHistory);
            constructDayView(today, activeDefs, localHistory);
        }

      } catch (err: any) {
        console.error("Critical Init Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [connectionStatus]); // Re-run if status changes logic slightly, though mainly relies on internal flow

  const constructDayView = (date: string, definitions: TaskDefinition[], currentHistory: Record<string, DayData>) => {
    const dayData = currentHistory[date];
    const constructedTasks: Task[] = definitions.map(def => ({
        id: def.id,
        label: def.label,
        period: def.period,
        points: def.points,
        completed: dayData ? !!dayData.tasks[def.id] : false
    }));
    setTasks(constructedTasks);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setCurrentDate(newDate);
    constructDayView(newDate, taskDefinitions, history);
  };

  const handleToggleTask = async (taskId: string) => {
    if (!userId) return;

    // Optimistic Update
    const newTasks = tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    setTasks(newTasks);
    
    const newTotalPoints = newTasks.reduce((acc, t) => t.completed ? acc + t.points : acc, 0);
    const taskMap = newTasks.reduce((acc, t) => ({ ...acc, [t.id]: t.completed }), {});
    
    const dayData: DayData = {
        date: currentDate,
        totalPoints: newTotalPoints,
        tasks: taskMap
    };

    const newHistory = { ...history, [currentDate]: dayData };
    setHistory(newHistory);
    
    // Always Save Locally first
    saveLocalDayProgress(dayData);

    // Save to backend if connected
    if (connectionStatus === 'connected') {
        setIsSyncing(true);
        try {
            await saveDayProgress(userId, dayData);
        } catch (error) {
            console.error("Sync error:", error);
            setConnectionStatus('error');
        } finally {
            setIsSyncing(false);
        }
    }
  };

  const handleManualSave = async () => {
    if (!userId) return;
    setIsSyncing(true);
    try {
        const currentDayData = history[currentDate] || { 
            date: currentDate, 
            totalPoints: tasks.reduce((acc, t) => t.completed ? acc + t.points : acc, 0),
            tasks: tasks.reduce((acc, t) => ({ ...acc, [t.id]: t.completed }), {})
        };
        
        saveLocalDayProgress(currentDayData);
        
        if (connectionStatus === 'connected') {
            await saveDayProgress(userId, currentDayData);
            const hist = await getMonthHistory(userId);
            setHistory(hist);
            alert("Dados sincronizados com a nuvem!");
        } else {
             alert("Dados salvos no dispositivo (Offline).");
        }
    } catch (error) {
        alert("Erro ao salvar: Verifique sua conexão.");
        setConnectionStatus('error');
    } finally {
        setIsSyncing(false);
    }
  };

  const handleSaveDefinitions = async (newDefinitions: TaskDefinition[]) => {
    if (!userId) return;
    
    // 1. Update State
    setTaskDefinitions(newDefinitions);
    constructDayView(currentDate, newDefinitions, history);
    setIsEditorOpen(false);

    // 2. Save Locally (Always safe)
    saveStoredTaskDefinitions(newDefinitions);

    // 3. Try Cloud Sync
    if (connectionStatus === 'connected') {
        setIsSyncing(true);
        try {
            await saveUserTaskDefinitions(userId, newDefinitions);
        } catch (error: any) {
            alert("Aviso: As alterações foram salvas neste dispositivo, mas houve um erro ao sincronizar com a nuvem.");
            setConnectionStatus('error');
        } finally {
            setIsSyncing(false);
        }
    }
  };

  const confirmResetCurrentDay = async () => {
    if (!userId) return;
    setIsResetDayModalOpen(false);
    
    const resetTasks = tasks.map(t => ({ ...t, completed: false }));
    setTasks(resetTasks);
    
    const dayData: DayData = {
        date: currentDate,
        totalPoints: 0,
        tasks: {}
    };

    setHistory({ ...history, [currentDate]: dayData });
    saveLocalDayProgress(dayData);
    
    if (connectionStatus === 'connected') {
        setIsSyncing(true);
        try {
            await saveDayProgress(userId, dayData);
        } catch(e) { console.error(e); }
        setIsSyncing(false);
    }
  };

  const handleFullReset = async () => {
    localStorage.clear();
    window.location.reload();
  };

  // Derived State
  const maxPoints = tasks.reduce((acc, t) => acc + t.points, 0);
  const totalPoints = tasks.reduce((acc, t) => t.completed ? acc + t.points : acc, 0);
  const progressPercentage = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;
  const getTasksByPeriod = (period: Period) => tasks.filter(t => t.period === period);

  if (isLoading) {
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-4">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 pb-20 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col gap-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 p-2 rounded-full border border-emerald-500/20">
                    <span className="font-bold text-emerald-500 text-xl">RT</span>
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-white">Routine Tracker</h1>
                    <div className="flex items-center gap-2 text-xs font-mono mt-1">
                        {/* Status Indicator */}
                        <div className={`w-2 h-2 rounded-full ${
                            connectionStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                            connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                        }`} />
                        <span className="text-slate-500">
                            {isSyncing ? 'Sincronizando...' : connectionStatus === 'connected' ? 'Online' : 'Armazenamento Local'}
                        </span>
                        {connectionMessage && (
                            <div className="group relative ml-1">
                                <AlertTriangle className="w-3 h-3 text-slate-600 cursor-help" />
                                <div className="absolute left-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 p-2 rounded text-[10px] text-slate-300 shadow-xl hidden group-hover:block z-50">
                                    {connectionMessage}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <button 
                onClick={handleManualSave}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            >
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                <span className="hidden sm:inline">Salvar</span>
            </button>
          </div>

          <div className="flex justify-between items-end flex-wrap gap-4">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Data</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 w-fit shadow-sm">
                    <Calendar className="w-4 h-4 text-emerald-500 ml-1" />
                    <input 
                        type="date" 
                        value={currentDate}
                        onChange={handleDateChange}
                        className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none font-mono"
                    />
                </div>
            </div>

            <div className="flex gap-2">
                <button 
                  onClick={() => setIsResetDayModalOpen(true)}
                  className="p-2.5 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-400 rounded-lg border border-slate-700 transition-colors"
                  title="Resetar dia"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsEditorOpen(true)}
                  className="px-4 py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-600/20 rounded-lg transition-colors flex items-center gap-2 font-semibold text-sm"
                >
                  <Edit3 className="w-4 h-4" /> Tarefas
                </button>
            </div>
          </div>
        </header>

        {/* Main Score Card */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-700">
            <div 
            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
            />
        </div>
        <div className="flex items-end justify-between mt-2 relative z-10">
            <div>
            <span className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Pontuação Diária</span>
            <div className="text-5xl font-bold text-white tracking-tighter flex items-baseline gap-2">
                {totalPoints} <span className="text-2xl text-slate-600 font-normal">/ {maxPoints}</span>
            </div>
            </div>
            <div className="text-right">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                progressPercentage >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                progressPercentage >= 50 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
                {progressPercentage >= 80 ? 'Excelente' : progressPercentage >= 50 ? 'Regular' : 'Baixo'}
            </div>
            </div>
        </div>
        </div>

        {/* Chart */}
        <ProgressChart history={history} />

        {/* Task Sections */}
        <div className="grid gap-6">
            <TaskSection 
                title="Manhã" 
                icon={<Sun className="w-5 h-5 text-blue-400" />} 
                colorClass="blue"
                tasks={getTasksByPeriod(Period.MORNING)}
                onToggle={handleToggleTask}
            />

            <TaskSection 
                title="Tarde" 
                icon={<Sunset className="w-5 h-5 text-orange-400" />} 
                colorClass="orange"
                tasks={getTasksByPeriod(Period.AFTERNOON)}
                onToggle={handleToggleTask}
            />

            <TaskSection 
                title="Noite" 
                icon={<Moon className="w-5 h-5 text-indigo-400" />} 
                colorClass="indigo"
                tasks={getTasksByPeriod(Period.NIGHT)}
                onToggle={handleToggleTask}
            />
        </div>

      </div>

      {/* Modals */}
      {isResetDayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-md border border-slate-700 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-2">Resetar dia?</h3>
            <p className="text-slate-400 text-sm mb-6">
              Isso desmarcará todas as tarefas de <strong>hoje</strong>.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setIsResetDayModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmResetCurrentDay}
                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 font-semibold transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskEditor 
        isOpen={isEditorOpen} 
        onClose={() => setIsEditorOpen(false)}
        currentTasks={taskDefinitions}
        onSave={handleSaveDefinitions}
      />

      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onResetAll={handleFullReset}
      />
    </div>
  );
};

// Helper Components
const TaskSection: React.FC<{ title: string, icon: React.ReactNode, colorClass: string, tasks: Task[], onToggle: (id: string) => void }> = ({ title, icon, tasks, onToggle, colorClass }) => {
    if (tasks.length === 0) return null;

    const colors: any = {
        blue: "text-blue-100",
        orange: "text-orange-100",
        indigo: "text-indigo-100"
    };

    return (
        <section className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center gap-3">
              <div className={`p-2 bg-${colorClass}-500/10 rounded-lg`}>
                {icon}
              </div>
              <h2 className={`font-semibold text-lg ${colors[colorClass]}`}>{title}</h2>
            </div>
            <div className="p-4 grid gap-3 sm:grid-cols-2">
              {tasks.map(task => (
                <TaskItem key={task.id} task={task} onToggle={onToggle} />
              ))}
            </div>
        </section>
    );
};

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
        <div className="flex flex-col">
            <span className={`font-medium transition-all ${task.completed ? 'text-emerald-100 line-through decoration-emerald-500/50' : 'text-slate-300'}`}>
            {task.label}
            </span>
        </div>
      </div>
      <span className={`text-xs font-bold font-mono px-2 py-1 rounded ${task.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
        {task.points} pts
      </span>
    </div>
  );
};

export default App;
