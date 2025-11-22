import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Dot
} from 'recharts';
import { DayData } from '../types';
import { TOTAL_POSSIBLE_POINTS } from '../constants';
import { AlertCircle, CheckCircle2, XCircle, Trophy } from 'lucide-react';

interface ChartProps {
  history: Record<string, DayData>;
}

// Custom Dot to show red for 0 points (missed days) and green for activity
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  
  if (!payload.isFuture && payload.points === 0) {
    return (
      <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#7f1d1d" strokeWidth={2} />
    );
  }
  
  if (payload.points > 0) {
     return (
      <circle cx={cx} cy={cy} r={3} fill="#10b981" stroke="#064e3b" strokeWidth={1} />
    );
  }

  return null; // No dot for future days
};

export const ProgressChart: React.FC<ChartProps> = ({ history }) => {
  // Calculate challenge data
  const { data, stats } = useMemo(() => {
    const sortedDates = Object.keys(history).sort();
    // If no history, start from today. If history exists, start from the very first log.
    const startDate = sortedDates.length > 0 ? new Date(sortedDates[0]) : new Date();
    
    const chartData = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today

    let totalPointsAccumulated = 0;
    let daysMissed = 0;
    let daysPerfect = 0;
    let daysActive = 0;

    for (let i = 0; i < 30; i++) {
      const currentDay = new Date(startDate);
      currentDay.setDate(startDate.getDate() + i);
      const dateStr = currentDay.toISOString().split('T')[0];
      
      const historyEntry = history[dateStr];
      const isFuture = currentDay > today;
      
      let points = 0;
      let status = 'future'; // future, active, missed

      if (historyEntry) {
        points = historyEntry.totalPoints;
        status = 'active';
        daysActive++;
        totalPointsAccumulated += points;
        if (points === TOTAL_POSSIBLE_POINTS) daysPerfect++;
      } else if (!isFuture) {
        // If it's in the past/today and no entry, it's a missed day
        status = 'missed';
        daysMissed++;
      }

      chartData.push({
        dayIndex: i + 1, // Day 1 to 30
        date: dateStr,
        displayDate: `${currentDay.getDate()}/${currentDay.getMonth() + 1}`,
        points: points,
        isFuture: isFuture,
        status: status
      });
    }

    return {
      data: chartData,
      stats: {
        totalPoints: totalPointsAccumulated,
        daysMissed,
        daysPerfect,
        daysActive,
        average: daysActive > 0 ? (totalPointsAccumulated / daysActive).toFixed(1) : '0'
      }
    };
  }, [history]);

  return (
    <div className="space-y-4">
      <div className="w-full h-72 bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700">
        <h3 className="text-slate-400 text-sm font-semibold mb-4 uppercase tracking-wider flex justify-between">
          <span>Progresso do Desafio</span>
          <span className="text-emerald-500">30 Dias</span>
        </h3>
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis 
              dataKey="dayIndex" 
              tick={{ fill: '#94a3b8', fontSize: 10 }} 
              axisLine={false}
              tickLine={false}
              interval={2} // Show every 3rd day label to avoid clutter
              tickFormatter={(val) => `Dia ${val}`}
            />
            <YAxis 
              domain={[0, TOTAL_POSSIBLE_POINTS]} 
              tick={{ fill: '#94a3b8', fontSize: 10 }} 
              axisLine={false}
              tickLine={false}
              width={25}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                    return `Dia ${label} (${payload[0].payload.displayDate})`;
                }
                return `Dia ${label}`;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="points" 
              stroke="#10b981" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPoints)" 
              animationDuration={1000}
              dot={<CustomDot />}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Relatório Técnico */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 uppercase font-bold">Performance Média</span>
            <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-xl font-mono text-white">{stats.average} <span className="text-xs text-slate-500">pts/dia</span></span>
            </div>
        </div>
        <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 uppercase font-bold">Dias Perfeitos</span>
            <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xl font-mono text-white">{stats.daysPerfect}</span>
            </div>
        </div>
        <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 uppercase font-bold">Dias Falhados</span>
            <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-xl font-mono text-white">{stats.daysMissed}</span>
            </div>
        </div>
        <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 uppercase font-bold">Total Acumulado</span>
            <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500" />
                <span className="text-xl font-mono text-white">{stats.totalPoints}</span>
            </div>
        </div>
        
        <div className="col-span-2 md:col-span-4 border-t border-slate-800 mt-2 pt-2 text-xs text-slate-600 font-mono">
            * Relatório Técnico: O sistema detecta falhas automaticamente se nenhum ponto for registrado em datas passadas (indicado por ponto vermelho). Mantenha a consistência.
        </div>
      </div>
    </div>
  );
};