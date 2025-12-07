
import React, { useMemo, useState, useEffect } from 'react';
import { Task, InventorySession } from './PartSearchScreen';
import { SystemBreak } from '../App';
import { useLanguage } from './LanguageContext';

// Tell TypeScript that XLSX is a global variable from the script tag in index.html
declare var XLSX: any;

interface AnalyticsTabProps {
  tasks: Task[];
  onFetchArchivedTasks: () => Promise<Task[]>;
  systemBreaks: SystemBreak[];
}

type FilterMode = 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ tasks: liveTasks, onFetchArchivedTasks, systemBreaks }) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  // Archive Logic
  const [includeArchive, setIncludeArchive] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const { t } = useLanguage();

  // Combine tasks based on toggle
  const tasks = useMemo(() => {
      return includeArchive ? [...liveTasks, ...archivedTasks] : liveTasks;
  }, [liveTasks, archivedTasks, includeArchive]);


  // Handle loading archive
  useEffect(() => {
      if (includeArchive && archivedTasks.length === 0) {
          const load = async () => {
              setIsLoadingArchive(true);
              const data = await onFetchArchivedTasks();
              setArchivedTasks(data);
              setIsLoadingArchive(false);
          };
          load();
      }
  }, [includeArchive, onFetchArchivedTasks, archivedTasks.length]);


  // --- Filtering Logic ---
  const filteredTasks = useMemo(() => {
    if (filterMode === 'ALL') return tasks;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return tasks.filter(task => {
        // Fallback if createdAt is missing (older tasks), treat them as 'older' unless ALL
        if (!task.createdAt) return false;
        
        const taskDate = new Date(task.createdAt);
        const taskDayStart = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

        switch(filterMode) {
            case 'TODAY':
                return taskDayStart.getTime() === todayStart.getTime();
            
            case 'YESTERDAY':
                const yesterdayStart = new Date(todayStart);
                yesterdayStart.setDate(yesterdayStart.getDate() - 1);
                return taskDayStart.getTime() === yesterdayStart.getTime();
            
            case 'WEEK':
                // Current week (Monday to Sunday)
                const day = now.getDay(); // 0 (Sun) to 6 (Sat)
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                const monday = new Date(now.setDate(diff));
                monday.setHours(0,0,0,0);
                return taskDate >= monday;

            case 'MONTH':
                return taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear();

            case 'CUSTOM':
                if (!customStart) return true; // Show all if only custom selected but no dates
                const start = new Date(customStart);
                start.setHours(0,0,0,0);
                
                if (customEnd) {
                    const end = new Date(customEnd);
                    end.setHours(23,59,59,999);
                    return taskDate >= start && taskDate <= end;
                } else {
                    return taskDate >= start;
                }
                
            default:
                return true;
        }
    });
  }, [tasks, filterMode, customStart, customEnd]);

  // Helper function to format duration (ms -> readable string)
  const formatDuration = (ms: number) => {
    if (ms <= 0) return '-';
    const minutes = Math.round(ms / 60000);
    if (minutes < 1) return '< 1 min';
    if (minutes > 60) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
    }
    return `${minutes} min`;
  };

  // --- Helper to calculate time spent blocked (Inventory OR Break) ---
  const calculateBlockedTime = (history: InventorySession[] | undefined, startTime: number, endTime: number): number => {
      let totalBlocked = 0;

      // 1. Inventory Blocking
      if (history && history.length > 0) {
          history.forEach(session => {
              const blockStart = session.start;
              const blockEnd = session.end || endTime;
              
              const overlapStart = Math.max(startTime, blockStart);
              const overlapEnd = Math.min(endTime, blockEnd);

              if (overlapEnd > overlapStart) {
                  totalBlocked += (overlapEnd - overlapStart);
              }
          });
      }

      // 2. System Breaks Blocking
      // We check all recorded breaks against the task duration
      if (systemBreaks && systemBreaks.length > 0) {
          systemBreaks.forEach(br => {
              const breakStart = br.start;
              const breakEnd = br.end || endTime;

              const overlapStart = Math.max(startTime, breakStart);
              const overlapEnd = Math.min(endTime, breakEnd);

              if (overlapEnd > overlapStart) {
                  totalBlocked += (overlapEnd - overlapStart);
              }
          });
      }

      return totalBlocked;
  };

  // --- Calculations based on Filtered Tasks ---
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const incorrectlyEntered = filteredTasks.filter(t => t.status === 'incorrectly_entered').length;
    
    // Performance tasks should NOT include incorrectly entered ones.
    const performanceTasks = filteredTasks.filter(t => t.status !== 'incorrectly_entered');
    const done = performanceTasks.filter(t => t.isDone).length;

    const missing = performanceTasks.filter(t => t.isMissing).length;
    const urgent = performanceTasks.filter(t => t.priority === 'URGENT' && t.isDone).length;
    
    // Efficiency
    const performanceTotal = performanceTasks.length;
    const efficiency = performanceTotal === 0 ? 0 : Math.round((done / performanceTotal) * 100);

    // Parsing logic for Workplaces and Parts
    const workplaceCounts: Record<string, number> = {};
    const partCounts: Record<string, number> = {};
    
    // Time Stats Accumulators
    let totalReactionTime = 0;
    let countReactionTime = 0;
    let totalLeadTime = 0;
    let countLeadTime = 0;
    
    // New: Total Man-Hours Accumulator
    let grandTotalExecutionTime = 0;

    // Worker Detailed Stats
    interface WorkerStat {
        name: string;
        count: number;
        totalLeadMs: number;
        countLead: number;
        totalReactionMs: number;
        countReaction: number;
        totalExecutionMs: number; // New: Total clean work time
        totalStandardMinutes: number; // Total accumulated 'Standard Time' for completed tasks
    }
    const workerStatsMap: Record<string, WorkerStat> = {};

    performanceTasks.forEach(task => {
        // --- 1. Identify Part & Workplace ---
        let part = task.partNumber;
        let wp = task.workplace;

        // Fallback for legacy tasks that don't have structured fields
        if (!part || !wp) {
            const segments = task.text.split(' / ');
            if (segments.length >= 3) {
                if (!part) part = segments[1].trim();
                if (!wp) wp = segments[2].trim();
            }
        }

        if (part && part !== '-') partCounts[part] = (partCounts[part] || 0) + 1;
        if (wp && wp !== '-') workplaceCounts[wp] = (workplaceCounts[wp] || 0) + 1;


        // --- 2. Global Time Stats ---
        if (task.createdAt) {
            // Reaction Time (Start - Create)
            if (task.startedAt) {
                const reaction = task.startedAt - task.createdAt;
                if (reaction > 0) {
                    totalReactionTime += reaction;
                    countReactionTime++;
                }
            }
            // Lead Time (Complete - Create)
            if (task.isDone && task.completedAt) {
                 const lead = task.completedAt - task.createdAt;
                 if (lead > 0) {
                     totalLeadTime += lead;
                     countLeadTime++;
                 }
            }
        }

        // --- 3. Per Worker Stats & Execution Time Logic ---
        if (task.isDone && task.completedBy) {
            const worker = task.completedBy;
            if (!workerStatsMap[worker]) {
                workerStatsMap[worker] = { 
                    name: worker, 
                    count: 0, 
                    totalLeadMs: 0, 
                    countLead: 0, 
                    totalReactionMs: 0, 
                    countReaction: 0,
                    totalExecutionMs: 0,
                    totalStandardMinutes: 0
                };
            }

            const ws = workerStatsMap[worker];
            ws.count++;

            // Accumulate standard time if available
            if (task.standardTime) {
                ws.totalStandardMinutes += task.standardTime;
            }

            if (task.createdAt) {
                 if (task.completedAt) {
                     const lead = task.completedAt - task.createdAt;
                     if (lead > 0) {
                         ws.totalLeadMs += lead;
                         ws.countLead++;
                     }
                 }
                 if (task.startedAt) {
                     const reaction = task.startedAt - task.createdAt;
                     if (reaction > 0) {
                         ws.totalReactionMs += reaction;
                         ws.countReaction++;
                     }
                     
                     // Execution Time (Completed - Started)
                     // Only possible if we have both timestamps
                     if (task.completedAt) {
                         let execution = task.completedAt - task.startedAt;
                         
                         // Subtract Blocked/Inventory/Break Time
                         const blockedTime = calculateBlockedTime(task.inventoryHistory, task.startedAt, task.completedAt);
                         execution = execution - blockedTime;

                         if (execution > 0) {
                             ws.totalExecutionMs += execution;
                             grandTotalExecutionTime += execution;
                         }
                     }
                 }
            }
        }
    });

    const avgReaction = countReactionTime > 0 ? totalReactionTime / countReactionTime : 0;
    const avgLead = countLeadTime > 0 ? totalLeadTime / countLeadTime : 0;

    const getTop5 = (record: Record<string, number>) => {
        return Object.entries(record)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);
    };

    const workerStatsList = Object.values(workerStatsMap).map(ws => ({
        name: ws.name,
        count: ws.count,
        avgLead: ws.countLead > 0 ? ws.totalLeadMs / ws.countLead : 0,
        avgReaction: ws.countReaction > 0 ? ws.totalReactionMs / ws.countReaction : 0,
        totalExecution: ws.totalExecutionMs,
        totalStandardMinutes: ws.totalStandardMinutes
    })).sort((a, b) => b.count - a.count); // Default sort by count

    return {
        total,
        done,
        missing,
        urgent,
        efficiency,
        avgReaction,
        avgLead,
        grandTotalExecutionTime,
        incorrectlyEntered,
        topWorkplaces: getTop5(workplaceCounts),
        topParts: getTop5(partCounts),
        workerStats: workerStatsList
    };
  }, [filteredTasks, systemBreaks]);

  // --- Export Functionality ---
  const handleExportReport = () => {
    if (typeof XLSX === 'undefined') {
        alert('Knižnica pre export nie je načítaná.');
        return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Sheet: KPI Summary
    const kpiData = [
        { Metrika: "Celkovo úloh", Hodnota: stats.total },
        { Metrika: "Dokončené (Reálne)", Hodnota: stats.done },
        { Metrika: "Chybne Zadané", Hodnota: stats.incorrectlyEntered },
        { Metrika: "Chýbajúci tovar", Hodnota: stats.missing },
        { Metrika: "Urgentné (Vykonané)", Hodnota: stats.urgent },
        { Metrika: "Efektivita (%)", Hodnota: stats.efficiency },
        { Metrika: "Priemerný čas reakcie (min)", Hodnota: (stats.avgReaction / 60000).toFixed(2) },
        { Metrika: "Priemerný čas vybavenia (min)", Hodnota: (stats.avgLead / 60000).toFixed(2) },
        { Metrika: "Celkový čistý čas práce (hod)", Hodnota: (stats.grandTotalExecutionTime / 3600000).toFixed(2) },
    ];
    const wsKPI = XLSX.utils.json_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, wsKPI, "KPI Prehľad");

    // 2. Sheet: Workers
    const workerData = stats.workerStats.map(w => ({
        Meno: w.name,
        "Počet úloh": w.count,
        "Čistý čas práce (hod)": (w.totalExecution / 3600000).toFixed(2),
        "Súčet Normy Presunov (min)": w.totalStandardMinutes,
        "Priem. Reakcia (min)": (w.avgReaction / 60000).toFixed(2),
        "Priem. Vybavenie (min)": (w.avgLead / 60000).toFixed(2)
    }));
    const wsWorkers = XLSX.utils.json_to_sheet(workerData);
    XLSX.utils.book_append_sheet(wb, wsWorkers, "Výkonnosť Skladníkov");

    // 3. Sheet: Top Lists
    // Combine lists for side-by-side view simulation
    const maxLength = Math.max(stats.topWorkplaces.length, stats.topParts.length);
    const topListData = [];
    for (let i = 0; i < maxLength; i++) {
        topListData.push({
            "Poradie": i + 1,
            "Pracovisko": stats.topWorkplaces[i]?.[0] || '-',
            "Prac. Počet": stats.topWorkplaces[i]?.[1] || 0,
            "": "", // Spacer column
            "Diel": stats.topParts[i]?.[0] || '-',
            "Diel Počet": stats.topParts[i]?.[1] || 0
        });
    }
    const wsTop = XLSX.utils.json_to_sheet(topListData);
    XLSX.utils.book_append_sheet(wb, wsTop, "Top Rebríčky");

    // 4. Sheet: Raw Data
    const rawData = filteredTasks.map(t => {
        let dateStr = '-', timeStr = '-';
        if (t.createdAt) {
            const d = new Date(t.createdAt);
            dateStr = d.toLocaleDateString('sk-SK');
            timeStr = d.toLocaleTimeString('sk-SK');
        }

        let qty = t.quantity || '';
        if (t.quantityUnit === 'boxes') qty += ' box';
        if (t.quantityUnit === 'pallet') qty += ' pal';

        let status = 'Otvorené';
        if (t.isDone) {
            status = t.status === 'incorrectly_entered' ? 'Chybne Zadaná' : 'Dokončené';
        }

        return {
            "ID": t.id,
            "Dátum": dateStr,
            "Čas": timeStr,
            "Priorita": t.priority || 'NORMAL',
            "Diel": t.partNumber || t.text.split('/')[1] || '-',
            "Pracovisko": t.workplace || t.text.split('/')[2] || '-',
            "Norma Presunu (min)": t.standardTime || 0,
            "Počet": qty,
            "Stav": status,
            "Dokončil": t.completedBy || '-',
            "Chýba": t.isMissing ? 'ÁNO' : '',
            "Dôvod": t.missingReason || '-'
        };
    });
    const wsRaw = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, wsRaw, "Zdrojové Dáta");

    const fileName = `Analytika_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8 animate-fade-in">
        <h1 className="text-center text-2xl sm:text-3xl font-bold text-teal-400 mb-2">{t('analytics_title')}</h1>
        
        {/* Top Controls: Archive & Export */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 mb-2">
            <label className="flex items-center cursor-pointer gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700">
                <input 
                    type="checkbox" 
                    checked={includeArchive} 
                    onChange={() => setIncludeArchive(!includeArchive)}
                    className="form-checkbox h-5 w-5 text-teal-500 rounded focus:ring-teal-500 bg-gray-700 border-gray-600"
                />
                <span className="text-sm font-bold text-teal-400">
                    {isLoadingArchive ? t('loading_hist') : t('include_archive')}
                </span>
            </label>

            <button 
                onClick={handleExportReport}
                className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors"
            >
                <DownloadIcon className="w-5 h-5" />
                {t('download_report')}
            </button>
        </div>

        {/* Filter Controls */}
        <div className="bg-gray-800 p-4 rounded-xl shadow-md border border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2 justify-center">
                <button onClick={() => setFilterMode('ALL')} className={`px-4 py-2 rounded text-sm font-bold transition-colors ${filterMode === 'ALL' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t('filter_all')}</button>
                <button onClick={() => setFilterMode('TODAY')} className={`px-4 py-2 rounded text-sm font-bold transition-colors ${filterMode === 'TODAY' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t('filter_today')}</button>
                <button onClick={() => setFilterMode('YESTERDAY')} className={`px-4 py-2 rounded text-sm font-bold transition-colors ${filterMode === 'YESTERDAY' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t('filter_yesterday')}</button>
                <button onClick={() => setFilterMode('WEEK')} className={`px-4 py-2 rounded text-sm font-bold transition-colors ${filterMode === 'WEEK' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t('filter_week')}</button>
                <button onClick={() => setFilterMode('MONTH')} className={`px-4 py-2 rounded text-sm font-bold transition-colors ${filterMode === 'MONTH' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t('filter_month')}</button>
                <button onClick={() => setFilterMode('CUSTOM')} className={`px-4 py-2 rounded text-sm font-bold transition-colors ${filterMode === 'CUSTOM' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t('filter_custom')}</button>
            </div>
            
            {filterMode === 'CUSTOM' && (
                <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-600">
                    <input 
                        type="date" 
                        value={customStart} 
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-600 focus:border-teal-500 outline-none"
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                        type="date" 
                        value={customEnd} 
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-600 focus:border-teal-500 outline-none"
                    />
                </div>
            )}
        </div>

        {/* Info Bar */}
        <div className="text-center text-sm text-gray-400">
            {t('showing_data')} <span className="text-white font-bold">
                {filterMode === 'ALL' && t('f_history')}
                {filterMode === 'TODAY' && t('f_today')}
                {filterMode === 'YESTERDAY' && t('f_yesterday')}
                {filterMode === 'WEEK' && t('f_week')}
                {filterMode === 'MONTH' && t('f_month')}
                {filterMode === 'CUSTOM' && t('f_custom')}
            </span>
            <span className="ml-2 bg-gray-700 px-2 py-0.5 rounded text-xs">{filteredTasks.length} {t('records')}</span>
        </div>
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-700 p-4 rounded-xl shadow-lg border-l-4 border-blue-500">
                <p className="text-gray-400 text-sm font-bold uppercase">{t('kpi_total')}</p>
                <p className="text-3xl font-extrabold text-white mt-1">{stats.total}</p>
            </div>
            
            <div className="bg-gray-700 p-4 rounded-xl shadow-lg border-l-4 border-green-500">
                <p className="text-gray-400 text-sm font-bold uppercase">{t('kpi_worked')}</p>
                <p className="text-3xl font-extrabold text-green-400 mt-1">{formatDuration(stats.grandTotalExecutionTime)}</p>
                <p className="text-xs text-gray-500">{t('kpi_clean_time')}</p>
            </div>

            <div className="bg-gray-700 p-4 rounded-xl shadow-lg border-l-4 border-purple-500">
                <p className="text-gray-400 text-sm font-bold uppercase">{t('kpi_lead')}</p>
                <p className="text-3xl font-extrabold text-purple-400 mt-1">{formatDuration(stats.avgLead)}</p>
                <p className="text-xs text-gray-500">{t('kpi_lead_desc')}</p>
            </div>
             <div className="bg-gray-700 p-4 rounded-xl shadow-lg border-l-4 border-yellow-500">
                <p className="text-gray-400 text-sm font-bold uppercase">{t('kpi_react')}</p>
                <p className="text-3xl font-extrabold text-yellow-400 mt-1">{formatDuration(stats.avgReaction)}</p>
                 <p className="text-xs text-gray-500">{t('kpi_react_desc')}</p>
            </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-gray-700 p-4 rounded-xl shadow-lg border-l-4 border-teal-500">
                <p className="text-gray-400 text-sm font-bold uppercase">{t('kpi_effic')}</p>
                <div className="flex items-end gap-2">
                    <p className="text-3xl font-extrabold text-teal-400 mt-1">{stats.efficiency}%</p>
                    <span className="text-sm text-gray-400 mb-1">({stats.done} {t('kpi_done')})</span>
                </div>
            </div>
             <div className="bg-gray-700 p-4 rounded-xl shadow-lg border-l-4 border-red-500">
                <p className="text-gray-400 text-sm font-bold uppercase">{t('kpi_urgent')}</p>
                <p className="text-3xl font-extrabold text-red-500 mt-1">{stats.urgent}</p>
            </div>
             <div className="bg-gray-700 p-4 rounded-xl shadow-lg border-l-4 border-orange-500">
                <p className="text-gray-400 text-sm font-bold uppercase">{t('kpi_missing')}</p>
                <p className="text-3xl font-extrabold text-orange-400 mt-1">{stats.missing}</p>
            </div>
             <div className="bg-gray-700 p-4 rounded-xl shadow-lg border-l-4 border-gray-500">
                <p className="text-gray-400 text-sm font-bold uppercase">{t('kpi_incorrect')}</p>
                <p className="text-3xl font-extrabold text-gray-400 mt-1">{stats.incorrectlyEntered}</p>
            </div>
        </div>

        {/* Detailed Worker Stats Table */}
        <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-lg">
             <h3 className="text-lg font-bold text-white mb-4 border-b border-gray-700 pb-2">{t('table_title')}</h3>
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-gray-400 text-sm border-b border-gray-700">
                            <th className="py-2 px-2">{t('th_rank')}</th>
                            <th className="py-2 px-2">{t('th_name')}</th>
                            <th className="py-2 px-2 text-right">{t('th_done')}</th>
                            <th className="py-2 px-2 text-right text-green-400">{t('th_work_time')}</th>
                            <th className="py-2 px-2 text-right text-blue-400">{t('th_std_time')}</th>
                            <th className="py-2 px-2 text-right">{t('th_avg_react')}</th>
                            <th className="py-2 px-2 text-right">{t('th_avg_lead')}</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {stats.workerStats.length > 0 ? (
                            stats.workerStats.map((ws, idx) => (
                                <tr key={ws.name} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                                    <td className="py-3 px-2 text-gray-500 font-mono">{idx + 1}</td>
                                    <td className="py-3 px-2 font-bold text-white flex items-center gap-2">
                                        {idx === 0 && <span className="text-yellow-500">👑</span>}
                                        {ws.name}
                                    </td>
                                    <td className="py-3 px-2 text-right text-teal-400 font-bold">{ws.count}</td>
                                    <td className="py-3 px-2 text-right text-green-400 font-bold font-mono">{formatDuration(ws.totalExecution)}</td>
                                    <td className="py-3 px-2 text-right text-blue-400 font-bold font-mono">{ws.totalStandardMinutes} min</td>
                                    <td className="py-3 px-2 text-right text-yellow-400">{formatDuration(ws.avgReaction)}</td>
                                    <td className="py-3 px-2 text-right text-purple-400">{formatDuration(ws.avgLead)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={7} className="py-4 text-center text-gray-500 italic">{t('no_data')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
             </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Workplaces Chart */}
            <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-gray-700 pb-2">{t('chart_wp')}</h3>
                <div className="space-y-4">
                    {stats.topWorkplaces.length > 0 ? (
                        stats.topWorkplaces.map(([name, count], idx) => (
                            <div key={name} className="relative">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-300 font-mono">{idx + 1}. {name}</span>
                                    <span className="text-teal-400 font-bold">{count}</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div 
                                        className="bg-teal-600 h-2.5 rounded-full" 
                                        style={{ width: `${(count / stats.topWorkplaces[0][1]) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 italic text-sm">{t('no_data')}</p>
                    )}
                </div>
            </div>

            {/* Top Parts Chart */}
            <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-gray-700 pb-2">{t('chart_parts')}</h3>
                <div className="space-y-4">
                     {stats.topParts.length > 0 ? (
                        stats.topParts.map(([name, count], idx) => (
                            <div key={name} className="relative">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-300 font-mono">{idx + 1}. {name}</span>
                                    <span className="text-blue-400 font-bold">{count}</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div 
                                        className="bg-blue-600 h-2.5 rounded-full" 
                                        style={{ width: `${(count / stats.topParts[0][1]) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))
                     ) : (
                        <p className="text-gray-500 italic text-sm">{t('no_data')}</p>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default AnalyticsTab;
