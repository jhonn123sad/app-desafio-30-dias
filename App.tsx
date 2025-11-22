import React, { useState, useEffect } from 'react';
import { Sun, Sunset, Moon, CheckCircle, Circle, Zap, Loader2, Save, RotateCcw, Calendar, DownloadCloud } from 'lucide-react';
import { Task, Period, DayData } from './types';
import { INITIAL_TASKS, TOTAL_POSSIBLE_POINTS, GOOGLE_SCRIPT_URL } from './constants';
import { getStoredData, saveStoredData, syncWithGoogleSheets, loadFromGoogleSheets } from './services/storageService';
import { ProgressChart } from './components/Chart';
import { ConfigModal } from './components/ConfigModal';

const App: React.FC = () => {
  // State
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [history, setHistory] = useState<Record<string, DayData>>({});
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  // Initialize
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setCurrentDate(today);
    
    const storedHistory = getStoredData();
    setHistory(storedHistory);

    loadTasksForDate(today, storedHistory);
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

  const handleResetDay = () => {
    if (confirm('Tem certeza que deseja resetar os dados deste dia?')) {
      const resetTasks = tasks.map(t => ({ ...t, completed: false }));
      setTasks(resetTasks);
      
      // Remove from history or update to 0
      const newHistory = {
        ...history,
        [currentDate]: {
          date: currentDate,
          totalPoints: 0,
          tasks: resetTasks.reduce((acc, t) => ({ ...acc, [t.id]: false }), {})
        }
      };
      setHistory(newHistory);
      saveStoredData(newHistory);
    }
  };

  const handleSync = async () => {
    if (!GOOGLE_SCRIPT_URL) {
      setIsConfigOpen(true);
      return;
    }
    
    setIsSyncing(true);
    const todayData: DayData = {
      date: currentDate,
      totalPoints,
      tasks: tasks.reduce((acc, t) => ({ ...acc, [t.id]: t.completed }), {})
    };
    
    const success = await syncWithGoogleSheets(todayData, GOOGLE_SCRIPT_URL);
    
    setIsSyncing(false);

    if (success) {
        alert(`Dados do dia ${currentDate.split('-').reverse().join('/')} salvos na nuvem!`);
    } else {
        alert("Erro na sincronização com a planilha. Verifique sua conexão.");
    }
  };

  const handleDownloadCloud = async () => {
    if (!GOOGLE_SCRIPT_URL) {
        setIsConfigOpen(true);
        return;
    }

    if (!confirm("Isso irá buscar o histórico da planilha. Dados locais de dias conflitantes serão substituídos. Continuar?")) {
        return;
    }

    setIsLoadingCloud(true);
    const cloudData = await loadFromGoogleSheets(GOOGLE_SCRIPT_URL);
    setIsLoadingCloud(false);

    if (cloudData && Object.keys(cloudData).length > 0) {
        // Merge cloud data with local history (Cloud wins conflicts)
        const mergedHistory = { ...history, ...cloudData };
        setHistory(mergedHistory);
        saveStoredData(mergedHistory);
        
        // Refresh current view if the current date was affected
        loadTasksForDate(currentDate, mergedHistory);
        
        const daysCount = Object.keys(cloudData).length;
        alert(`Sucesso! ${daysCount} dias foram recuperados da planilha.`);
    } else {
        // Se retornou null ou vazio
        if (cloudData === null) {
             alert("Erro de conexão com o Google Sheets. Verifique se o link do script está correto.");
        } else {
             alert("Conexão bem sucedida, mas o sistema não conseguiu ler as colunas da planilha.\n\nCertifique-se que a primeira coluna se chama 'Data' e que as outras colunas têm os nomes exatos das tarefas (ex: 'vacum', 'leitura', etc) ou verifique se há dados preenchidos.");
        }
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
            <h1 className="text-3xl font-bold tracking-tight text-white">Desafio 30 Dias</h1>
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
                onClick={handleDownloadCloud}
                disabled={isLoadingCloud}
                className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-all border border-slate-600 disabled:opacity-50"
                title="Baixar histórico da Nuvem"
            >
                 {isLoadingCloud ? <Loader2 className="w-5 h-5 animate-spin" /> : <DownloadCloud className="w-5 h-5" />}
                 <span className="hidden md:inline">Restaurar</span>
            </button>

            <button 
                onClick={handleSync}
                disabled={isSyncing}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Salvar na Nuvem"
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