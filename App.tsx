
import React, { useState, useEffect, useRef } from 'react';
import LoginScreen from './components/LoginScreen';
import PartSearchScreen, { Task, PriorityLevel, InventorySession } from './components/PartSearchScreen';
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
  id?: string; // Firebase ID
  username: string;
  password: string;
  role: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER' | 'LOGISTICIAN';
}

export interface DBItem {
  id: string;
  value: string;
  standardTime?: number; // Standard travel/execution time in minutes
}

export interface PartRequest {
    id: string;
    partNumber: string;
    requestedBy: string;
    requestedAt: number;
}

export interface BreakSchedule {
    id: string;
    start: string; // "HH:MM"
    end: string;   // "HH:MM"
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

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER' | 'LOGISTICIAN'>('USER');
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Data from DB
  const [users, setUsers] = useState<UserData[]>([]);
  const [parts, setParts] = useState<DBItem[]>([]);
  const [workplaces, setWorkplaces] = useState<DBItem[]>([]);
  const [missingReasons, setMissingReasons] = useState<DBItem[]>([]);
  const [partRequests, setPartRequests] = useState<PartRequest[]>([]);
  
  // Break Management State
  const [breakSchedules, setBreakSchedules] = useState<BreakSchedule[]>([]);
  const [systemBreaks, setSystemBreaks] = useState<SystemBreak[]>([]);
  const [isBreakActive, setIsBreakActive] = useState(false);

  // BOM State
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [bomRequests, setBomRequests] = useState<BOMRequest[]>([]);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // --- 1. INITIALIZATION & DATA FETCHING ---

  // Check LocalStorage for Login
  useEffect(() => {
    const storedUser = localStorage.getItem('app_user');
    const storedRole = localStorage.getItem('app_role');
    if (storedUser && storedRole) {
      setCurrentUser(storedUser);
      setCurrentUserRole(storedRole as any);
      setIsAuthenticated(true);
    }
  }, []);

