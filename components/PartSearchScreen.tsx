

import React, { useState } from 'react';
import PartNumberInput from './PartNumberInput';
import TaskList from './TaskList';
import SettingsTab from './SettingsTab';
import AnalyticsTab from './AnalyticsTab';
import { UserData, DBItem, PartRequest } from '../App';
import { useLanguage } from './LanguageContext';

// Tell TypeScript that XLSX is a global variable from the script tag in index.html
declare var XLSX: any;

export type PriorityLevel = 'LOW' | 'NORMAL' | 'URGENT';

export interface InventorySession {
    start: number;
    end?: number;
}

export interface Task {
  id: string; 
  text: string; // Legacy / Display text
  // Structured Data Fields
  partNumber?: string;
  workplace?: string;
  quantity?: string;
  quantityUnit?: string;
  standardTime?: number; // Standard travel time in minutes
  
  isDone: boolean;
  priority?: PriorityLevel; 
  completionTime?: string;
  completedBy?: string | null;
  status?: 'completed' | 'incorrectly_entered';

  isMissing?: boolean;
  missingReportedBy?: string | null;
  missingReason?: string;
  isInProgress?: boolean;
  inProgressBy?: string | null;
  createdAt?: number; 
  startedAt?: number; 
  completedAt?: number; 
  
  // Inventory / Blocking
  isBlocked?: boolean;
  inventoryHistory?: InventorySession[];
}

interface PartSearchScreenProps {
  currentUser: string;
  currentUserRole: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER';
  onLogout: () => void;
  tasks: Task[];
  onAddTask: (partNumber: string, workplace: string, quantity: string, quantityUnit: string, priority: PriorityLevel) => void; 
  onToggleTask: (id: string) => void;
  onMarkAsIncorrect: (id: string) => void;
  onEditTask: (id: string, newText: string, newPriority?: PriorityLevel) => void;
  onDeleteTask: (id: string) => void;
  onToggleMissing: (id: string, reason?: string) => void; 
  onSetInProgress: (id: string) => void;
  onToggleBlock: (id: string) => void; // New prop for inventory blocking
  // User Management
  users: UserData[];
  onAddUser: (user: UserData) => void;
  onUpdatePassword: (username: string, newPass: string) => void;
  onUpdateUserRole: (username: string, newRole: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER') => void;
  onDeleteUser: (username: string) => void;
  // DB Management
  parts: DBItem[];
  workplaces: DBItem[];
  missingReasons: DBItem[];
  onAddPart: (val: string) => void;
  onBatchAddParts: (vals: string[]) => void;
  onDeletePart: (id: string) => void;
  onDeleteAllParts: () => void;
  onAddWorkplace: (val: string, time?: number) => void;
  onBatchAddWorkplaces: (vals: string[]) => void; // Accepts strings line by line, parsed inside
  onDeleteWorkplace: (id: string) => void;
  onDeleteAllWorkplaces: () => void;
  onAddMissingReason: (val: string) => void;
  onDeleteMissingReason: (id: string) => void;
  // Part Requests
  partRequests: PartRequest[];
  onRequestPart: (part: string) => Promise<boolean>;
  onApprovePartRequest: (req: PartRequest) => void;
  onRejectPartRequest: (id: string) => void;
  // Archive
  onArchiveTasks: () => Promise<{ success: boolean; count?: number; error?: string; message?: string }>;
  onFetchArchivedTasks: () => Promise<Task[]>;
}

const LogoutIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const PartSearchScreen: React.FC<PartSearchScreenProps> = ({ 
  currentUser,
  currentUserRole,
  onLogout, 
  tasks, 
  onAddTask, 
  onToggleTask,
  onMarkAsIncorrect,
  onEditTask,
  onDeleteTask,
  onToggleMissing,
  onSetInProgress,
  onToggleBlock,
  users,
  onAddUser,
  onUpdatePassword,
  onUpdateUserRole,
  onDeleteUser,
  parts, workplaces, missingReasons, 
  onAddPart, onBatchAddParts, onDeletePart, onDeleteAllParts,
  onAddWorkplace, onBatchAddWorkplaces, onDeleteWorkplace, onDeleteAllWorkplaces,
  onAddMissingReason, onDeleteMissingReason,
  partRequests, onRequestPart, onApprovePartRequest, onRejectPartRequest,
  onArchiveTasks, onFetchArchivedTasks
}) => {
  const [selectedPart, setSelectedPart] = useState<DBItem | null>(null);
  const [selectedWorkplace, setSelectedWorkplace] = useState<string | null>(null);
  const { t, language, setLanguage } = useLanguage();
  
  // Quantity State
  const [quantity, setQuantity] = useState<string>('');
  const [quantityUnit, setQuantityUnit] = useState<'pcs' | 'boxes' | 'pallet'>('pcs');
  
  // Priority State
  const [priority, setPriority] = useState<PriorityLevel>('NORMAL');

  const [activeTab, setActiveTab] = useState<'entry' | 'tasks' | 'settings' | 'analytics'>('entry');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const hasUnfinishedTasks = tasks.some(task => !task.isDone);
  const canManage = currentUserRole === 'ADMIN' || currentUserRole === 'SUPERVISOR';
  const pendingRequestsCount = partRequests.length;

  const workplaceStrings = workplaces.map(w => w.value);

  const handlePartSelection = (partValue: string | null) => {
    if (partValue) {
      const partObject = parts.find(p => p.value === partValue);
      setSelectedPart(partObject || null);
    } else {
      setSelectedPart(null);
    }
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^[0-9\b]+$/.test(value)) {
        setQuantity(value);
    }
  };

