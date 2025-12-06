

import React, { useState } from 'react';
import { UserData, DBItem, PartRequest } from '../App';
import { useLanguage } from './LanguageContext';

interface SettingsTabProps {
  currentUserRole: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER';
  users: UserData[];
  onAddUser: (user: UserData) => void;
  onUpdatePassword: (username: string, newPass: string) => void;
  onUpdateUserRole: (username: string, newRole: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER') => void;
  onDeleteUser: (username: string) => void;
  // DB Props
  parts: DBItem[];
  workplaces: DBItem[];
  missingReasons: DBItem[];
  onAddPart: (val: string) => void;
  onBatchAddParts: (vals: string[]) => void;
  onDeletePart: (id: string) => void;
  onDeleteAllParts: () => void;
  onAddWorkplace: (val: string, time?: number) => void;
  onBatchAddWorkplaces: (vals: string[]) => void;
  onDeleteWorkplace: (id: string) => void;
  onDeleteAllWorkplaces: () => void;
  onAddMissingReason: (val: string) => void;
  onDeleteMissingReason: (id: string) => void;
  // Requests
  partRequests: PartRequest[];
  onApprovePartRequest: (req: PartRequest) => void;
  onRejectPartRequest: (id: string) => void;
  // Archive
  onArchiveTasks: () => Promise<{ success: boolean; count?: number; error?: string; message?: string }>;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ 
  currentUserRole,
  users, onAddUser, onUpdatePassword, onUpdateUserRole, onDeleteUser,
  parts, workplaces, missingReasons, onAddPart, onBatchAddParts, onDeletePart, onDeleteAllParts,
  onAddWorkplace, onBatchAddWorkplaces, onDeleteWorkplace, onDeleteAllWorkplaces,
  onAddMissingReason, onDeleteMissingReason,
  partRequests, onApprovePartRequest, onRejectPartRequest, onArchiveTasks
}) => {
  // User State
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<'USER' | 'ADMIN' | 'SUPERVISOR' | 'LEADER'>('USER');
  const [userError, setUserError] = useState('');
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});

  // DB State
  const [newPart, setNewPart] = useState('');
  const [bulkParts, setBulkParts] = useState('');
  const [newWorkplace, setNewWorkplace] = useState('');
  const [newWorkplaceTime, setNewWorkplaceTime] = useState(''); // New time input
  const [bulkWorkplaces, setBulkWorkplaces] = useState('');
  const [newMissingReason, setNewMissingReason] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  const { t } = useLanguage();

  const isAdmin = currentUserRole === 'ADMIN';

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- User Handlers ---
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.trim() || !newPass.trim()) { setUserError(t('user_fill')); return; }
    if (users.some(u => u.username.toUpperCase() === newUser.toUpperCase())) { setUserError(t('user_exists')); return; }
    onAddUser({ username: newUser, password: newPass, role: newRole });
    setNewUser(''); setNewPass(''); setUserError('');
    showSuccess(`Užívateľ ${newUser} bol pridaný.`);
  };

  const handleSavePassword = (username: string) => {
    const pass = passwordInputs[username];
    if (!pass?.trim()) return;
    onUpdatePassword(username, pass);
    setPasswordInputs(prev => ({ ...prev, [username]: '' }));
    showSuccess(`Heslo pre ${username} bolo zmenené.`);
  };

  // --- DB Handlers ---
  const handleAddSinglePart = (e: React.FormEvent) => {
    e.preventDefault();
    if(newPart.trim()) {
      onAddPart(newPart.trim());
      setNewPart('');
      showSuccess('Diel pridaný.');
    }
  };

  const handleBulkAddParts = () => {
    const lines = bulkParts.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length > 0) {
      onBatchAddParts(lines);
      setBulkParts('');
      showSuccess(`${lines.length} dielov pridaných.`);
    }
  };

  const handleDeleteAllPartsConfirm = () => {
      if (window.confirm("Naozaj chcete vymazať VŠETKY diely z databázy? Táto akcia je nevratná.")) {
          onDeleteAllParts();
          showSuccess("Všetky diely boli vymazané.");
      }
  };

  const handleAddSingleWP = (e: React.FormEvent) => {
    e.preventDefault();
    if(newWorkplace.trim()) {
      const time = parseInt(newWorkplaceTime, 10);
      onAddWorkplace(newWorkplace.trim(), isNaN(time) ? 0 : time);
      setNewWorkplace('');
      setNewWorkplaceTime('');
      showSuccess('Pracovisko pridané.');
    }
  };

  const handleBulkAddWP = () => {
    const lines = bulkWorkplaces.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length > 0) {
      onBatchAddWorkplaces(lines);
      setBulkWorkplaces('');
      showSuccess(`${lines.length} pracovísk pridaných.`);
    }
  };

  const handleDeleteAllWPConfirm = () => {
      if (window.confirm("Naozaj chcete vymazať VŠETKY pracoviská z databázy? Táto akcia je nevratná.")) {
          onDeleteAllWorkplaces();
          showSuccess("Všetky pracoviská boli vymazané.");
      }
  };
  
  const handleAddReason = (e: React.FormEvent) => {
      e.preventDefault();
      if(newMissingReason.trim()) {
          onAddMissingReason(newMissingReason.trim());
          setNewMissingReason('');
          showSuccess('Dôvod pridaný.');
      }
  };
  
  const handleRunArchiving = async () => {
      if (window.confirm("Spustiť archiváciu?")) {
          setIsArchiving(true);
          const result = await onArchiveTasks();
          setIsArchiving(false);
          
          if (result.success) {
              if (result.count === 0 && result.message) {
                   alert(result.message);
              } else {
                   alert(`Archivácia úspešná. Presunutých ${result.count} starých úloh.`);
              }
          } else {
              alert(`Chyba pri archivácii: ${result.error}`);
          }
      }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-8">
      {successMsg && (
        <div className="fixed top-4 right-4 bg-green-600 text-white p-4 rounded-lg shadow-xl z-50 animate-bounce">
          {successMsg}
        </div>
      )}

      {/* REQUESTS SECTION (Before users) */}
      <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-yellow-700/50">
          <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
              <h2 className="text-xl font-bold text-yellow-400">{t('req_title')}</h2>
              {partRequests.length > 0 && (
                  <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full animate-pulse">{partRequests.length} {t('req_waiting')}</span>
              )}
          </div>
          
          {partRequests.length > 0 ? (
              <div className="space-y-3">
                  {partRequests.map(req => (
                      <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-800 p-4 rounded-lg border border-gray-700">
                          <div>
                              <p className="font-bold text-white text-lg font-mono">{req.partNumber}</p>
                              <p className="text-xs text-gray-400">
                                  Žiada: <span className="text-teal-400">{req.requestedBy}</span> • {new Date(req.requestedAt).toLocaleString()}
                              </p>
                          </div>
                          <div className="flex gap-2 mt-3 sm:mt-0">
                               <button 
                                  onClick={() => onApprovePartRequest(req)}
                                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"
                                >
                                    ✓ {t('req_approve')}
                                </button>
                                <button 
                                  onClick={() => onRejectPartRequest(req.id)}
                                  className="bg-red-900 hover:bg-red-700 text-red-200 px-4 py-2 rounded text-sm font-bold"
                                >
                                    ✕ {t('req_reject')}
                                </button>
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              <p className="text-gray-500 italic text-center py-4">{t('no_requests')}</p>
          )}
      </div>


      {/* 1. SECTION: USERS */}
      <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-700">
        <h2 className="text-xl font-bold text-teal-400 mb-6 border-b border-gray-700 pb-2">{t('sect_users')}</h2>
        
        {/* User List */}
        <div className="space-y-4 mb-8">
          {users.map((user) => {
             const isTargetAdmin = user.role === 'ADMIN';
             const canEdit = isAdmin || !isTargetAdmin;

             return (
              <div key={user.username} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-800 p-4 rounded-lg gap-4">
                <div className="flex items-center gap-3 min-w-[150px]">
                  <div className={`w-3 h-3 rounded-full ${user.role === 'ADMIN' ? 'bg-red-500' : user.role === 'SUPERVISOR' ? 'bg-purple-500' : user.role === 'LEADER' ? 'bg-yellow-500' : 'bg-teal-500'}`}></div>
                  <div>
                    <p className="font-bold text-white">{user.username}</p>
                    {/* Role Dropdown for ADMIN */}
                    {isAdmin && user.username !== 'ADMIN' ? (
                       <select
                          value={user.role}
                          onChange={(e) => onUpdateUserRole(user.username, e.target.value as any)}
                          className="mt-1 text-xs bg-gray-700 text-white border border-gray-600 rounded focus:border-teal-500 focus:outline-none cursor-pointer"
                       >
                           <option value="USER">USER</option>
                           <option value="LEADER">LEADER</option>
                           <option value="SUPERVISOR">SUPERVISOR</option>
                           <option value="ADMIN">ADMIN</option>
                       </select>
                    ) : (
                       <p className="text-xs text-gray-500">{user.role}</p>
                    )}
                  </div>
                </div>
                
                {canEdit && (
                  <div className="flex flex-1 gap-2 items-center">
                    <input 
                      type="text" 
                      placeholder="Nové heslo"
                      value={passwordInputs[user.username] || ''}
                      onChange={(e) => setPasswordInputs(p => ({ ...p, [user.username]: e.target.value }))}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                    <button onClick={() => handleSavePassword(user.username)} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm font-semibold">{t('btn_save')}</button>
                    {user.username !== 'ADMIN' && (
                      <button onClick={() => onDeleteUser(user.username)} className="bg-red-900 hover:bg-red-700 text-red-100 px-3 py-2 rounded text-sm">X</button>
                    )}
                  </div>
                )}
                {!canEdit && (
                  <div className="flex-1 text-right text-gray-500 text-sm italic pr-4">
                    {t('no_perm_user')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add User Form */}
        <form onSubmit={handleAddUser} className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-gray-300 text-sm font-bold mb-3 uppercase">{t('user_add_title')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div><input value={newUser} onChange={e => setNewUser(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" placeholder={t('user_name')} /></div>
            <div><input value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" placeholder={t('user_pass')} /></div>
            <div>
              <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white">
                <option value="USER">USER</option>
                <option value="LEADER">LEADER</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                {isAdmin && <option value="ADMIN">ADMIN</option>}
              </select>
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold">{t('user_add_btn')}</button>
          </div>
          {userError && <p className="text-red-400 text-sm mt-2">{userError}</p>}
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 2. SECTION: PARTS */}
        <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
              <h2 className="text-xl font-bold text-teal-400">{t('sect_parts')}</h2>
              {isAdmin && parts.length > 0 && (
                  <button onClick={handleDeleteAllPartsConfirm} className="text-xs bg-red-900 hover:bg-red-800 text-red-100 px-3 py-1 rounded">{t('delete_all')}</button>
              )}
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-60 bg-gray-800 rounded mb-4 p-2 space-y-1 custom-scrollbar">
            {parts.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">
                <span className="text-sm font-mono">{item.value}</span>
                {isAdmin && <button onClick={() => onDeletePart(item.id)} className="text-red-400 hover:text-red-200">×</button>}
              </div>
            ))}
          </div>

          {isAdmin && (
            <>
              <form onSubmit={handleAddSinglePart} className="flex gap-2 mb-4">
                <input value={newPart} onChange={e => setNewPart(e.target.value)} placeholder={t('new_part_place')} className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded text-sm">{t('add_single')}</button>
              </form>

              <div className="mt-auto pt-4 border-t border-gray-700">
                <label className="text-xs text-gray-400 mb-1 block">{t('bulk_label')}</label>
                <textarea 
                  value={bulkParts}
                  onChange={e => setBulkParts(e.target.value)}
                  className="w-full h-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-xs font-mono"
                  placeholder={`33233295\n25874265\n...`}
                />
                <button onClick={handleBulkAddParts} className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm">{t('bulk_btn_parts')}</button>
              </div>
            </>
          )}
        </div>

        {/* 3. SECTION: WORKPLACES */}
        <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
              <h2 className="text-xl font-bold text-teal-400">{t('sect_wp')}</h2>
              {isAdmin && workplaces.length > 0 && (
                  <button onClick={handleDeleteAllWPConfirm} className="text-xs bg-red-900 hover:bg-red-800 text-red-100 px-3 py-1 rounded">{t('delete_all')}</button>
              )}
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-60 bg-gray-800 rounded mb-4 p-2 space-y-1 custom-scrollbar">
            {workplaces.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">
                <span className="text-sm font-mono">{item.value} {item.standardTime ? <span className="text-blue-300">({item.standardTime} min)</span> : ''}</span>
                {isAdmin && <button onClick={() => onDeleteWorkplace(item.id)} className="text-red-400 hover:text-red-200">×</button>}
              </div>
            ))}
          </div>

          {isAdmin && (
            <>
              <form onSubmit={handleAddSingleWP} className="flex gap-2 mb-4">
                <input value={newWorkplace} onChange={e => setNewWorkplace(e.target.value)} placeholder={t('new_wp_place')} className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                <input type="number" min="0" value={newWorkplaceTime} onChange={e => setNewWorkplaceTime(e.target.value)} placeholder="min" className="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-2 text-white text-sm text-center" />
                <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded text-sm">{t('add_single')}</button>
              </form>

              <div className="mt-auto pt-4 border-t border-gray-700">
                <label className="text-xs text-gray-400 mb-1 block">{t('bulk_label')}</label>
                <p className="text-[10px] text-gray-500 mb-1">Format: Name;Minutes (e.g., PRESS-01;5)</p>
                <textarea 
                  value={bulkWorkplaces}
                  onChange={e => setBulkWorkplaces(e.target.value)}
                  className="w-full h-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-xs font-mono"
                  placeholder={`LISOVŇA;5\nLAKOVŇA;10\n...`}
                />
                <button onClick={handleBulkAddWP} className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm">{t('bulk_btn_wp')}</button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* 4. SECTION: MISSING REASONS */}
      {isAdmin && (
          <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-700">
              <h2 className="text-xl font-bold text-teal-400 mb-6 border-b border-gray-700 pb-2">{t('sect_reasons')}</h2>
              <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1">
                      <div className="bg-gray-800 rounded p-4 mb-4 space-y-2">
                          {missingReasons.map(r => (
                              <div key={r.id} className="flex justify-between items-center bg-gray-700 px-3 py-2 rounded">
                                  <span className="text-white">{r.value}</span>
                                  <button onClick={() => onDeleteMissingReason(r.id)} className="text-red-400 hover:text-red-200">×</button>
                              </div>
                          ))}
                          {missingReasons.length === 0 && <p className="text-gray-500 italic text-sm">Žiadne dôvody.</p>}
                      </div>
                  </div>
                  <div className="md:w-1/3">
                      <form onSubmit={handleAddReason} className="flex gap-2">
                          <input 
                              value={newMissingReason} 
                              onChange={e => setNewMissingReason(e.target.value)} 
                              placeholder={t('new_reason_place')}
                              className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                          />
                          <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded text-sm">{t('add_single')}</button>
                      </form>
                      <p className="text-xs text-gray-400 mt-2">
                          {t('reason_hint')}
                      </p>
                  </div>
              </div>
          </div>
      )}

       {/* 5. SECTION: MAINTENANCE (Archive & DB Link) */}
       {isAdmin && (
        <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-red-900/50">
             <h2 className="text-xl font-bold text-red-400 mb-4 border-b border-gray-700 pb-2">{t('sect_maint')}</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                    <p className="text-gray-400 text-sm mb-4">
                        {t('maint_desc')}
                        <br />
                        <strong>{t('maint_info')}</strong>
                    </p>
                    <button 
                        onClick={handleRunArchiving} 
                        disabled={isArchiving}
                        className={`bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 ${isArchiving ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        {isArchiving ? t('archiving') : t('archive_btn')}
                    </button>
                </div>
                <div className="border-t md:border-t-0 md:border-l border-gray-700 pt-4 md:pt-0 md:pl-6">
                    <p className="text-gray-400 text-sm mb-4">
                        {t('sect_maint_db_desc')}
                    </p>
                     <a 
                        href="https://console.firebase.google.com/project/sklad-ulohy/firestore/data"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-blue-800 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                     >
                        {t('sect_maint_db_link')}
                     </a>
                </div>
             </div>
        </div>
       )}

       {/* Footer Credit */}
       <div className="pt-8 pb-4 text-center text-xs text-gray-600 border-t border-gray-800">
           <p>Clamason Task Manager v1.2</p>
           <p className="mt-1">{t('created_by')}</p>
       </div>

    </div>
  );
};

export default SettingsTab;