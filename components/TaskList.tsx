
import React, { useState } from 'react';
import { Task, PriorityLevel } from './PartSearchScreen';
import { DBItem } from '../App';
import { useLanguage } from './LanguageContext';

interface TaskListProps {
  currentUser: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER' | 'LOGISTICIAN';
  tasks: Task[];
  missingReasons: DBItem[];
  onToggleTask: (id: string) => void;
  onMarkAsIncorrect: (id: string) => void;
  onEditTask: (id: string, newText: string, newPriority?: PriorityLevel) => void;
  onDeleteTask: (id: string) => void;
  onToggleMissing: (id: string, reason?: string) => void;
  onSetInProgress: (id: string) => void;
  onToggleBlock: (id: string) => void;
  onAddNote: (id: string, note: string) => void;
  onReleaseTask: (id: string) => void;
}

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const PencilIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IncorrectIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
);


const ExclamationIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
    </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 6h12v12H6z" />
    </svg>
);

const LockIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 24 24">
         <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s-.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3 3.1-3 1.71 0 3.1 1.29 3.1 3v2z"/>
    </svg>
);

const UnlockIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3 3.1-3 1.71 0 3.1 1.29 3.1 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/>
    </svg>
);

const ChatIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);


const TaskList: React.FC<TaskListProps> = ({ currentUser, tasks, missingReasons, onToggleTask, onMarkAsIncorrect, onEditTask, onDeleteTask, onToggleMissing, onSetInProgress, onToggleBlock, onAddNote, onReleaseTask }) => {
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editPriority, setEditPriority] = useState<PriorityLevel>('NORMAL');
  const { t } = useLanguage();
  
  // Modal for Missing Reason
  const [missingModalTaskId, setMissingModalTaskId] = useState<string | null>(null);

  // Note Modal
  const [noteModalTaskId, setNoteModalTaskId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const isLeader = currentUser === 'LEADER';
  const isAdminOrSuper = currentUser === 'ADMIN' || currentUser === 'SUPERVISOR';
  const isLogistician = currentUser === 'LOGISTICIAN';
  
  const canDelete = isAdminOrSuper;
  // Leader can Edit (only priority), Logistician can edit
  const canEdit = isAdminOrSuper || isLeader || isLogistician;
  
  // Logistician cannot "finish" tasks physically
  const canFinish = !isLogistician;
  const canSetProgress = !isLogistician;

  if (tasks.length === 0) {
    return <p className="text-center text-gray-500 italic">{t('empty_tasks')}</p>;
  }

  const handleCopyPartNumber = (partNumber: string, taskId: string) => {
      navigator.clipboard.writeText(partNumber.trim()).then(() => {
        setCopiedTaskId(taskId);
        setTimeout(() => setCopiedTaskId(null), 2000);
      }, (err) => {
        console.error('Nepodarilo sa skopírovať číslo dielu: ', err);
      });
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditText(task.text);
    setEditPriority(task.priority || 'NORMAL');
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditText('');
  };

  const saveEditing = (id: string) => {
    // If Leader, we use the original text, ignoring what's in the input
    // (though the input is disabled, this is a safety check)
    if (editText.trim()) {
      onEditTask(id, editText, editPriority);
      setEditingTaskId(null);
      setEditText('');
    }
  };

  // Missing Modal Handlers
  const openMissingModal = (taskId: string) => {
      setMissingModalTaskId(taskId);
  };

  const closeMissingModal = () => {
      setMissingModalTaskId(null);
  };

  const confirmMissingReason = (reason: string) => {
      if (missingModalTaskId) {
          onToggleMissing(missingModalTaskId, reason);
          closeMissingModal();
      }
  };

  // Note Modal Handlers
  const openNoteModal = (task: Task) => {
      setNoteModalTaskId(task.id);
      setNoteText(task.note || '');
  }
  const saveNote = () => {
      if(noteModalTaskId) {
          onAddNote(noteModalTaskId, noteText);
          setNoteModalTaskId(null);
          setNoteText('');
      }
  }

  const getTaskDisplayData = (task: Task) => {
    // 1. Try structured data
    if (task.partNumber) {
        let qtyDisplay = task.quantity || '';
        if (task.quantityUnit === 'boxes') {
             const num = parseInt(task.quantity || '0', 10);
             if(num === 1) qtyDisplay = `1 ${t('unit_boxes').toLowerCase().slice(0,3)}`;
             else qtyDisplay = `${num} ${t('unit_boxes').toLowerCase()}`;
        } else if (task.quantityUnit === 'pallet') {
             const num = parseInt(task.quantity || '0', 10);
             if(num === 1) qtyDisplay = `1 ${t('unit_pallet').toLowerCase()}`;
             else qtyDisplay = `${num} ${t('unit_pallet').toLowerCase()}`;
        } else {
            qtyDisplay += ' ks';
        }

        let timeDisplay = '';
        if (task.createdAt) {
            const date = new Date(task.createdAt);
            timeDisplay = date.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
        }

        return {
            partNumber: task.partNumber,
            workplace: task.workplace || 'Nezadané',
            quantity: qtyDisplay,
            time: timeDisplay
        };
    }
    
    // 2. Fallback to Legacy Text Parsing
    const parts = task.text.split(' / ');
    
    const dateTimeRaw = parts[0]?.split(' ')[1] || ''; // Try to grab time
    const timeDisplay = dateTimeRaw.slice(0, 5); // HH:MM

    return {
        partNumber: parts[1] || '???',
        workplace: parts[2] || '???',
        quantity: (parts[3] || '').replace('Počet: ', ''),
        time: timeDisplay
    };
  };

  const formatDateTime = (timestamp?: number) => {
      if (!timestamp) return '-';
      return new Date(timestamp).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
  };


  return (
    <div className="space-y-4">
      {/* MISSING REASON MODAL */}
      {missingModalTaskId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-gray-600 animate-fade-in">
                  <h3 className="text-xl font-bold text-white mb-6 text-center">{t('modal_missing_title')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {missingReasons.map((reason) => (
                          <button
                            key={reason.id}
                            onClick={() => confirmMissingReason(reason.value)}
                            className="bg-gray-700 hover:bg-teal-700 text-white font-semibold py-4 px-2 rounded-lg transition-all duration-200 border border-gray-600 hover:border-teal-500"
                          >
                              {reason.value}
                          </button>
                      ))}
                      {missingReasons.length === 0 && (
                          <div className="col-span-2 text-center text-gray-400 italic">
                              {t('modal_no_reasons')}
                          </div>
                      )}
                  </div>
                  <button 
                    onClick={closeMissingModal}
                    className="mt-6 w-full py-3 bg-red-900/50 hover:bg-red-900 text-red-200 rounded-lg font-bold transition-colors"
                  >
                      {t('btn_cancel')}
                  </button>
              </div>
          </div>
      )}

      {/* NOTE MODAL */}
      {noteModalTaskId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-600 animate-fade-in">
                  <h3 className="text-xl font-bold text-white mb-4 text-center">{t('btn_note')}</h3>
                  <textarea 
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full h-32 bg-gray-700 border border-gray-600 rounded p-3 text-white focus:border-teal-500 outline-none"
                    placeholder="..."
                  />
                  <div className="flex gap-2 mt-4">
                      <button onClick={() => setNoteModalTaskId(null)} className="flex-1 bg-gray-600 text-white py-2 rounded">{t('btn_cancel')}</button>
                      <button onClick={saveNote} className="flex-1 bg-teal-600 text-white py-2 rounded">{t('btn_save')}</button>
                  </div>
              </div>
          </div>
      )}

      {tasks.map((task) => {
        const isEditing = editingTaskId === task.id;
        const isMissingLocked = task.isMissing && !isAdminOrSuper && !isLogistician; // User and Leader cannot un-mark
        const priority = task.priority || 'NORMAL';
        const isBlocked = task.isBlocked;
        const isIncorrect = task.status === 'incorrectly_entered';
        const displayData = getTaskDisplayData(task);
        
        // Background Logic
        let bgClass = '';
        if (isBlocked) {
             bgClass = 'bg-gray-800/80 border-2 border-dashed border-gray-500 relative overflow-hidden';
        } else if (task.isMissing) {
            bgClass = 'bg-red-900 border border-red-700';
        } else if (isIncorrect) {
            bgClass = 'bg-gray-900 border border-gray-700 opacity-70';
        } else if (task.isDone) {
            bgClass = 'bg-gray-900 border border-gray-800 opacity-60';
        } else if (task.isInProgress) {
             bgClass = 'bg-amber-900/40 border border-amber-600 shadow-md shadow-amber-900/20';
        } else {
            // Active Tasks
            if (priority === 'URGENT') {
                bgClass = 'bg-red-950 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
            } else if (priority === 'LOW') {
                bgClass = 'bg-slate-900 border border-slate-700';
            } else {
                bgClass = 'bg-blue-950 border border-blue-900 shadow-md';
            }
        }

        return (
          <div
            key={task.id}
            className={`flex flex-col sm:flex-row items-center sm:justify-between p-4 rounded-lg transition-all duration-300 ${bgClass}`}
          >
            {/* Blocked Overlay Icon */}
            {isBlocked && (
                 <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                     <LockIcon className="w-32 h-32 text-gray-100" />
                 </div>
            )}

            <div className="flex-1 w-full min-w-0 pr-4 relative z-10 mb-4 sm:mb-0">
                
                {/* Labels Row */}
                {!task.isDone && (
                    <div className="mb-2 flex gap-2 items-center">
                        {isBlocked && <span className="inline-block bg-gray-200 text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><LockIcon className="w-3 h-3"/> {t('status_inventory')}</span>}
                        {priority === 'URGENT' && <span className="inline-block bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">{t('status_urgent')}</span>}
                        {priority === 'LOW' && <span className="inline-block bg-gray-600 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded">{t('status_low')}</span>}
                    </div>
                )}

                {isEditing ? (
                  <div className="space-y-2">
                    <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        // LEADER cannot edit text, only priority
                        disabled={isLeader}
                        className={`w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono ${isLeader ? 'opacity-50 cursor-not-allowed' : ''}`}
                        autoFocus={!isLeader}
                    />
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400">{t('priority_label')}:</label>
                        <select 
                            value={editPriority} 
                            onChange={(e) => setEditPriority(e.target.value as PriorityLevel)}
                            className="bg-gray-700 text-white border border-gray-600 text-sm rounded px-2 py-1"
                        >
                            <option value="LOW">{t('prio_low')}</option>
                            <option value="NORMAL">{t('prio_normal')}</option>
                            <option value="URGENT">{t('prio_urgent')}</option>
                        </select>
                    </div>
                  </div>
                ) : (
                  /* --- TICKET DESIGN LAYOUT --- */
                  <div className="flex justify-between items-start w-full gap-4">
                      {/* Left Side: Part & Workplace */}
                      <div className="flex flex-col gap-1 min-w-0">
                          <span className={`text-2xl sm:text-3xl font-black tracking-wide break-words ${(task.isDone || isIncorrect) ? 'text-gray-500 line-through' : (isBlocked ? 'text-gray-400' : 'text-white')}`}>
                              {displayData.partNumber}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              <span className={`text-sm sm:text-base font-bold uppercase tracking-wider ${(task.isDone || isIncorrect) ? 'text-gray-600' : 'text-teal-400'}`}>
                                  {displayData.workplace}
                              </span>
                              {/* Task Note Bubble */}
                              {task.note && (
                                  <div 
                                    className="bg-yellow-100 text-yellow-900 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 max-w-[200px] truncate cursor-pointer"
                                    onClick={() => openNoteModal(task)}
                                    title={task.note}
                                  >
                                      <ChatIcon className="w-3 h-3" />
                                      {task.note}
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Right Side: Quantity & Time */}
                      <div className="flex flex-col items-end shrink-0">
                          <span className={`px-3 py-1 rounded-md font-bold text-lg sm:text-xl whitespace-nowrap mb-1 ${
                              (task.isDone || isIncorrect) 
                                  ? 'bg-gray-800 text-gray-500' 
                                  : 'bg-emerald-900/50 text-emerald-400 border border-emerald-600/50'
                          }`}>
                              {displayData.quantity}
                          </span>
                          <span className="text-sm text-gray-400 font-mono">
                              {displayData.time}
                          </span>
                      </div>
                  </div>
                )}

                {/* Status Footers */}
                {task.isDone && (
                    <div className={`mt-3 pt-2 border-t ${isIncorrect ? 'border-gray-700 text-red-400' : 'border-gray-800 text-gray-500'} text-xs font-mono space-y-1`}>
                        {isIncorrect ? (
                            <div className="flex items-center gap-2">
                                <IncorrectIcon className="w-4 h-4 text-red-400"/>
                                <span className="font-bold">{t('status_incorrect')}</span>
                                {task.completedBy && <span className="text-red-400 font-bold">{task.completedBy}</span>}
                                <span>• {task.completionTime}</span>
                            </div>
                        ) : (
                            /* DETAILED HISTORY FOR COMPLETED TASKS */
                            <>
                                {/* Created */}
                                <div className="flex gap-2">
                                    <span className="text-gray-600">📅 {t('task_created')}:</span>
                                    <span>
                                        <span className="font-semibold text-gray-400">{task.createdBy || '-'}</span> 
                                        {task.createdAt && <span className="opacity-70"> • {formatDateTime(task.createdAt)}</span>}
                                    </span>
                                </div>
                                {/* Completed */}
                                <div className="flex gap-2 text-teal-600/80">
                                    <span className="font-bold">✓ {t('task_completed_label')}:</span>
                                    <span>
                                        <span className="font-bold">{task.completedBy || '-'}</span>
                                        {task.completedAt && <span className="opacity-70"> • {formatDateTime(task.completedAt)}</span>}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                )}
                
                {task.isMissing && (
                     <div className="mt-3 pt-2 border-t border-red-800/50 text-red-200 font-mono">
                         <div className="flex items-center gap-2">
                            <ExclamationIcon className="w-5 h-5 text-red-400" />
                            <p className="text-sm font-bold">{t('status_missing')} ({task.missingReportedBy})</p>
                         </div>
                         {task.missingReason && <p className="text-xs bg-red-950/80 inline-block px-2 py-1 rounded mt-1 border border-red-800 ml-7">{task.missingReason}</p>}
                     </div>
                )}
                
                {!task.isDone && task.isInProgress && (
                    <div className="mt-3 pt-2 border-t border-amber-800/50 flex items-center gap-2 text-amber-400 font-bold font-mono animate-pulse">
                        <PlayIcon className="w-4 h-4"/>
                        <span className="text-sm">{t('status_resolving')} {task.inProgressBy}</span>
                    </div>
                )}
            </div>
            
            {/* BUTTONS COLUMN */}
            <div className="flex items-center w-full sm:w-auto justify-end gap-3 sm:gap-4 shrink-0 self-center z-10">
              {isEditing ? (
                <>
                  <button
                    onClick={() => saveEditing(task.id)}
                    className="p-4 bg-green-700 hover:bg-green-600 rounded-lg text-white"
                    title={t('btn_save')}
                  >
                    <CheckIcon className="w-6 h-6" />
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
                    title={t('btn_cancel')}
                  >
                    <XIcon className="w-6 h-6" />
                  </button>
                </>
              ) : (
                <>
                  {/* Inventory Lock - ADMIN/SUPERVISOR ONLY */}
                  {isAdminOrSuper && !task.isDone && (
                      <button
                        onClick={() => onToggleBlock(task.id)}
                        className={`p-4 rounded-lg transition-all duration-200 focus:outline-none w-14 sm:w-16 flex items-center justify-center ${
                            isBlocked 
                            ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                        }`}
                        title={isBlocked ? t('btn_finish') : t('status_inventory')}
                      >
                          {isBlocked ? <UnlockIcon className="w-8 h-8"/> : <LockIcon className="w-8 h-8"/>}
                      </button>
                  )}

                  {!task.isDone && !isBlocked && !isLeader && (
                    <>
                       {/* In Progress */}
                       {canSetProgress && (
                           <>
                            {task.isInProgress ? (
                                <div className="flex gap-2">
                                    {/* Stop/Return Button */}
                                    <button 
                                        onClick={() => onReleaseTask(task.id)}
                                        className="p-4 rounded-lg bg-red-900/50 hover:bg-red-800 text-red-200 w-14 sm:w-16 flex items-center justify-center"
                                        title={t('btn_stop')}
                                    >
                                        <StopIcon className="w-8 h-8" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => onSetInProgress(task.id)}
                                    className="p-4 rounded-lg transition-all duration-200 bg-gray-700 hover:bg-gray-600 text-amber-500 w-14 sm:w-16 flex items-center justify-center"
                                    title={t('status_resolving')}
                                >
                                    <PlayIcon className="w-8 h-8" />
                                </button>
                            )}
                           </>
                       )}

                       {/* Missing */}
                       <button
                          onClick={() => {
                              if(isMissingLocked) return;
                              if (task.isMissing) onToggleMissing(task.id);
                              else openMissingModal(task.id);
                          }}
                          disabled={isMissingLocked}
                          className={`p-4 rounded-lg transition-all duration-200 w-14 sm:w-16 flex items-center justify-center ${
                              task.isMissing 
                              ? (isMissingLocked ? 'bg-red-900/50 text-white/50 cursor-not-allowed' : 'bg-red-900/50 text-white/50 cursor-not-allowed')
                              : 'bg-gray-700 text-yellow-500 hover:bg-gray-600'
                          }`}
                          title={t('status_missing')}
                        >
                            <ExclamationIcon className="w-8 h-8" />
                        </button>

                      {/* Copy */}
                        <button
                          onClick={() => handleCopyPartNumber(displayData.partNumber, task.id)}
                          className={`p-4 rounded-lg transition-all duration-200 w-14 sm:w-16 flex items-center justify-center ${
                            copiedTaskId === task.id
                              ? 'bg-green-600 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                          title={t('btn_copy')}
                        >
                          {copiedTaskId === task.id ? (
                            <span className="text-xs font-bold animate-pulse">{t('copied_msg')}</span>
                          ) : (
                            <CopyIcon className="w-8 h-8" />
                          )}
                        </button>
                      
                      {/* Finish */}
                      {canFinish && (
                          <button
                              onClick={() => onToggleTask(task.id)}
                              className="p-4 rounded-lg transition-all duration-200 bg-teal-600 hover:bg-teal-700 text-white w-14 sm:w-16 flex items-center justify-center"
                              title={t('btn_finish')}
                          >
                              <CheckIcon className="w-8 h-8" />
                          </button>
                      )}
                    </>
                  )}

                  {/* LEADER: Mark as Incorrect */}
                  {isLeader && !task.isDone && !isBlocked && (
                     <button
                        onClick={() => onMarkAsIncorrect(task.id)}
                        className="p-4 rounded-lg transition-all duration-200 bg-red-900 hover:bg-red-800 text-red-200 w-14 sm:w-16 flex items-center justify-center"
                        title={t('btn_mark_incorrect')}
                     >
                        <IncorrectIcon className="w-8 h-8" />
                     </button>
                  )}

                  {/* Edit/Delete Actions */}
                  {canEdit && (
                    <div className="flex flex-col gap-2 ml-1">
                        {!task.isDone && (
                            <button
                                onClick={() => openNoteModal(task)}
                                className="text-gray-500 hover:text-yellow-400 transition-colors duration-200 p-2 rounded-full hover:bg-gray-700"
                                title={t('btn_note')}
                            >
                                <ChatIcon className="h-6 w-6" />
                            </button>
                        )}
                        <button
                            onClick={() => startEditing(task)}
                            className="text-gray-500 hover:text-blue-400 transition-colors duration-200 p-2 rounded-full hover:bg-gray-700"
                        >
                            <PencilIcon className="h-6 w-6" />
                        </button>
                        {canDelete && (
                            <button
                                onClick={() => onDeleteTask(task.id)}
                                className="text-gray-500 hover:text-red-500 transition-colors duration-200 p-2 rounded-full hover:bg-gray-700"
                            >
                                <TrashIcon className="h-6 w-6" />
                            </button>
                        )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TaskList;