  const getFormattedDateTime = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const getFormattedQuantity = () => {
    if (!quantity) return '';
    const num = parseInt(quantity, 10);

    if (quantityUnit === 'boxes') {
        if (num === 1) return `1 ${t('unit_boxes').toLowerCase().slice(0,3)}`; // approx hack
        return `${num} ${t('unit_boxes').toLowerCase()}`;
    }
    if (quantityUnit === 'pallet') {
        if (num === 1) return `1 ${t('unit_pallet').toLowerCase()}`;
        return `${num} ${t('unit_pallet').toLowerCase()}`;
    }
    // Default 'pcs'
    return `${num}`; 
  };

  const resultText = (selectedPart && selectedWorkplace && quantity) 
    ? `${getFormattedDateTime()} / ${selectedPart.value} / ${selectedWorkplace} / ${t('quantity')}: ${getFormattedQuantity()}`
    : null;
  
  const handleSendToTasks = () => {
    if (selectedPart && selectedWorkplace && quantity) {
      // Pass structured data
      onAddTask(selectedPart.value, selectedWorkplace, quantity, quantityUnit, priority);
      
      setSelectedPart(null);
      setSelectedWorkplace(null);
      setQuantity('');
      setQuantityUnit('pcs'); 
      setPriority('NORMAL'); 
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 2000);
    }
  };

  const handleExportExcel = () => {
    if (typeof XLSX === 'undefined') {
        alert('Chyba pri exporte: knižnica pre export nebola nájdená.');
        return;
    }
    
    const dataToExport = tasks.map(task => {
        // Use structured data if available, otherwise parse text (fallback for old tasks)
        let partNumber = task.partNumber;
        let workplace = task.workplace;
        let quantityText = '';

        if (task.quantity) {
             const num = parseInt(task.quantity, 10);
             let unit = 'ks';
             if (task.quantityUnit === 'boxes') unit = 'box';
             if (task.quantityUnit === 'pallet') unit = 'pal';
             quantityText = `${num} ${unit}`;
        }

        // Fallback for legacy records without structured data
        let date = '', time = '';
        if (!partNumber || !workplace) {
            const parts = task.text.split(' / ');
            const dateTime = (parts[0] || ' / ').split(' ');
            date = dateTime[0] || '-';
            time = dateTime[1] || '-';
            partNumber = parts[1] || '-';
            workplace = parts[2] || '-';
            quantityText = (parts[3] || '').replace('Počet: ', '').trim();
        } else if (task.createdAt) {
             const d = new Date(task.createdAt);
             date = d.toLocaleDateString('sk-SK');
             time = d.toLocaleTimeString('sk-SK');
        }

        return {
            'Dátum zadania': date,
            'Čas zadania': time,
            'Priorita': task.priority || 'NORMAL',
            'Diel': partNumber,
            'Pracovisko': workplace,
            'Norma (min)': task.standardTime || '-',
            'Počet': quantityText,
            'Stav': task.isDone ? 'Dokončené' : (task.isInProgress ? 'V riešení' : 'Otvorené'),
            'Rieši': task.inProgressBy || '-',
            'Čas dokončenia': task.completionTime || '-',
            'Dokončil': task.completedBy || '-',
            'Chýba tovar': task.isMissing ? 'ÁNO' : 'NIE',
            'Dôvod chýbania': task.missingReason || '-',
            'Nahlásil': task.missingReportedBy || '-'
        };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);

    const colWidths = Object.keys(dataToExport[0] || {}).map(key => ({
        wch: Math.max(
            key.length,
            ...dataToExport.map(row => (row[key] ? row[key].toString().length : 0))
        ) + 2
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Úlohy');
    
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `export_uloh_${dateStr}.xlsx`);
  };


  const handleRequestPart = async (part: string): Promise<boolean> => {
      const success = await onRequestPart(part);
      if (success) {
          // Do not clear part, let the user see the success on the button
          // setSelectedPart(null); 
      }
      return success;
  };

  return (
    <div className="w-full h-full p-2 md:p-8">
      <div className="relative bg-gray-800 rounded-xl shadow-lg p-4 md:p-8 h-full flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4 gap-4">
            <div className="flex items-center gap-4">
                {/* Language Toggle */}
                <button 
                  onClick={() => setLanguage(language === 'sk' ? 'en' : 'sk')}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-full text-sm font-bold text-gray-300 transition-colors"
                >
                   <span className={language === 'sk' ? 'text-white' : 'text-gray-500'}>SK</span>
                   <span className="text-gray-500">/</span>
                   <span className={language === 'en' ? 'text-white' : 'text-gray-500'}>EN</span>
                </button>
            </div>

            <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 text-gray-300 px-3 py-1.5 rounded-full ${canManage ? 'bg-red-900/50' : currentUserRole === 'LEADER' ? 'bg-yellow-900/50' : 'bg-gray-700'}`}>
                    <UserIcon className={`w-4 h-4 ${canManage ? 'text-red-400' : currentUserRole === 'LEADER' ? 'text-yellow-400' : 'text-teal-400'}`} />
                    <span className="text-sm font-medium">{currentUser}</span>
                </div>
                <button
                    onClick={onLogout}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors duration-200 p-2 rounded-lg hover:bg-gray-700"
                >
                    <LogoutIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">{t('logout')}</span>
                </button>
            </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 sm:mb-8 shrink-0">
          <div className="flex border-b border-gray-700 overflow-x-auto">
            <button
              onClick={() => setActiveTab('entry')}
              className={`flex-1 sm:flex-none py-3 px-4 sm:px-6 text-base sm:text-lg font-semibold transition-colors duration-200 text-center whitespace-nowrap ${activeTab === 'entry' ? 'border-b-2 border-teal-400 text-teal-400' : 'text-gray-400 hover:text-white'}`}
            >
              {t('tab_entry')}
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 sm:flex-none py-3 px-4 sm:px-6 text-base sm:text-lg font-semibold transition-colors duration-200 relative text-center whitespace-nowrap
                ${activeTab === 'tasks' ? 'border-b-2 border-teal-400' : 'text-gray-400 hover:text-white'}
                ${activeTab === 'tasks' && hasUnfinishedTasks ? 'text-orange-400 border-orange-500' : ''}
                ${activeTab !== 'tasks' && hasUnfinishedTasks ? 'text-orange-400' : ''}
              `}
            >
              {t('tab_tasks')}
              {hasUnfinishedTasks && (
                <div className={`absolute bottom-0 left-0 w-full h-0.5 ${activeTab !== 'tasks' ? 'bg-orange-500 animate-pulse' : ''}`}></div>
              )}
              {tasks.length > 0 && (
                 <span className="absolute top-2 right-1 sm:right-2 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-teal-500 text-[10px] sm:text-xs font-bold text-white">
                    {tasks.filter(t => !t.isDone).length}
                </span>
              )}
            </button>
            
            {canManage && (
              <>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex-1 sm:flex-none py-3 px-4 sm:px-6 text-base sm:text-lg font-semibold transition-colors duration-200 text-center whitespace-nowrap ${activeTab === 'analytics' ? 'border-b-2 border-teal-400 text-teal-400' : 'text-gray-400 hover:text-white'}`}
                >
                  {t('tab_analytics')}
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 sm:flex-none py-3 px-4 sm:px-6 text-base sm:text-lg font-semibold transition-colors duration-200 text-center whitespace-nowrap relative ${activeTab === 'settings' ? 'border-b-2 border-teal-400 text-teal-400' : 'text-gray-400 hover:text-white'}`}
                >
                  {t('tab_settings')}
                   {pendingRequestsCount > 0 && (
                        <span className="absolute top-2 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-black animate-pulse">
                            {pendingRequestsCount}
                        </span>
                   )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow min-h-0 overflow-y-auto pr-1 sm:pr-2">
            {activeTab === 'entry' && (
              <div>
                <h1 className="text-center text-2xl sm:text-3xl font-bold text-teal-400 mb-2">{t('search_title')}</h1>
                <p className="text-center text-gray-400 mb-6 sm:mb-8">{t('search_subtitle')}</p>
                
                <div className="space-y-4 sm:space-y-6 max-w-xl mx-auto">
                  
                   {/* Priority Selector */}
                   <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{t('priority_label')}</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setPriority('LOW')}
                            className={`py-2 px-1 text-sm font-bold rounded border ${priority === 'LOW' ? 'bg-blue-800 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'}`}
                        >
                            {t('prio_low')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setPriority('NORMAL')}
                            className={`py-2 px-1 text-sm font-bold rounded border ${priority === 'NORMAL' ? 'bg-green-700 border-green-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'}`}
                        >
                            {t('prio_normal')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setPriority('URGENT')}
                            className={`py-2 px-1 text-sm font-bold rounded border ${priority === 'URGENT' ? 'bg-red-700 border-red-500 text-white animate-pulse' : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'}`}
                        >
                            {t('prio_urgent')}
                        </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="part-number" className="block text-sm font-medium text-gray-300 mb-2">{t('part_number')}</label>
                    <PartNumberInput
                      parts={parts.map(p => p.value)}
                      onPartSelect={handlePartSelection}
                      placeholder={t('part_placeholder')}
                      value={selectedPart?.value || null}
                      onRequestPart={handleRequestPart}
                    />
                  </div>

                  <div>
                    <label htmlFor="workplace" className="block text-sm font-medium text-gray-300 mb-2">{t('workplace')}</label>
                    <PartNumberInput
                      parts={workplaceStrings}
                      onPartSelect={setSelectedWorkplace}
                      placeholder={t('workplace_placeholder')}
                      value={selectedWorkplace}
                    />
                  </div>

                  <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-gray-300 mb-2">{t('quantity')}</label>
                    
                    {/* Unit Selector */}
                    <div className="flex rounded-md shadow-sm mb-2" role="group">
                      <button
                        type="button"
                        onClick={() => setQuantityUnit('pcs')}
                        className={`px-4 py-2 text-sm font-medium border border-gray-600 rounded-l-lg flex-1 focus:z-10 focus:ring-2 focus:ring-teal-500 focus:text-white ${
                          quantityUnit === 'pcs' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {t('unit_pcs')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuantityUnit('boxes')}
                        className={`px-4 py-2 text-sm font-medium border-t border-b border-gray-600 flex-1 focus:z-10 focus:ring-2 focus:ring-teal-500 focus:text-white ${
                          quantityUnit === 'boxes' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {t('unit_boxes')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuantityUnit('pallet')}
                        className={`px-4 py-2 text-sm font-medium border border-gray-600 rounded-r-lg flex-1 focus:z-10 focus:ring-2 focus:ring-teal-500 focus:text-white ${
                          quantityUnit === 'pallet' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {t('unit_pallet')}
                      </button>
                    </div>

                    <input
                      id="quantity"
                      name="quantity"
                      type="number"
                      min="0"
                      value={quantity}
                      onChange={handleQuantityChange}
                      placeholder={
                          quantityUnit === 'pallet' 
                          ? t('pallet_placeholder')
                          : quantityUnit === 'boxes' 
                          ? t('boxes_placeholder')
                          : t('pcs_placeholder')
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors text-base"
                    />
                  </div>
                </div>

                <div className="mt-8 sm:mt-10 pt-6 border-t border-gray-700 max-w-xl mx-auto">
                  <h2 className="text-lg font-semibold text-white mb-4">{t('result_label')}</h2>
                  <div className="bg-gray-900 p-4 rounded-lg min-h-[50px] flex items-center overflow-x-auto mb-4">
                    {resultText ? (
                      <p className="text-md font-mono text-teal-300 whitespace-nowrap">
                        {priority === 'URGENT' && <span className="text-red-500 font-bold mr-2">[{t('prio_urgent')}]</span>}
                        {resultText}
                      </p>
                    ) : (
                      <p className="text-gray-500 italic text-sm sm:text-base">
                        {t('result_empty')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                     {resultText && (
                        <button
                            onClick={handleSendToTasks}
                            className={`flex-grow px-4 py-3 sm:py-2 rounded-lg text-sm font-semibold transition-all duration-200 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 text-center ${
                                priority === 'URGENT' 
                                ? 'bg-red-700 hover:bg-red-800 focus:ring-red-500 animate-pulse' 
                                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                            }`}
                        >
                            {showSuccessMessage ? t('sent_msg') : (priority === 'URGENT' ? t('send_urgent_btn') : t('send_btn'))}
                        </button>
                     )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8 relative">
                   <h1 className="text-2xl sm:text-3xl font-bold text-teal-400 text-center">{t('tasks_title')}</h1>
                   <div className="flex items-center gap-4 mt-4 sm:mt-0">
                     {currentUserRole === 'ADMIN' && (
                       <button onClick={handleExportExcel} className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
                         <DownloadIcon className="w-4 h-4" />
                         {t('export_excel')}
                       </button>
                     )}
                   </div>
                </div>
                <TaskList
                  currentUser={currentUserRole}
                  tasks={tasks}
                  missingReasons={missingReasons}
                  onToggleTask={onToggleTask}
                  onMarkAsIncorrect={onMarkAsIncorrect}
                  onEditTask={onEditTask}
                  onDeleteTask={onDeleteTask}
                  onToggleMissing={onToggleMissing}
                  onSetInProgress={onSetInProgress}
                  onToggleBlock={onToggleBlock}
                />
              </div>
            )}

            {activeTab === 'analytics' && canManage && (
              <div>
                 <AnalyticsTab tasks={tasks} onFetchArchivedTasks={onFetchArchivedTasks} />
              </div>
            )}

            {activeTab === 'settings' && canManage && (
              <div>
                <h1 className="text-center text-2xl sm:text-3xl font-bold text-teal-400 mb-6 sm:mb-8">{t('settings_title')}</h1>
                <SettingsTab 
                  currentUserRole={currentUserRole}
                  users={users} 
                  onAddUser={onAddUser} 
                  onUpdatePassword={onUpdatePassword}
                  onUpdateUserRole={onUpdateUserRole}
                  onDeleteUser={onDeleteUser}
                  parts={parts}
                  workplaces={workplaces}
                  missingReasons={missingReasons}
                  onAddPart={onAddPart}
                  onBatchAddParts={onBatchAddParts}
                  onDeletePart={onDeletePart}
                  onDeleteAllParts={onDeleteAllParts}
                  onAddWorkplace={onAddWorkplace}
                  onBatchAddWorkplaces={onBatchAddWorkplaces}
                  onDeleteWorkplace={onDeleteWorkplace}
                  onDeleteAllWorkplaces={onDeleteAllWorkplaces}
                  onAddMissingReason={onAddMissingReason}
                  onDeleteMissingReason={onDeleteMissingReason}
                  partRequests={partRequests}
                  onApprovePartRequest={onApprovePartRequest}
                  onRejectPartRequest={onRejectPartRequest}
                  onArchiveTasks={onArchiveTasks}
                />
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default PartSearchScreen;