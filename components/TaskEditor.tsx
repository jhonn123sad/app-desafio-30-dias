
import React, { useState } from 'react';
import { Plus, Trash2, X, Check, Save, Loader2, AlertTriangle } from 'lucide-react';
import { TaskDefinition, Period } from '../types';

interface TaskEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentTasks: TaskDefinition[];
  onSave: (tasks: TaskDefinition[]) => Promise<void>;
}

export const TaskEditor: React.FC<TaskEditorProps> = ({ isOpen, onClose, currentTasks, onSave }) => {
  const [tasks, setTasks] = useState<TaskDefinition[]>(currentTasks);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPoints, setNewTaskPoints] = useState(1);
  const [newTaskPeriod, setNewTaskPeriod] = useState<Period>(Period.MORNING);
  const [isSaving, setIsSaving] = useState(false);

  // Sync internal state when prop changes (if modal opens)
  React.useEffect(() => {
    if (isOpen) {
        setTasks(currentTasks);
    }
  }, [isOpen, currentTasks]);

  if (!isOpen) return null;

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    // Use a temp ID for UI, will be replaced by DB UUID on reload or handled by backend
    // For now, simple random string is enough for UI key
    const newTask: TaskDefinition = {
      id: `new_${Date.now()}`, 
      label: newTaskName,
      period: newTaskPeriod,
      points: newTaskPoints
    };

    setTasks([...tasks, newTask]);
    setNewTaskName('');
    setNewTaskPoints(1);
  };

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleSaveWrapper = async () => {
    setIsSaving(true);
    try {
        await onSave(tasks);
        onClose();
    } catch (e) {
        alert("Erro ao salvar: " + e);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 rounded-xl w-full max-w-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Gerenciar Tarefas
                <span className="text-xs font-normal text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">Modo Edição</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">Adicione ou remova tarefas da sua rotina padrão.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Add New Task Form */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-8 shadow-lg">
            <h3 className="text-sm font-bold text-emerald-400 uppercase mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nova Tarefa
            </h3>
            <form onSubmit={handleAddTask} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome da Tarefa</label>
                <input 
                  type="text" 
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-slate-700"
                  placeholder="Ex: Leitura Matinal"
                />
              </div>
              
              <div className="w-full md:w-36">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Período</label>
                <select 
                  value={newTaskPeriod}
                  onChange={(e) => setNewTaskPeriod(e.target.value as Period)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  <option value={Period.MORNING}>Manhã</option>
                  <option value={Period.AFTERNOON}>Tarde</option>
                  <option value={Period.NIGHT}>Noite</option>
                </select>
              </div>

              <div className="w-full md:w-28">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pontos (1-3)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="3"
                  value={newTaskPoints}
                  onChange={(e) => setNewTaskPoints(Math.min(3, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <button 
                type="submit"
                disabled={!newTaskName.trim()}
                className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2.5 rounded-lg transition-colors flex items-center justify-center shadow-lg shadow-emerald-900/20"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>
          </div>

          {/* Warning */}
          <div className="mb-6 flex items-start gap-3 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg">
             <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
             <p className="text-xs text-slate-400">
                Alterações aqui modificam sua <strong>rotina padrão</strong>. Dias passados não serão alterados, mas dias futuros usarão esta nova estrutura.
             </p>
          </div>

          {/* Task Lists */}
          <div className="space-y-8">
            {[Period.MORNING, Period.AFTERNOON, Period.NIGHT].map(period => {
              const periodTasks = tasks.filter(t => t.period === period);
              
              return (
                <div key={period} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 border-b border-slate-800 pb-2 flex justify-between">
                    {period} <span className="text-slate-600">{periodTasks.length} tarefas</span>
                  </h4>
                  {periodTasks.length === 0 ? (
                      <p className="text-sm text-slate-600 italic py-2">Nenhuma tarefa para este período.</p>
                  ) : (
                    <div className="space-y-2">
                        {periodTasks.map((task, idx) => (
                        <div key={task.id || idx} className="flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 p-3 rounded-lg border border-slate-700/50 group transition-all">
                            <div className="flex items-center gap-3">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                    period === Period.MORNING ? 'bg-blue-400' : 
                                    period === Period.AFTERNOON ? 'bg-orange-400' : 'bg-indigo-400'
                                }`}></div>
                                <span className="text-slate-200 font-medium text-sm">{task.label}</span>
                            </div>
                            <div className="flex items-center gap-4">
                            <span className="text-[10px] bg-slate-900 px-2 py-1 rounded text-emerald-400 font-mono border border-slate-700">
                                {task.points} pts
                            </span>
                            <button 
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-slate-600 hover:text-red-400 transition-colors p-1 hover:bg-red-500/10 rounded"
                                title="Remover tarefa"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            </div>
                        </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-800 rounded-b-xl">
            <button 
                onClick={onClose} 
                disabled={isSaving}
                className="text-slate-400 hover:text-white px-4 py-2 text-sm font-medium transition-colors"
            >
                Cancelar
            </button>
            <button 
                onClick={handleSaveWrapper}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-900/20 disabled:opacity-70 disabled:cursor-wait transition-all"
            >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Salvando...' : 'Salvar Definições'}
            </button>
        </div>
      </div>
    </div>
  );
};
