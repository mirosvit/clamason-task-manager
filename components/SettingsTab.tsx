

import React, { useState } from 'react';
import { UserData, DBItem, PartRequest, BreakSchedule, BOMItem, BOMRequest, Role, Permission } from '../App';
import { useLanguage } from './LanguageContext';

interface SettingsTabProps {
  currentUserRole: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER' | 'LOGISTICIAN';
  users: UserData[];
  onAddUser: (user: UserData) => void;
  onUpdatePassword: (username: string, newPass: string) => void;
  onUpdateUserRole: (username: string, newRole: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER' | 'LOGISTICIAN') => void;
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
  // Breaks
  breakSchedules: BreakSchedule[];
  onAddBreakSchedule: (start: string, end: string) => void;
  onDeleteBreakSchedule: (id: string) => void;
  // BOM
  bomItems?: BOMItem[];
  bomRequests?: BOMRequest[];
  onAddBOMItem?: (parent: string, child: string, qty: number) => void;
  onBatchAddBOMItems?: (vals: string[]) => void;
  onDeleteBOMItem?: (id: string) => void;
  onDeleteAllBOMItems?: () => void;
  onApproveBOMRequest?: (req: BOMRequest) => void;
  onRejectBOMRequest?: (id: string) => void;
  // Roles
  roles?: Role[];
  permissions?: Permission[];
  onAddRole?: (name: string) => void;
  onDeleteRole?: (id: string) => void;
  onUpdatePermission?: (permissionId: string, roleName: string, hasPermission: boolean) => void;
  // PWA
  installPrompt: any;
  onInstallApp: () => void;
}

const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const SettingsTab: React.FC<SettingsTabProps> = ({ 
  currentUserRole,
  users, onAddUser, onUpdatePassword, onUpdateUserRole, onDeleteUser,
  parts, workplaces, missingReasons, onAddPart, onBatchAddParts, onDeletePart, onDeleteAllParts,
  onAddWorkplace, onBatchAddWorkplaces, onDeleteWorkplace, onDeleteAllWorkplaces,
  onAddMissingReason, onDeleteMissingReason,
  partRequests, onApprovePartRequest, onRejectPartRequest, onArchiveTasks,
  breakSchedules, onAddBreakSchedule, onDeleteBreakSchedule,
  bomItems, bomRequests, onAddBOMItem, onBatchAddBOMItems, onDeleteBOMItem, onDeleteAllBOMItems, onApproveBOMRequest, onRejectBOMRequest,
  roles, permissions, onAddRole, onDeleteRole, onUpdatePermission,
  installPrompt, onInstallApp
}) => {
  // User State
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<'USER' | 'ADMIN' | 'SUPERVISOR' | 'LEADER' | 'LOGISTICIAN'>('USER');
  const [userError, setUserError] = useState('');
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // DB State
  const [newPart, setNewPart] = useState('');
  const [bulkParts, setBulkParts] = useState('');
  const [partSearch, setPartSearch] = useState('');
  
  const [newWorkplace, setNewWorkplace] = useState('');
  const [newWorkplaceTime, setNewWorkplaceTime] = useState('');
  const [bulkWorkplaces, setBulkWorkplaces] = useState('');
  const [wpSearch, setWpSearch] = useState('');

  const [newMissingReason, setNewMissingReason] = useState('');
  const [reasonSearch, setReasonSearch] = useState('');

  const [successMsg, setSuccessMsg] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  
  // Break State
  const [newBreakStart, setNewBreakStart] = useState('');
  const [newBreakEnd, setNewBreakEnd] = useState('');

  // BOM State
  const [bomParent, setBomParent] = useState('');
  const [bomChild, setBomChild] = useState('');
  const [bomQty, setBomQty] = useState('');
  const [bomBulk, setBomBulk] = useState('');
  const [bomSearchQuery, setBomSearchQuery] = useState('');

  // Roles State
  const [newRoleName, setNewRoleName] = useState('');

  const { t } = useLanguage();

  const isAdmin = currentUserRole === 'ADMIN';
  const isSuper = currentUserRole === 'SUPERVISOR';
  const isLogistician = currentUserRole === 'LOGISTICIAN';
  const canManageDB = isAdmin || isLogistician;

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- Filter Helpers ---
  const filteredParts = parts.filter(p => p.value.toLowerCase().includes(partSearch.toLowerCase()));
  const filteredWorkplaces = workplaces.filter(w => w.value.toLowerCase().includes(wpSearch.toLowerCase()));
  const filteredReasons = missingReasons.filter(r => r.value.toLowerCase().includes(reasonSearch.toLowerCase()));

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

  const togglePasswordVisibility = (username: string) => {
      setVisiblePasswords(prev => ({ ...prev, [username]: !prev[username] }));
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
      if (window.confirm("Naozaj chcete vymazať VŠETKY diely?")) {
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
      if (window.confirm("Naozaj chcete vymazať VŠETKY pracoviská?")) {
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

  const handleAddBreak = (e: React.FormEvent) => {
      e.preventDefault();
      if (newBreakStart && newBreakEnd) {
          onAddBreakSchedule(newBreakStart, newBreakEnd);
          setNewBreakStart('');
          setNewBreakEnd('');
          showSuccess('Prestávka pridaná.');
      }
  };

  const handleAddBOM = (e: React.FormEvent) => {
      e.preventDefault();
      if(bomParent && bomChild && bomQty) {
          if (onAddBOMItem) onAddBOMItem(bomParent, bomChild, parseFloat(bomQty));
          setBomParent(''); setBomChild(''); setBomQty('');
          showSuccess('BOM väzba pridaná.');
      }
  };

  const handleBulkAddBOM = () => {
      const lines = bomBulk.split('\n').map(l => l.trim()).filter(l => l !== '');
      if (lines.length > 0 && onBatchAddBOMItems) {
          onBatchAddBOMItems(lines);
          setBomBulk('');
          showSuccess(`${lines.length} BOM väzieb pridaných.`);
      }
  }

  const handleDeleteAllBOMConfirm = () => {
      if (window.confirm("Naozaj chcete vymazať VŠETKY položky BOM?")) {
          if (onDeleteAllBOMItems) onDeleteAllBOMItems();
          showSuccess("Všetky BOM položky boli vymazané.");
      }
  }

  const handleAddRole = (e: React.FormEvent) => {
      e.preventDefault();
      if (newRoleName.trim() && onAddRole) {
          onAddRole(newRoleName.trim());
          setNewRoleName('');
          showSuccess('Rola vytvorená.');
      }
  };

  const filteredBOMItems = bomItems?.filter(item => 
      item.parentPart.toLowerCase().includes(bomSearchQuery.toLowerCase()) || 
      item.childPart.toLowerCase().includes(bomSearchQuery.toLowerCase())
  );

  // Grouped Permissions
  const permGroups = [
      {
          name: 'perm_group_tabs',
          perms: ['perm_tab_entry', 'perm_tab_tasks', 'perm_tab_bom', 'perm_tab_analytics', 'perm_tab_settings', 'perm_tab_missing']
      },
      {
          name: 'perm_group_actions',
          perms: ['perm_btn_finish', 'perm_btn_edit', 'perm_btn_delete', 'perm_btn_resolve', 'perm_btn_missing', 'perm_btn_copy', 'perm_btn_note', 'perm_btn_incorrect', 'perm_view_fullscreen', 'perm_play_sound', 'perm_view_passwords']
      },
      {
          name: 'perm_group_mgmt',
          perms: ['perm_manage_users', 'perm_manage_db', 'perm_manage_bom', 'perm_archive', 'perm_manage_breaks']
      }
  ];

  const hasPermission = (roleId: string, permName: string) => {
      return permissions?.some(p => p.roleId === roleId && p.permissionName === permName) || false;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-8">
      {successMsg && <div className="fixed top-4 right-4 bg-green-600 text-white p-4 rounded-lg shadow-xl z-50 animate-bounce">{successMsg}</div>}

      {/* REQUESTS */}
      <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-yellow-700/50">
          <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
              <h2 className="text-xl font-bold text-yellow-400">{t('req_title')}</h2>
              {partRequests.length > 0 && <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full animate-pulse">{partRequests.length} {t('req_waiting')}</span>}
          </div>
          {partRequests.length > 0 ? (
              <div className="space-y-3">
                  {partRequests.map(req => (
                      <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-800 p-4 rounded-lg border border-gray-700">
                          <div><p className="font-bold text-white text-lg font-mono">{req.partNumber}</p></div>
                          <div className="flex gap-2 mt-3 sm:mt-0">
                               <button onClick={() => onApprovePartRequest(req)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold">✓ {t('req_approve')}</button>
                               <button onClick={() => onRejectPartRequest(req.id)} className="bg-red-900 hover:bg-red-700 text-red-200 px-4 py-2 rounded text-sm font-bold">✕ {t('req_reject')}</button>
                          </div>
                      </div>
                  ))}
              </div>
          ) : <p className="text-gray-500 italic text-center py-4">{t('no_requests')}</p>}
      </div>

      {/* 1. USERS */}
      <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-700">
        {/* FIX: Use correct translation key 'sect_users_manage' instead of 'sect_users'. */}
        <h2 className="text-xl font-bold text-teal-400 mb-6 border-b border-gray-700 pb-2">{t('sect_users_manage')}</h2>
        <div className="space-y-4 mb-8">
          {users.map((user) => (
              <div key={user.username} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-800 p-4 rounded-lg gap-4">
                <div className="flex items-center gap-3 min-w-[150px]">
                  <div className={`w-3 h-3 rounded-full ${user.role === 'ADMIN' ? 'bg-red-500' : 'bg-teal-500'}`}></div>
                  <div>
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-white">{user.username}</p>
                        {isAdmin && (
                            <button onClick={() => togglePasswordVisibility(user.username)} className="text-gray-500 hover:text-white"><EyeIcon className="w-4 h-4" /></button>
                        )}
                    </div>
                    {visiblePasswords[user.username] && <p className="text-xs text-yellow-400 font-mono mt-1">{user.password}</p>}
                    {isAdmin && user.username !== 'ADMIN' ? (
                       <select value={user.role} onChange={(e) => onUpdateUserRole(user.username, e.target.value as any)} className="mt-1 text-xs bg-gray-700 text-white border border-gray-600 rounded">
                           {roles?.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                       </select>
                    ) : <p className="text-xs text-gray-500">{user.role}</p>}
                  </div>
                </div>
                {(isAdmin || user.username !== 'ADMIN') && (
                  <div className="flex flex-1 gap-2 items-center">
                    <input type="text" placeholder="Nové heslo" value={passwordInputs[user.username] || ''} onChange={(e) => setPasswordInputs(p => ({ ...p, [user.username]: e.target.value }))} className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white" />
                    <button onClick={() => handleSavePassword(user.username)} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm font-semibold">{t('btn_save')}</button>
                    {user.username !== 'ADMIN' && <button onClick={() => onDeleteUser(user.username)} className="bg-red-900 hover:bg-red-700 text-red-100 px-3 py-2 rounded text-sm">X</button>}
                  </div>
                )}
              </div>
          ))}
        </div>
        <form onSubmit={handleAddUser} className="bg-gray-800 p-4 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div><input value={newUser} onChange={e => setNewUser(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" placeholder={t('user_name')} /></div>
            <div><input value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" placeholder={t('user_pass')} /></div>
            <div>
              <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white">
                {roles?.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold">{t('user_add_btn')}</button>
          </div>
          {userError && <p className="text-red-400 text-sm mt-2">{userError}</p>}
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 2. PARTS */}
        <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
              <h2 className="text-xl font-bold text-teal-400">{t('sect_parts')}</h2>
              {canManageDB && parts.length > 0 && <button onClick={handleDeleteAllPartsConfirm} className="text-xs bg-red-900 hover:bg-red-800 text-red-100 px-3 py-1 rounded">{t('delete_all')}</button>}
          </div>
          <div className="mb-2 relative"><SearchIcon className="absolute top-2 left-2 w-4 h-4 text-gray-500"/><input value={partSearch} onChange={e=>setPartSearch(e.target.value)} className="w-full pl-8 pr-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white" placeholder={t('search_db_placeholder')} /></div>
          <div className="flex-1 overflow-y-auto max-h-60 bg-gray-800 rounded mb-4 p-2 space-y-1 custom-scrollbar">
            {filteredParts.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">
                <span className="text-sm font-mono">{item.value}</span>
                {canManageDB && <button onClick={() => onDeletePart(item.id)} className="text-red-400 hover:text-red-200">×</button>}
              </div>
            ))}
          </div>
          {canManageDB && (
            <>
              <form onSubmit={handleAddSinglePart} className="flex gap-2 mb-4">
                <input value={newPart} onChange={e => setNewPart(e.target.value)} placeholder={t('new_part_place')} className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded text-sm">{t('add_single')}</button>
              </form>
              <div className="mt-auto pt-4 border-t border-gray-700">
                <textarea value={bulkParts} onChange={e => setBulkParts(e.target.value)} className="w-full h-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-xs font-mono" placeholder="Bulk..." />
                <button onClick={handleBulkAddParts} className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm">{t('bulk_btn_parts')}</button>
              </div>
            </>
          )}
        </div>

        {/* 3. WORKPLACES */}
        <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-700 flex flex-col h-full">
          <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
              <h2 className="text-xl font-bold text-teal-400">{t('sect_wp')}</h2>
              {canManageDB && workplaces.length > 0 && <button onClick={handleDeleteAllWPConfirm} className="text-xs bg-red-900 hover:bg-red-800 text-red-100 px-3 py-1 rounded">{t('delete_all')}</button>}
          </div>
          <div className="mb-2 relative"><SearchIcon className="absolute top-2 left-2 w-4 h-4 text-gray-500"/><input value={wpSearch} onChange={e=>setWpSearch(e.target.value)} className="w-full pl-8 pr-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white" placeholder={t('search_db_placeholder')} /></div>
          <div className="flex-1 overflow-y-auto max-h-60 bg-gray-800 rounded mb-4 p-2 space-y-1 custom-scrollbar">
            {filteredWorkplaces.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">
                <span className="text-sm font-mono">{item.value} {item.standardTime ? `(${item.standardTime} min)` : ''}</span>
                {canManageDB && <button onClick={() => onDeleteWorkplace(item.id)} className="text-red-400 hover:text-red-200">×</button>}
              </div>
            ))}
          </div>
          {canManageDB && (
            <>
              <form onSubmit={handleAddSingleWP} className="flex gap-2 mb-4">
                <input value={newWorkplace} onChange={e => setNewWorkplace(e.target.value)} placeholder={t('new_wp_place')} className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
                <input type="number" value={newWorkplaceTime} onChange={e => setNewWorkplaceTime(e.target.value)} placeholder="min" className="w-16 bg-gray-700 border border-gray-600 rounded text-white text-center" />
                <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded text-sm">{t('add_single')}</button>
              </form>
              <div className="mt-auto pt-4 border-t border-gray-700">
                <textarea value={bulkWorkplaces} onChange={e => setBulkWorkplaces(e.target.value)} className="w-full h-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-xs font-mono" placeholder="Bulk..." />
                <button onClick={handleBulkAddWP} className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm">{t('bulk_btn_wp')}</button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* 4. MISSING REASONS */}
      {isAdmin && (
          <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-700">
              <h2 className="text-xl font-bold text-teal-400 mb-6 border-b border-gray-700 pb-2">{t('sect_reasons')}</h2>
              <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1">
                      <div className="mb-2 relative"><SearchIcon className="absolute top-2 left-2 w-4 h-4 text-gray-500"/><input value={reasonSearch} onChange={e=>setReasonSearch(e.target.value)} className="w-full pl-8 pr-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-white" placeholder={t('search_db_placeholder')} /></div>
                      <div className="bg-gray-800 rounded p-4 mb-4 space-y-2">
                          {filteredReasons.map(r => (
                              <div key={r.id} className="flex justify-between items-center bg-gray-700 px-3 py-2 rounded">
                                  <span className="text-white">{r.value}</span>
                                  <button onClick={() => onDeleteMissingReason(r.id)} className="text-red-400 hover:text-red-200">×</button>
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="md:w-1/3">
                      <form onSubmit={handleAddReason} className="flex gap-2">
                          <input value={newMissingReason} onChange={e => setNewMissingReason(e.target.value)} placeholder={t('new_reason_place')} className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"/>
                          <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded text-sm">{t('add_single')}</button>
                      </form>
                  </div>
              </div>
          </div>
      )}

      {/* 5. MAINTENANCE */}
       {isAdmin && (
        <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-red-900/50">
             <h2 className="text-xl font-bold text-red-400 mb-4 border-b border-gray-700 pb-2">{t('sect_maint')}</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                    <p className="text-gray-400 text-sm mb-4">{t('maint_desc')}</p>
                    <button onClick={handleRunArchiving} disabled={isArchiving} className={`bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 ${isArchiving ? 'opacity-50 cursor-wait' : ''}`}>
                        {isArchiving ? t('archiving') : t('archive_btn')}
                    </button>
                </div>
                <div className="border-t md:border-t-0 md:border-l border-gray-700 pt-4 md:pt-0 md:pl-6 space-y-4">
                    <a href="https://console.firebase.google.com/project/sklad-ulohy/firestore/data" target="_blank" rel="noopener noreferrer" className="block text-center bg-blue-800 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">{t('sect_maint_db_link')}</a>
                    <a href="https://github.com/MiroslavSvitok/clamason-task-manager" target="_blank" rel="noopener noreferrer" className="block text-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors border border-gray-500">{t('sect_maint_gh_link')}</a>
                </div>
             </div>
        </div>
       )}

       {/* 6. BREAKS */}
       {isAdmin && (
           <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-purple-700/50">
               <h2 className="text-xl font-bold text-purple-400 mb-6 border-b border-gray-700 pb-2">{t('sect_breaks')}</h2>
               <div className="flex flex-col md:flex-row gap-8">
                   <div className="flex-1">
                       <div className="bg-gray-800 rounded p-4 mb-4 space-y-2">
                           {breakSchedules.map(b => (
                               <div key={b.id} className="flex justify-between items-center bg-gray-700 px-3 py-2 rounded">
                                   <span className="text-white font-mono">{b.start} - {b.end}</span>
                                   <button onClick={() => onDeleteBreakSchedule(b.id)} className="text-red-400 hover:text-red-200">×</button>
                               </div>
                           ))}
                       </div>
                   </div>
                   <div className="md:w-1/3">
                       <form onSubmit={handleAddBreak} className="flex gap-2">
                           <input type="time" value={newBreakStart} onChange={e => setNewBreakStart(e.target.value)} className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-2 text-white text-sm" required />
                           <span className="text-gray-400 self-center">-</span>
                           <input type="time" value={newBreakEnd} onChange={e => setNewBreakEnd(e.target.value)} className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-2 text-white text-sm" required />
                           <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm">{t('add_single')}</button>
                       </form>
                   </div>
               </div>
           </div>
       )}

       {/* 7. PWA */}
       {(isAdmin || isSuper) && (
           <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-blue-600/50">
               <h2 className="text-xl font-bold text-blue-400 mb-4 border-b border-gray-700 pb-2">{t('sect_pwa')}</h2>
               {installPrompt ? (
                   <button onClick={onInstallApp} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 shadow-lg">
                       {t('pwa_install_btn')}
                   </button>
               ) : <p className="text-gray-500 italic text-sm">{t('pwa_installed')}</p>}
           </div>
       )}

       {/* 8. BOM */}
       {canManageDB && (
           <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-green-700/50">
               <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
                   <h2 className="text-xl font-bold text-green-400">{t('sect_bom')}</h2>
                   {bomItems && bomItems.length > 0 && <button onClick={handleDeleteAllBOMConfirm} className="text-xs bg-red-900 hover:bg-red-800 text-red-100 px-3 py-1 rounded">{t('delete_all')}</button>}
               </div>
               <div className="flex flex-col md:flex-row gap-8">
                   <div className="flex-1">
                       <div className="relative mb-2"><SearchIcon className="absolute top-2 left-2 w-4 h-4 text-gray-500"/><input type="text" value={bomSearchQuery} onChange={(e) => setBomSearchQuery(e.target.value)} placeholder="Vyhľadať BOM..." className="w-full bg-gray-700 border border-gray-600 rounded pl-8 pr-3 py-2 text-white text-sm" /></div>
                       <div className="bg-gray-800 rounded p-4 mb-4 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                           {filteredBOMItems?.map(b => (
                               <div key={b.id} className="flex justify-between items-center bg-gray-700 px-3 py-2 rounded">
                                   <span className="text-white text-sm font-mono">{b.parentPart} → {b.childPart} <span className="text-green-400">({b.quantity})</span></span>
                                   <button onClick={() => onDeleteBOMItem && onDeleteBOMItem(b.id)} className="text-red-400 hover:text-red-200">×</button>
                               </div>
                           ))}
                       </div>
                   </div>
                   <div className="md:w-1/3 space-y-4">
                       <form onSubmit={handleAddBOM} className="flex flex-col gap-2">
                           <input value={bomParent} onChange={e => setBomParent(e.target.value)} placeholder={t('bom_parent_place')} className="bg-gray-700 border border-gray-600 rounded px-2 py-2 text-white text-sm" />
                           <input value={bomChild} onChange={e => setBomChild(e.target.value)} placeholder={t('bom_child_place')} className="bg-gray-700 border border-gray-600 rounded px-2 py-2 text-white text-sm" />
                           <input type="number" step="0.00001" value={bomQty} onChange={e => setBomQty(e.target.value)} placeholder={t('bom_qty_place')} className="bg-gray-700 border border-gray-600 rounded px-2 py-2 text-white text-sm" />
                           <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm">{t('bom_add_single')}</button>
                       </form>
                       <div className="pt-4 border-t border-gray-700">
                           <textarea value={bomBulk} onChange={e => setBomBulk(e.target.value)} className="w-full h-20 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-xs font-mono" placeholder="Bulk..." />
                           <button onClick={handleBulkAddBOM} className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm">{t('bom_bulk_btn')}</button>
                       </div>
                   </div>
               </div>
           </div>
       )}

       {/* 9. ROLES */}
       {isAdmin && roles && permissions && (
           <div className="bg-gray-900 rounded-xl p-6 shadow-lg border border-orange-700/50">
               <h2 className="text-xl font-bold text-orange-400 mb-6 border-b border-gray-700 pb-2">{t('sect_roles')}</h2>
               {permGroups.map(group => (
                   <div key={group.name} className="mb-6">
                       <h3 className="text-gray-400 font-bold mb-2 uppercase text-xs">{t(group.name as any)}</h3>
                       <div className="overflow-x-auto">
                           <table className="min-w-full text-left text-sm border-collapse">
                               <thead>
                                   <tr className="border-b border-gray-700">
                                       <th className="py-2 px-4 text-gray-500 font-medium">Permission</th>
                                       {roles.map(role => (
                                           <th key={role.id} className="py-2 px-4 text-white font-bold text-center">
                                               {role.name}
                                               {!role.isSystem && <button onClick={() => onDeleteRole && onDeleteRole(role.id)} className="ml-1 text-red-500 text-[10px]">x</button>}
                                           </th>
                                       ))}
                                   </tr>
                               </thead>
                               <tbody>
                                   {group.perms.map(perm => (
                                       <tr key={perm} className="border-b border-gray-800 hover:bg-gray-800/50">
                                           <td className="py-2 px-4 text-gray-300">{t(perm as any)}</td>
                                           {roles.map(role => (
                                               <td key={`${role.id}-${perm}`} className="py-2 px-4 text-center">
                                                   <input type="checkbox" checked={hasPermission(role.id, perm)} onChange={(e) => onUpdatePermission && onUpdatePermission(perm, role.name, e.target.checked)} className="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 rounded" />
                                               </td>
                                           ))}
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                       </div>
                   </div>
               ))}
               <form onSubmit={handleAddRole} className="flex gap-2 max-w-sm mt-4">
                   <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder={t('role_name_place')} className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm uppercase" />
                   <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded text-sm">{t('role_add_btn')}</button>
               </form>
           </div>
       )}

       <div className="pt-8 pb-4 text-center text-xs text-gray-600 border-t border-gray-800"><p>Clamason Task Manager v2.0</p><p className="mt-1">{t('created_by')}</p></div>
    </div>
  );
};

export default SettingsTab;
