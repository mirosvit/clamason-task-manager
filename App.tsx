

import React, { useState, useEffect, useRef } from 'react';
import LoginScreen from './components/LoginScreen';
import PartSearchScreen, { Task, PriorityLevel, InventorySession, Notification } from './components/PartSearchScreen';
import { db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  writeBatch,
  getDocs,
  where,
  limit
} from 'firebase/firestore';
import { partNumbers as initialParts, workplaces as initialWorkplaces, initialMissingReasons } from './data/mockParts';

export interface UserData {
  id?: string;
  username: string;
  password: string;
  role: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER' | 'LOGISTICIAN';
}

export interface DBItem {
  id: string;
  value: string;
  standardTime?: number;
}

export interface PartRequest {
    id: string;
    partNumber: string;
    requestedBy: string;
    requestedAt: number;
}

export interface BreakSchedule {
    id: string;
    start: string;
    end: string;
}

export interface SystemBreak {
    id: string;
    start: number;
    end?: number;
    isActive: boolean;
}

export interface BOMItem {
    id: string;
    parentPart: string;
    childPart: string;
    quantity: number;
}

export interface BOMRequest {
    id: string;
    parentPart: string;
    requestedBy: string;
    requestedAt: number;
}

export interface Role {
    id: string;
    name: string;
    isSystem?: boolean;
}