  // Listen for PWA Install Event
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault(); // Prevent the mini-infobar from appearing on mobile
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };

  // Fetch Users
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));
        
        // Seeding if empty
        if (fetchedUsers.length === 0) {
            seedDatabase();
        } else {
            setUsers(fetchedUsers);
        }
    }, (error) => {
        console.error("Error fetching users:", error);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Tasks (Real-time)
  useEffect(() => {
    const q = query(collection(db, 'tasks')); 
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));

      const priorityOrder: Record<string, number> = { 'URGENT': 0, 'NORMAL': 1, 'LOW': 2 };

      const sortedTasks = newTasks.sort((a, b) => {
        // 1. Status: Active first
        if (a.isDone !== b.isDone) {
            return a.isDone ? 1 : -1;
        }
        // 2. Priority
        const pA = priorityOrder[a.priority || 'NORMAL'];
        const pB = priorityOrder[b.priority || 'NORMAL'];
        if (pA !== pB) {
            return pA - pB;
        }
        // 3. Time
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeA - timeB; 
      });

      setTasks(sortedTasks);
    }, (error) => {
        console.error("Error fetching tasks.", error);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Parts
  useEffect(() => {
    const q = query(collection(db, 'parts'), orderBy('value'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setParts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DBItem)));
    });
    return () => unsubscribe();
  }, []);

  // Fetch Workplaces
  useEffect(() => {
    const q = query(collection(db, 'workplaces'), orderBy('value'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setWorkplaces(snapshot.docs.map(doc => ({ id: doc.id, value: doc.data().value, standardTime: doc.data().standardTime } as DBItem)));
    });
    return () => unsubscribe();
  }, []);

  // Fetch Missing Reasons
  useEffect(() => {
    const q = query(collection(db, 'missing_reasons'), orderBy('value'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setMissingReasons(snapshot.docs.map(doc => ({ id: doc.id, value: doc.data().value })));
    });
    return () => unsubscribe();
  }, []);

  // Fetch Part Requests
  useEffect(() => {
      const q = query(collection(db, 'part_requests'), orderBy('requestedAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          setPartRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PartRequest)));
      });
      return () => unsubscribe();
  }, []);

  // Fetch Break Schedules
  useEffect(() => {
      const q = query(collection(db, 'break_schedules'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          setBreakSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BreakSchedule)));
      });
      return () => unsubscribe();
  }, []);

  // Fetch System Breaks (History & Active status)
  useEffect(() => {
      const q = query(collection(db, 'system_breaks'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const breaks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemBreak));
          setSystemBreaks(breaks);
          
          // Determine if currently active based on DB state
          const activeBreak = breaks.find(b => b.isActive);
          setIsBreakActive(!!activeBreak);
      });
      return () => unsubscribe();
  }, []);

  // Fetch BOM Items
  useEffect(() => {
      const q = query(collection(db, 'bom_items'), orderBy('parentPart'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          setBomItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BOMItem)));
      });
      return () => unsubscribe();
  }, []);

  // Fetch BOM Requests
  useEffect(() => {
      const q = query(collection(db, 'bom_requests'), orderBy('requestedAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          setBomRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BOMRequest)));
      });
      return () => unsubscribe();
  }, []);

  // --- BREAK SCHEDULER LOGIC ---
  useEffect(() => {
      if (!breakSchedules.length) return;

      const checkTime = () => {
          const now = new Date();
          // FIX: Manual time formatting to strictly match HH:MM format (avoiding browser locale issues)
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          const currentHM = `${hours}:${minutes}`;
          
          // Check if we should START a break
          // We check if current time equals start time
          // Or if current time is INSIDE a break window but no active break exists (recovery mode)
          const matchingSchedule = breakSchedules.find(s => {
              return currentHM >= s.start && currentHM < s.end;
          });

          if (matchingSchedule && !isBreakActive) {
              // Create active break session
              // Check if we recently created one to avoid duplicates (naive check)
              const recentlyCreated = systemBreaks.some(sb => 
                  sb.isActive && Math.abs(sb.start - Date.now()) < 60000
              );
              
              if (!recentlyCreated) {
                  addDoc(collection(db, 'system_breaks'), {
                      start: Date.now(),
                      isActive: true
                  });
              }
          }

          // Check if we should END a break
          // Only end if the current time matches the End time of a schedule
          const matchingEnd = breakSchedules.find(s => s.end === currentHM);
          
          // Or if we are active, but NO schedule matches current time anymore (safety net)
          const isInsideAnySchedule = breakSchedules.some(s => currentHM >= s.start && currentHM < s.end);

          if ((matchingEnd || !isInsideAnySchedule) && isBreakActive) {
              // Find the active break doc and close it
              const activeBreak = systemBreaks.find(b => b.isActive);
              if (activeBreak) {
                  updateDoc(doc(db, 'system_breaks', activeBreak.id), {
                      end: Date.now(),
                      isActive: false
                  });
              }
          }
      };

      const interval = setInterval(checkTime, 10000); // Check every 10 seconds for better responsiveness
      return () => clearInterval(interval);
  }, [breakSchedules, isBreakActive, systemBreaks]);


  const seedDatabase = async () => {
      await addDoc(collection(db, 'users'), { username: 'USER', password: '123', role: 'USER' });
      await addDoc(collection(db, 'users'), { username: 'ADMIN', password: '321', role: 'ADMIN' });
      
      const partsBatch = writeBatch(db);
      initialParts.forEach(p => {
          const ref = doc(collection(db, 'parts'));
          partsBatch.set(ref, { value: p });
      });
      await partsBatch.commit();

      const wpBatch = writeBatch(db);
      initialWorkplaces.forEach(w => {
          const ref = doc(collection(db, 'workplaces'));
          wpBatch.set(ref, { value: w });
      });
      await wpBatch.commit();

      const mrBatch = writeBatch(db);
      initialMissingReasons.forEach(r => {
          const ref = doc(collection(db, 'missing_reasons'));
          mrBatch.set(ref, { value: r });
      });
      await mrBatch.commit();
  };


  // --- 2. AUTH ACTIONS ---

  const handleLogin = (username: string, role: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER' | 'LOGISTICIAN') => {
    setIsAuthenticated(true);
    setCurrentUser(username);
    setCurrentUserRole(role);
    localStorage.setItem('app_user', username);
    localStorage.setItem('app_role', role);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser('');
    setCurrentUserRole('USER');
    localStorage.removeItem('app_user');
    localStorage.removeItem('app_role');
  };

  const handleAddUser = async (user: UserData) => {
      await addDoc(collection(db, 'users'), user);
  };

  const handleUpdatePassword = async (username: string, newPass: string) => {
      const userToUpdate = users.find(u => u.username === username);
      if (userToUpdate && userToUpdate.id) {
          await updateDoc(doc(db, 'users', userToUpdate.id), { password: newPass });
      }
  };

  const handleUpdateUserRole = async (username: string, newRole: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER' | 'LOGISTICIAN') => {
      const userToUpdate = users.find(u => u.username === username);
      if (userToUpdate && userToUpdate.id) {
          await updateDoc(doc(db, 'users', userToUpdate.id), { role: newRole });
      }
  }

  const handleDeleteUser = async (username: string) => {
      const userToDelete = users.find(u => u.username === username);
      if (userToDelete && userToDelete.id) {
          await deleteDoc(doc(db, 'users', userToDelete.id));
      }
  };


  // --- 3. DB ACTIONS (Parts/Workplaces/Reasons) ---

  const handleAddPart = async (val: string) => {
      await addDoc(collection(db, 'parts'), { value: val });
  };

  const handleBatchAddParts = async (vals: string[]) => {
      const batch = writeBatch(db);
      vals.forEach(val => {
          const ref = doc(collection(db, 'parts'));
          batch.set(ref, { value: val });
      });
      await batch.commit();
  };
  
  const handleDeletePart = async (id: string) => {
      await deleteDoc(doc(db, 'parts', id));
  };

  const handleDeleteAllParts = async () => {
      const q = query(collection(db, 'parts'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
  };

  const handleAddWorkplace = async (val: string, time?: number) => {
      await addDoc(collection(db, 'workplaces'), { value: val, standardTime: time || 0 });
  };

  const handleBatchAddWorkplaces = async (vals: string[]) => {
      const batch = writeBatch(db);
      vals.forEach(line => {
          const parts = line.split(';');
          const val = parts[0].trim();
          let time = 0;
          if (parts.length > 1) {
              const parsedTime = parseInt(parts[1].trim(), 10);
              if (!isNaN(parsedTime)) time = parsedTime;
          }

          if (val) {
              const ref = doc(collection(db, 'workplaces'));
              batch.set(ref, { value: val, standardTime: time });
          }
      });
      await batch.commit();
  };

  const handleDeleteWorkplace = async (id: string) => {
      await deleteDoc(doc(db, 'workplaces', id));
  };

  const handleDeleteAllWorkplaces = async () => {
      const q = query(collection(db, 'workplaces'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
  };

  const handleAddMissingReason = async (val: string) => {
      await addDoc(collection(db, 'missing_reasons'), { value: val });
  };

  const handleDeleteMissingReason = async (id: string) => {
      await deleteDoc(doc(db, 'missing_reasons', id));
  };

  // --- Break Schedule Actions ---
  const handleAddBreakSchedule = async (start: string, end: string) => {
      await addDoc(collection(db, 'break_schedules'), { start, end });
  };

  const handleDeleteBreakSchedule = async (id: string) => {
      await deleteDoc(doc(db, 'break_schedules', id));
  };

  const handleManualEndBreak = async () => {
      const activeBreak = systemBreaks.find(b => b.isActive);
      if (activeBreak) {
          await updateDoc(doc(db, 'system_breaks', activeBreak.id), {
              end: Date.now(),
              isActive: false
          });
      }
  };

  // --- BOM Actions ---
  const handleAddBOMItem = async (parent: string, child: string, qty: number) => {
      await addDoc(collection(db, 'bom_items'), { parentPart: parent, childPart: child, quantity: qty });
  };

  const handleBatchAddBOMItems = async (vals: string[]) => {
      const batch = writeBatch(db);
      vals.forEach(line => {
          const parts = line.split(';');
          if (parts.length >= 3) {
              const parent = parts[0].trim();
              const child = parts[1].trim();
              // FIX: Replace comma with dot for European formats and use parseFloat
              const qtyStr = parts[2].trim().replace(',', '.');
              const qty = parseFloat(qtyStr);
              if (parent && child && !isNaN(qty)) {
                  const ref = doc(collection(db, 'bom_items'));
                  batch.set(ref, { parentPart: parent, childPart: child, quantity: qty });
              }
          }
      });
      await batch.commit();
  };

  const handleDeleteBOMItem = async (id: string) => {
      await deleteDoc(doc(db, 'bom_items', id));
  };

  const handleDeleteAllBOMItems = async () => {
      const q = query(collection(db, 'bom_items'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
  };

  const handleRequestBOM = async (parentPart: string): Promise<boolean> => {
      const exists = bomRequests.some(r => r.parentPart.toUpperCase() === parentPart.toUpperCase());
      if (exists) return false;
      
      await addDoc(collection(db, 'bom_requests'), {
          parentPart,
          requestedBy: currentUser,
          requestedAt: Date.now()
      });
      return true;
  };

  const handleApproveBOMRequest = async (req: BOMRequest) => {
      await deleteDoc(doc(db, 'bom_requests', req.id));
  };

  const handleRejectBOMRequest = async (id: string) => {
      await deleteDoc(doc(db, 'bom_requests', id));
  };


  // --- 4. REQUEST ACTIONS ---
  
  const handleRequestNewPart = async (partNumber: string): Promise<boolean> => {
      const existsInDb = parts.some(p => p.value.toUpperCase() === partNumber.toUpperCase());
      if (existsInDb) {
          alert('Tento diel už v databáze existuje.');
          return false;
      }

      const alreadyRequested = partRequests.some(r => r.partNumber.toUpperCase() === partNumber.toUpperCase());
      if (alreadyRequested) {
          alert('O tento diel už bolo požiadané.');
          return false;
      }

      try {
          await addDoc(collection(db, 'part_requests'), {
              partNumber: partNumber,
              requestedBy: currentUser,
              requestedAt: Date.now()
          });
          return true;
      } catch (error) {
          console.error("Error adding request:", error);
          alert("Chyba pri odosielaní žiadosti. Skúste znova.");
          return false;
      }
  };

  const handleApprovePartRequest = async (req: PartRequest) => {
      await handleAddPart(req.partNumber);
      await deleteDoc(doc(db, 'part_requests', req.id));
  };

  const handleRejectPartRequest = async (id: string) => {
      await deleteDoc(doc(db, 'part_requests', id));
  };


  // --- 5. TASK ACTIONS ---

  const handleAddTask = async (
      partNumber: string, 
      workplace: string, 
      quantity: string, 
      quantityUnit: string, 
      priority: PriorityLevel = 'NORMAL'
    ) => {
    
    // STRICT BREAK CHECK LOGIC
    // 1. Check if DB says break is active
    let blocked = isBreakActive;

    // 2. Double check local time against schedules (in case DB is lagging)
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentHM = `${hours}:${minutes}`;

    const isLocalBreakTime = breakSchedules.some(s => currentHM >= s.start && currentHM < s.end);
    
    if (isLocalBreakTime) blocked = true;

    if (blocked && currentUserRole !== 'ADMIN') {
        alert("Počas prestávky nie je možné pridávať úlohy.");
        return;
    }

    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    
    let formattedQty = quantity;
    if (quantityUnit === 'boxes') {
         const num = parseInt(quantity, 10);
         if (num === 1) formattedQty = `1 box`;
         else if (num > 1 && num < 5) formattedQty = `${num} boxy`;
         else formattedQty = `${num} boxov`;
    } else if (quantityUnit === 'pallet') {
         const num = parseInt(quantity, 10);
         if (num === 1) formattedQty = `Celá paleta`;
         else if (num > 1 && num < 5) formattedQty = `${num} palety`;
         else formattedQty = `${num} paliet`;
    }

    const taskText = `${formattedDate} / ${partNumber} / ${workplace} / Počet: ${formattedQty}`;

    const workplaceObj = workplaces.find(wp => wp.value === workplace);
    const standardTime = workplaceObj?.standardTime || 0;

    await addDoc(collection(db, 'tasks'), {
      text: taskText,
      partNumber,
      workplace,
      quantity,
      quantityUnit,
      standardTime: standardTime,
      isDone: false,
      priority: priority,
      createdAt: Date.now(),
      createdBy: currentUser 
    });
  };

  const handleToggleTask = async (id: string) => {
    const taskToToggle = tasks.find(t => t.id === id);
    if (taskToToggle) {
      const newState = !taskToToggle.isDone;
      
      const updateData: any = {
          isDone: newState,
          status: newState ? 'completed' : null
      };

      if (newState) {
          const now = new Date();
          const timeString = now.toLocaleTimeString('sk-SK');
          updateData.completionTime = timeString;
          updateData.completedBy = currentUser;
          updateData.completedAt = Date.now();
          updateData.isInProgress = false;
          updateData.inProgressBy = null;
          updateData.isBlocked = false; 
      } else {
          updateData.completionTime = null;
          updateData.completedBy = null;
          updateData.completedAt = null;
      }

      await updateDoc(doc(db, 'tasks', id), updateData);
    }
  };

  const handleMarkAsIncorrect = async (id: string) => {
    const taskToUpdate = tasks.find(t => t.id === id);
    if (taskToUpdate) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('sk-SK');
        const updateData = {
            isDone: true,
            status: 'incorrectly_entered' as const,
            completionTime: timeString,
            completedBy: currentUser,
            completedAt: Date.now(),
            isInProgress: false,
            inProgressBy: null,
            isBlocked: false,
        };
        await updateDoc(doc(db, 'tasks', id), updateData);
    }
  };

  const handleSetInProgress = async (id: string) => {
      const task = tasks.find(t => t.id === id);
      if (task) {
          const newStatus = !task.isInProgress;
          const updateData: any = {
              isInProgress: newStatus,
              inProgressBy: newStatus ? currentUser : null
          };
          
          if (newStatus && !task.startedAt) {
              updateData.startedAt = Date.now();
          }

          await updateDoc(doc(db, 'tasks', id), updateData);
      }
  };

  const handleAddNote = async (id: string, note: string) => {
      await updateDoc(doc(db, 'tasks', id), { note });
  };

  const handleReleaseTask = async (id: string) => {
      const task = tasks.find(t => t.id === id);
      if (task && task.isInProgress) {
          await updateDoc(doc(db, 'tasks', id), {
              isInProgress: false,
              inProgressBy: null
          });
      }
  };

  const handleEditTask = async (id: string, newText: string, newPriority?: PriorityLevel) => {
      const updateData: any = { text: newText };
      if (newPriority) {
          updateData.priority = newPriority;
      }
      await updateDoc(doc(db, 'tasks', id), updateData);
  };

  const handleDeleteTask = async (id: string) => {
    await deleteDoc(doc(db, 'tasks', id));
  };

  const handleToggleMissing = async (id: string, reason?: string) => {
      const task = tasks.find(t => t.id === id);
      if (task) {
          const newMissingState = !task.isMissing;
          await updateDoc(doc(db, 'tasks', id), { 
              isMissing: newMissingState,
              missingReportedBy: newMissingState ? currentUser : null,
              missingReason: newMissingState ? (reason || 'Iné') : null
          });
      }
  };

  const handleToggleBlock = async (id: string) => {
      const task = tasks.find(t => t.id === id);
      if (task) {
          const isBlocked = !task.isBlocked;
          const inventoryHistory = task.inventoryHistory ? [...task.inventoryHistory] : [];
          
          if (isBlocked) {
              inventoryHistory.push({ start: Date.now() });
          } else {
              const lastIndex = inventoryHistory.length - 1;
              if (lastIndex >= 0 && !inventoryHistory[lastIndex].end) {
                  inventoryHistory[lastIndex].end = Date.now();
              }
          }

          await updateDoc(doc(db, 'tasks', id), {
              isBlocked,
              inventoryHistory
          });
      }
  };

  // --- 6. ARCHIVE ACTIONS ---

  const handleArchiveTasks = async () => {
      try {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - ONE_DAY_MS;

        const q = query(
            collection(db, 'tasks'), 
            where('isDone', '==', true),
            limit(1000) 
        );
        
        const snapshot = await getDocs(q);
        
        const toArchiveDocs = snapshot.docs.filter(doc => {
            const task = doc.data() as Task;
            return !task.completedAt || task.completedAt < cutoffTime;
        });

        if (toArchiveDocs.length === 0) {
            return { success: true, count: 0, message: "Žiadne úlohy staršie ako 24h na archiváciu." };
        }

        const batchSize = 450; 
        const chunks = [];
        for (let i = 0; i < toArchiveDocs.length; i += batchSize) {
            chunks.push(toArchiveDocs.slice(i, i + batchSize));
        }

        let totalMoved = 0;

        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(taskDoc => {
                const data = taskDoc.data();
                const newRef = doc(collection(db, 'archived_tasks'));
                batch.set(newRef, { ...data, archivedAt: Date.now() });
                batch.delete(taskDoc.ref);
                totalMoved++;
            });
            await batch.commit();
        }

        return { success: true, count: totalMoved };
      } catch (error: any) {
        console.error("Archiving failed:", error);
        return { success: false, error: error.message };
      }
  };

  const fetchArchivedTasks = async (): Promise<Task[]> => {
      try {
          const q = query(collection(db, 'archived_tasks'));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      } catch (error) {
          console.error("Error fetching archive:", error);
          return [];
      }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
      {!isAuthenticated ? (
        <LoginScreen onLoginSuccess={handleLogin} users={users} />
      ) : (
        <PartSearchScreen 
          currentUser={currentUser}
          currentUserRole={currentUserRole}
          onLogout={handleLogout}
          tasks={tasks}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onToggleMissing={handleToggleMissing}
          onSetInProgress={handleSetInProgress}
          onToggleBlock={handleToggleBlock}
          onMarkAsIncorrect={handleMarkAsIncorrect}
          onAddNote={handleAddNote}
          onReleaseTask={handleReleaseTask}
          // User Management Props
          users={users}
          onAddUser={handleAddUser}
          onUpdatePassword={handleUpdatePassword}
          onUpdateUserRole={handleUpdateUserRole}
          onDeleteUser={handleDeleteUser}
          // DB Management Props
          parts={parts}
          workplaces={workplaces}
          missingReasons={missingReasons}
          onAddPart={handleAddPart}
          onBatchAddParts={handleBatchAddParts}
          onDeletePart={handleDeletePart}
          onDeleteAllParts={handleDeleteAllParts}
          onAddWorkplace={handleAddWorkplace}
          onBatchAddWorkplaces={handleBatchAddWorkplaces}
          onDeleteWorkplace={handleDeleteWorkplace}
          onDeleteAllWorkplaces={handleDeleteAllWorkplaces}
          onAddMissingReason={handleAddMissingReason}
          onDeleteMissingReason={handleDeleteMissingReason}
          // Part Requests
          partRequests={partRequests}
          onRequestPart={handleRequestNewPart}
          onApprovePartRequest={handleApprovePartRequest}
          onRejectPartRequest={handleRejectPartRequest}
          // Archive
          onArchiveTasks={handleArchiveTasks}
          onFetchArchivedTasks={fetchArchivedTasks}
          // Breaks
          breakSchedules={breakSchedules}
          systemBreaks={systemBreaks}
          isBreakActive={isBreakActive}
          onAddBreakSchedule={handleAddBreakSchedule}
          onDeleteBreakSchedule={handleDeleteBreakSchedule}
          onEndBreak={handleManualEndBreak}
          // BOM Props
          bomItems={bomItems}
          bomRequests={bomRequests}
          onAddBOMItem={handleAddBOMItem}
          onBatchAddBOMItems={handleBatchAddBOMItems}
          onDeleteBOMItem={handleDeleteBOMItem}
          onDeleteAllBOMItems={handleDeleteAllBOMItems}
          onRequestBOM={handleRequestBOM}
          onApproveBOMRequest={handleApproveBOMRequest}
          onRejectBOMRequest={handleRejectBOMRequest}
          // PWA Install
          installPrompt={deferredPrompt}
          onInstallApp={handleInstallApp}
        />
      )}
    </div>
  );
};

export default App;