export interface Permission {
    id: string;
    roleId: string;
    permissionName: string;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER' | 'LOGISTICIAN'>('USER');
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Data
  const [users, setUsers] = useState<UserData[]>([]);
  const [parts, setParts] = useState<DBItem[]>([]);
  const [workplaces, setWorkplaces] = useState<DBItem[]>([]);
  const [missingReasons, setMissingReasons] = useState<DBItem[]>([]);
  const [partRequests, setPartRequests] = useState<PartRequest[]>([]);
  const [breakSchedules, setBreakSchedules] = useState<BreakSchedule[]>([]);
  const [systemBreaks, setSystemBreaks] = useState<SystemBreak[]>([]);
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [bomRequests, setBomRequests] = useState<BOMRequest[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // Sound logic
  const isFirstLoad = useRef(true);

  // --- INITIALIZATION ---

  useEffect(() => {
    const storedUser = localStorage.getItem('app_user');
    const storedRole = localStorage.getItem('app_role');
    if (storedUser && storedRole) {
      setCurrentUser(storedUser);
      setCurrentUserRole(storedRole as any);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const hasPermission = (permName: string) => {
      if (currentUserRole === 'ADMIN') return true;
      const r = roles.find(r => r.name === currentUserRole);
      if (!r) return false;
      return permissions.some(p => p.roleId === r.id && p.permissionName === permName);
  };

  // --- DATA FETCHING ---

  useEffect(() => {
    const q = query(collection(db, 'users'));
    return onSnapshot(q, (snapshot) => {
        const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));
        if (fetchedUsers.length === 0) seedDatabase();
        else setUsers(fetchedUsers);
    });
  }, []);

  // Tasks & Sound Notification
  useEffect(() => {
    const q = query(collection(db, 'tasks')); 
    return onSnapshot(q, (snapshot) => {
      const newTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));

      // Sound Notification Logic
      if (!isFirstLoad.current) {
          snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                  const task = change.doc.data() as Task;
                  // Only play if it's new (created now)
                  if (task.createdAt && (Date.now() - task.createdAt < 10000)) {
                      if (hasPermission('perm_play_sound')) {
                          try {
                              const audio = new Audio('https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3');
                              audio.play().catch(e => console.log('Sound blocked', e));
                          } catch (e) {}
                      }
                  }
              }
          });
      }
      isFirstLoad.current = false;

      // Sort Logic
      const priorityOrder: Record<string, number> = { 'URGENT': 0, 'NORMAL': 1, 'LOW': 2 };
      const sortedTasks = newTasks.sort((a, b) => {
        // 1. Status: Active first
        if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
        
        // 2. If DONE: Missing -> Urgent -> Normal -> Low
        if (a.isDone && b.isDone) {
            if (a.isMissing !== b.isMissing) return a.isMissing ? -1 : 1;
            const pA = priorityOrder[a.priority || 'NORMAL'];
            const pB = priorityOrder[b.priority || 'NORMAL'];
            if (pA !== pB) return pA - pB;
        }

        // 3. Priority (Active)
        if (!a.isDone) {
            const pA = priorityOrder[a.priority || 'NORMAL'];
            const pB = priorityOrder[b.priority || 'NORMAL'];
            if (pA !== pB) return pA - pB;
        }

        // 4. Time
        return (a.createdAt || 0) - (b.createdAt || 0); 
      });

      setTasks(sortedTasks);
    });
  }, [roles, permissions, currentUserRole]); // Re-run if perms change for sound check

  // Other Collections
  useEffect(() => { const q = query(collection(db, 'parts'), orderBy('value')); return onSnapshot(q, s => setParts(s.docs.map(d => ({id:d.id, ...d.data()} as DBItem)))); }, []);
  useEffect(() => { const q = query(collection(db, 'workplaces'), orderBy('value')); return onSnapshot(q, s => setWorkplaces(s.docs.map(d => ({id:d.id, value:d.data().value, standardTime:d.data().standardTime} as DBItem)))); }, []);
  useEffect(() => { const q = query(collection(db, 'missing_reasons'), orderBy('value')); return onSnapshot(q, s => setMissingReasons(s.docs.map(d => ({id:d.id, value:d.data().value} as DBItem)))); }, []);
  useEffect(() => { const q = query(collection(db, 'part_requests')); return onSnapshot(q, s => setPartRequests(s.docs.map(d => ({id:d.id, ...d.data()} as PartRequest)))); }, []);
  useEffect(() => { const q = query(collection(db, 'break_schedules')); return onSnapshot(q, s => setBreakSchedules(s.docs.map(d => ({id:d.id, ...d.data()} as BreakSchedule)))); }, []);
  useEffect(() => { 
      const q = query(collection(db, 'system_breaks')); 
      return onSnapshot(q, s => {
          const breaks = s.docs.map(d => ({id:d.id, ...d.data()} as SystemBreak));
          setSystemBreaks(breaks);
          setIsBreakActive(breaks.some(b => b.isActive));
      }); 
  }, []);
  useEffect(() => { const q = query(collection(db, 'bom_items')); return onSnapshot(q, s => setBomItems(s.docs.map(d => ({id:d.id, ...d.data()} as BOMItem)))); }, []);
  useEffect(() => { const q = query(collection(db, 'bom_requests')); return onSnapshot(q, s => setBomRequests(s.docs.map(d => ({id:d.id, ...d.data()} as BOMRequest)))); }, []);
  useEffect(() => { const q = query(collection(db, 'notifications')); return onSnapshot(q, s => setNotifications(s.docs.map(d => ({id:d.id, ...d.data()} as Notification)))); }, []);

  // Roles & Permissions
  useEffect(() => {
      const q = query(collection(db, 'roles'));
      return onSnapshot(q, (snapshot) => {
          const fetchedRoles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
          if (fetchedRoles.length === 0) seedRolesAndPermissions();
          else setRoles(fetchedRoles);
      });
  }, []);
  useEffect(() => {
      const q = query(collection(db, 'permissions'));
      return onSnapshot(q, (snapshot) => {
          setPermissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Permission)));
      });
  }, []);

  // Break Logic
  useEffect(() => {
      if (!breakSchedules.length) return;
      const checkTime = () => {
          const now = new Date();
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          const currentHM = `${hours}:${minutes}`;
          
          const matchingSchedule = breakSchedules.find(s => currentHM >= s.start && currentHM < s.end);
          if (matchingSchedule && !isBreakActive) {
              const recentlyCreated = systemBreaks.some(sb => sb.isActive && Math.abs(sb.start - Date.now()) < 60000);
              if (!recentlyCreated) addDoc(collection(db, 'system_breaks'), { start: Date.now(), isActive: true });
          }

          const matchingEnd = breakSchedules.find(s => s.end === currentHM);
          const isInsideAnySchedule = breakSchedules.some(s => currentHM >= s.start && currentHM < s.end);
          if ((matchingEnd || !isInsideAnySchedule) && isBreakActive) {
              const activeBreak = systemBreaks.find(b => b.isActive);
              if (activeBreak) updateDoc(doc(db, 'system_breaks', activeBreak.id), { end: Date.now(), isActive: false });
          }
      };
      const interval = setInterval(checkTime, 10000); 
      return () => clearInterval(interval);
  }, [breakSchedules, isBreakActive, systemBreaks]);

  const seedDatabase = async () => {
      await addDoc(collection(db, 'users'), { username: 'USER', password: '123', role: 'USER' });
      await addDoc(collection(db, 'users'), { username: 'ADMIN', password: '321', role: 'ADMIN' });
      const b = writeBatch(db);
      initialParts.forEach(p => b.set(doc(collection(db, 'parts')), { value: p }));
      initialWorkplaces.forEach(w => b.set(doc(collection(db, 'workplaces')), { value: w }));
      initialMissingReasons.forEach(r => b.set(doc(collection(db, 'missing_reasons')), { value: r }));
      await b.commit();
  };

  const seedRolesAndPermissions = async () => {
      const batch = writeBatch(db);
      const roleDefs = [
          { name: 'ADMIN', isSystem: true },
          { name: 'USER', isSystem: true },
          { name: 'SUPERVISOR', isSystem: true },
          { name: 'LEADER', isSystem: true },
          { name: 'LOGISTICIAN', isSystem: true }
      ];
      const roleMap: Record<string, string> = {};
      for (const r of roleDefs) {
          const ref = doc(collection(db, 'roles'));
          batch.set(ref, r);
          roleMap[r.name] = ref.id;
      }

      const allPerms = [
          'perm_tab_entry', 'perm_tab_tasks', 'perm_tab_bom', 'perm_tab_analytics', 'perm_tab_settings', 'perm_tab_missing',
          'perm_btn_finish', 'perm_btn_edit', 'perm_btn_delete', 'perm_btn_resolve', 'perm_btn_missing', 'perm_btn_copy', 'perm_btn_note', 'perm_btn_incorrect',
          'perm_view_fullscreen', 'perm_play_sound', 'perm_view_passwords',
          'perm_manage_users', 'perm_manage_db', 'perm_manage_bom', 'perm_archive', 'perm_manage_breaks'
      ];

      const assign = (role: string, list: string[]) => {
          const rid = roleMap[role];
          list.forEach(p => batch.set(doc(collection(db, 'permissions')), { roleId: rid, permissionName: p }));
      };

      assign('ADMIN', allPerms);
      assign('SUPERVISOR', allPerms);
      assign('USER', ['perm_tab_entry', 'perm_tab_tasks', 'perm_tab_bom', 'perm_btn_resolve', 'perm_btn_missing', 'perm_btn_copy', 'perm_btn_note', 'perm_btn_finish', 'perm_play_sound']);
      assign('LEADER', ['perm_tab_entry', 'perm_tab_tasks', 'perm_tab_bom', 'perm_btn_incorrect', 'perm_btn_edit', 'perm_play_sound']); 
      assign('LOGISTICIAN', ['perm_tab_tasks', 'perm_tab_analytics', 'perm_tab_settings', 'perm_tab_missing', 'perm_btn_edit', 'perm_btn_note', 'perm_manage_db', 'perm_manage_bom']);

      await batch.commit();
  };

  // --- ACTIONS ---

  const handleLogin = (u: string, r: any) => { setIsAuthenticated(true); setCurrentUser(u); setCurrentUserRole(r); localStorage.setItem('app_user', u); localStorage.setItem('app_role', r); };
  const handleLogout = () => { setIsAuthenticated(false); setCurrentUser(''); setCurrentUserRole('USER'); localStorage.removeItem('app_user'); localStorage.removeItem('app_role'); };
  const handleAddUser = (u: UserData) => addDoc(collection(db, 'users'), u);
  const handleUpdatePassword = (u: string, p: string) => { const user = users.find(us => us.username === u); if(user) updateDoc(doc(db,'users', user.id!), {password: p}); };
  const handleUpdateUserRole = (u: string, r: any) => { const user = users.find(us => us.username === u); if(user) updateDoc(doc(db,'users', user.id!), {role: r}); };
  const handleDeleteUser = (u: string) => { const user = users.find(us => us.username === u); if(user) deleteDoc(doc(db,'users', user.id!)); };

  const handleAddPart = (v: string) => addDoc(collection(db,'parts'), {value:v});
  const handleBatchAddParts = (vs: string[]) => { const b=writeBatch(db); vs.forEach(v => b.set(doc(collection(db,'parts')), {value:v})); b.commit(); };
  const handleDeletePart = (id: string) => deleteDoc(doc(db,'parts',id));
  const handleDeleteAllParts = async () => { const s=await getDocs(collection(db,'parts')); const b=writeBatch(db); s.forEach(d=>b.delete(d.ref)); b.commit(); };

  const handleAddWorkplace = (v: string, t?: number) => addDoc(collection(db,'workplaces'), {value:v, standardTime:t||0});
  const handleBatchAddWorkplaces = (vs: string[]) => { const b=writeBatch(db); vs.forEach(l=>{const [v,t]=l.split(';'); if(v) b.set(doc(collection(db,'workplaces')), {value:v.trim(), standardTime: parseInt(t)||0})}); b.commit(); };
  const handleDeleteWorkplace = (id: string) => deleteDoc(doc(db,'workplaces',id));
  const handleDeleteAllWorkplaces = async () => { const s=await getDocs(collection(db,'workplaces')); const b=writeBatch(db); s.forEach(d=>b.delete(d.ref)); b.commit(); };

  const handleAddMissingReason = (v: string) => addDoc(collection(db,'missing_reasons'), {value:v});
  const handleDeleteMissingReason = (id: string) => deleteDoc(doc(db,'missing_reasons',id));

  const handleAddBreakSchedule = (s:string, e:string) => addDoc(collection(db,'break_schedules'), {start:s, end:e});
  const handleDeleteBreakSchedule = (id: string) => deleteDoc(doc(db,'break_schedules',id));

  const handleAddBOMItem = (p:string, c:string, q:number) => addDoc(collection(db,'bom_items'), {parentPart:p, childPart:c, quantity:q});
  const handleBatchAddBOMItems = (vs: string[]) => { const b=writeBatch(db); vs.forEach(l=>{const p=l.split(';'); if(p.length>=3) b.set(doc(collection(db,'bom_items')), {parentPart:p[0].trim(), childPart:p[1].trim(), quantity:parseFloat(p[2].trim().replace(',','.'))})}); b.commit(); };
  const handleDeleteBOMItem = (id: string) => deleteDoc(doc(db,'bom_items',id));
  const handleDeleteAllBOMItems = async () => { const s=await getDocs(collection(db,'bom_items')); const b=writeBatch(db); s.forEach(d=>b.delete(d.ref)); b.commit(); };
  const handleRequestBOM = async (p: string) => { await addDoc(collection(db,'bom_requests'), {parentPart:p, requestedBy:currentUser, requestedAt:Date.now()}); return true; };
  const handleApproveBOMRequest = (r: BOMRequest) => deleteDoc(doc(db,'bom_requests',r.id));
  const handleRejectBOMRequest = (id: string) => deleteDoc(doc(db,'bom_requests',id));

  const handleAddRole = (n:string) => addDoc(collection(db,'roles'), {name:n.toUpperCase(), isSystem:false});
  const handleDeleteRole = async (id:string) => { await deleteDoc(doc(db,'roles',id)); const s=await getDocs(query(collection(db,'permissions'), where('roleId','==',id))); const b=writeBatch(db); s.forEach(d=>b.delete(d.ref)); b.commit(); };
  const handleUpdatePermission = async (pid:string, rname:string, has:boolean) => { const r=roles.find(ro=>ro.name===rname); if(!r)return; if(has) addDoc(collection(db,'permissions'), {roleId:r.id, permissionName:pid}); else { const p=permissions.find(perm=>perm.roleId===r.id && perm.permissionName===pid); if(p) deleteDoc(doc(db,'permissions',p.id)); } };

  const handleRequestNewPart = async (p: string) => { await addDoc(collection(db,'part_requests'), {partNumber:p, requestedBy:currentUser, requestedAt:Date.now()}); return true; };
  const handleApprovePartRequest = (req: PartRequest) => { handleAddPart(req.partNumber); deleteDoc(doc(db,'part_requests',req.id)); };
  const handleRejectPartRequest = (id: string) => deleteDoc(doc(db,'part_requests',id));

  const handleAddTask = async (pn: string, wp: string, qty: string, unit: string, prio: PriorityLevel) => {
    const formattedDate = new Date().toLocaleString('sk-SK');
    let fQty = qty; if(unit==='boxes') fQty=`${qty} box`; if(unit==='pallet') fQty=`${qty} pal`;
    const wpObj = workplaces.find(w => w.value === wp);
    await addDoc(collection(db, 'tasks'), { text: `${formattedDate} / ${pn} / ${wp} / Počet: ${fQty}`, partNumber:pn, workplace:wp, quantity:qty, quantityUnit:unit, standardTime:wpObj?.standardTime||0, isDone:false, priority:prio, createdAt:Date.now(), createdBy:currentUser });
  };

  const handleToggleTask = async (id: string) => {
    const t = tasks.find(x => x.id === id);
    if(t) {
        const newState = !t.isDone;
        await updateDoc(doc(db,'tasks',id), { isDone:newState, status:newState?'completed':null, completionTime:newState?new Date().toLocaleTimeString('sk-SK'):null, completedBy:newState?currentUser:null, completedAt:newState?Date.now():null, isInProgress:false, inProgressBy:null, isBlocked:false });
    }
  };

  const handleMarkAsIncorrect = async (id: string) => updateDoc(doc(db,'tasks',id), { isDone:true, status:'incorrectly_entered', completionTime:new Date().toLocaleTimeString('sk-SK'), completedBy:currentUser, completedAt:Date.now(), isInProgress:false, inProgressBy:null, isBlocked:false });
  const handleSetInProgress = async (id: string) => { const t = tasks.find(x=>x.id===id); if(t) updateDoc(doc(db,'tasks',id), { isInProgress:!t.isInProgress, inProgressBy:!t.isInProgress?currentUser:null, startedAt:(!t.isInProgress && !t.startedAt)?Date.now():t.startedAt }); };
  const handleAddNote = (id:string, n:string) => updateDoc(doc(db,'tasks',id), {note:n});
  const handleReleaseTask = (id:string) => updateDoc(doc(db,'tasks',id), {isInProgress:false, inProgressBy:null});
  const handleEditTask = (id:string, txt:string, prio?:PriorityLevel) => updateDoc(doc(db,'tasks',id), {text:txt, priority:prio});
  const handleDeleteTask = (id:string) => deleteDoc(doc(db,'tasks',id));
  
  const handleToggleMissing = async (id:string, reason?:string) => { 
      const t=tasks.find(x=>x.id===id); 
      if(t) {
          const isMissing = !t.isMissing;
          await updateDoc(doc(db,'tasks',id), { 
              isMissing, 
              missingReportedBy: isMissing?currentUser:null, 
              missingReason: isMissing?(reason||'Iné'):null,
              // AUTO FINISH
              isDone: isMissing ? true : t.isDone,
              completedAt: isMissing ? Date.now() : t.completedAt,
              completedBy: isMissing ? currentUser : t.completedBy
          });
          // Alert Notification
          if (isMissing) {
              await addDoc(collection(db, 'notifications'), {
                  partNumber: t.partNumber || 'Unknown',
                  reason: reason || 'Iné',
                  reportedBy: currentUser,
                  timestamp: Date.now()
              });
          }
      } 
  };
  
  const handleClearNotification = (id: string) => deleteDoc(doc(db, 'notifications', id));

  const handleToggleBlock = async (id: string) => {
      const t=tasks.find(x=>x.id===id);
      if(t) {
          const isBlocked = !t.isBlocked;
          const hist = t.inventoryHistory ? [...t.inventoryHistory] : [];
          if(isBlocked) hist.push({start:Date.now()}); else { const last=hist[hist.length-1]; if(last && !last.end) last.end=Date.now(); }
          updateDoc(doc(db,'tasks',id), { isBlocked, inventoryHistory:hist });
      }
  };

  const handleArchiveTasks = async () => {
      const q = query(collection(db,'tasks'), where('isDone','==',true), limit(1000));
      const s = await getDocs(q);
      const toArchive = s.docs.filter(d => !d.data().completedAt || d.data().completedAt < (Date.now() - 86400000));
      if(toArchive.length===0) return {success:true, count:0, message:"Žiadne staré úlohy."};
      const b=writeBatch(db);
      toArchive.forEach(d => { b.set(doc(collection(db,'archived_tasks')), {...d.data(), archivedAt:Date.now()}); b.delete(d.ref); });
      await b.commit();
      return {success:true, count:toArchive.length};
  };
  const fetchArchivedTasks = async () => (await getDocs(collection(db,'archived_tasks'))).docs.map(d=>({id:d.id, ...d.data()} as Task));

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
      {!isAuthenticated ? (
        <LoginScreen onLoginSuccess={handleLogin} users={users} />
      ) : (
        <PartSearchScreen 
          currentUser={currentUser} currentUserRole={currentUserRole} onLogout={handleLogout}
          tasks={tasks} onAddTask={handleAddTask} onToggleTask={handleToggleTask} onEditTask={handleEditTask} onDeleteTask={handleDeleteTask}
          onToggleMissing={handleToggleMissing} onSetInProgress={handleSetInProgress} onToggleBlock={handleToggleBlock} onMarkAsIncorrect={handleMarkAsIncorrect} onAddNote={handleAddNote} onReleaseTask={handleReleaseTask}
          users={users} onAddUser={handleAddUser} onUpdatePassword={handleUpdatePassword} onUpdateUserRole={handleUpdateUserRole} onDeleteUser={handleDeleteUser}
          parts={parts} workplaces={workplaces} missingReasons={missingReasons}
          onAddPart={handleAddPart} onBatchAddParts={handleBatchAddParts} onDeletePart={handleDeletePart} onDeleteAllParts={handleDeleteAllParts}
          onAddWorkplace={handleAddWorkplace} onBatchAddWorkplaces={handleBatchAddWorkplaces} onDeleteWorkplace={handleDeleteWorkplace} onDeleteAllWorkplaces={handleDeleteAllWorkplaces}
          onAddMissingReason={handleAddMissingReason} onDeleteMissingReason={handleDeleteMissingReason}
          partRequests={partRequests} onRequestPart={handleRequestNewPart} onApprovePartRequest={handleApprovePartRequest} onRejectPartRequest={handleRejectPartRequest}
          onArchiveTasks={handleArchiveTasks} 
          onFetchArchivedTasks={fetchArchivedTasks}
          breakSchedules={breakSchedules} systemBreaks={systemBreaks} isBreakActive={isBreakActive} onAddBreakSchedule={handleAddBreakSchedule} onDeleteBreakSchedule={handleDeleteBreakSchedule}
          bomItems={bomItems} bomRequests={bomRequests} onAddBOMItem={handleAddBOMItem} onBatchAddBOMItems={handleBatchAddBOMItems} onDeleteBOMItem={handleDeleteBOMItem} onDeleteAllBOMItems={handleDeleteAllBOMItems} onRequestBOM={handleRequestBOM} onApproveBOMRequest={handleApproveBOMRequest} onRejectBOMRequest={handleRejectBOMRequest}
          roles={roles} permissions={permissions} onAddRole={handleAddRole} onDeleteRole={handleDeleteRole} onUpdatePermission={handleUpdatePermission}
          notifications={notifications} onClearNotification={handleClearNotification}
          installPrompt={deferredPrompt} onInstallApp={handleInstallApp}
        />
      )}
    </div>
  );
};

export default App;
