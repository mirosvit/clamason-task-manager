

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
  role: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER';
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

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER'>('USER');
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Data from DB
  const [users, setUsers] = useState<UserData[]>([]);
  const [parts, setParts] = useState<DBItem[]>([]);
  const [workplaces, setWorkplaces] = useState<DBItem[]>([]);
  const [missingReasons, setMissingReasons] = useState<DBItem[]>([]);
  const [partRequests, setPartRequests] = useState<PartRequest[]>([]);

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
    const q = query(collection(db, 'tasks')); // Removing orderBy temporarily to handle client-side sorting if needed or fix index issues
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));

      // Sort tasks: 
      // 1. Unfinished first
      // 2. Priority (URGENT > NORMAL > LOW)
      // 3. Date Created (Newest first for unfinished, Oldest first for finished? Or just standard time)
      
      const priorityOrder: Record<string, number> = { 'URGENT': 0, 'NORMAL': 1, 'LOW': 2 };

      const sortedTasks = newTasks.sort((a, b) => {
        // 1. Status: Active first
        if (a.isDone !== b.isDone) {
            return a.isDone ? 1 : -1;
        }
        
        // 2. Priority (Only for active tasks mainly, but good for all)
        const pA = priorityOrder[a.priority || 'NORMAL'];
        const pB = priorityOrder[b.priority || 'NORMAL'];
        if (pA !== pB) {
            return pA - pB;
        }

        // 3. Time (If createdAt exists, use it)
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeA - timeB; // Oldest first
      });

      setTasks(sortedTasks);
    }, (error) => {
        console.error("Error fetching tasks. Check Firebase permissions or console for links to create indexes.", error);
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


  const seedDatabase = async () => {
      // Default Users
      await addDoc(collection(db, 'users'), { username: 'USER', password: '123', role: 'USER' });
      await addDoc(collection(db, 'users'), { username: 'ADMIN', password: '321', role: 'ADMIN' });
      
      // Default Parts
      const partsBatch = writeBatch(db);
      initialParts.forEach(p => {
          const ref = doc(collection(db, 'parts'));
          partsBatch.set(ref, { value: p });
      });
      await partsBatch.commit();

      // Default Workplaces
      const wpBatch = writeBatch(db);
      initialWorkplaces.forEach(w => {
          const ref = doc(collection(db, 'workplaces'));
          wpBatch.set(ref, { value: w });
      });
      await wpBatch.commit();

      // Default Missing Reasons
      const mrBatch = writeBatch(db);
      initialMissingReasons.forEach(r => {
          const ref = doc(collection(db, 'missing_reasons'));
          mrBatch.set(ref, { value: r });
      });
      await mrBatch.commit();
  };


  // --- 2. AUTH ACTIONS ---

  const handleLogin = (username: string, role: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER') => {
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

  const handleUpdateUserRole = async (username: string, newRole: 'ADMIN' | 'USER' | 'SUPERVISOR' | 'LEADER') => {
      const userToUpdate = users.find(u => u.username === username);
      if (userToUpdate && userToUpdate.id) {
          // Prevent changing the main ADMIN role if needed, but allowing generally
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
          // Parse format: "WorkplaceName;StandardTime"
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

  // Missing Reasons Management
  const handleAddMissingReason = async (val: string) => {
      await addDoc(collection(db, 'missing_reasons'), { value: val });
  };

  const handleDeleteMissingReason = async (id: string) => {
      await deleteDoc(doc(db, 'missing_reasons', id));
  };


  // --- 4. REQUEST ACTIONS ---
  
  const handleRequestNewPart = async (partNumber: string): Promise<boolean> => {
      // 1. Validation: Check if part already exists in DB (Case insensitive)
      const existsInDb = parts.some(p => p.value.toUpperCase() === partNumber.toUpperCase());
      if (existsInDb) {
          alert('Tento diel už v databáze existuje.');
          return false;
      }

      // 2. Validation: Check if already requested
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
          console.log("Request added successfully");
          return true;
      } catch (error) {
          console.error("Error adding request:", error);
          alert("Chyba pri odosielaní žiadosti. Skúste znova.");
          return false;
      }
  };

  const handleApprovePartRequest = async (req: PartRequest) => {
      // Add to Parts
      await handleAddPart(req.partNumber);
      // Delete Request
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
    
    // Construct the legacy text string for display purposes
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
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

    // Lookup standard time for the workplace
    const workplaceObj = workplaces.find(wp => wp.value === workplace);
    const standardTime = workplaceObj?.standardTime || 0;

    await addDoc(collection(db, 'tasks'), {
      text: taskText, // Legacy support
      partNumber,
      workplace,
      quantity,
      quantityUnit,
      standardTime: standardTime, // Snapshot current standard time
      isDone: false,
      priority: priority,
      createdAt: Date.now()
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
          // Marking as Done
          const now = new Date();
          const timeString = now.toLocaleTimeString('sk-SK');
          updateData.completionTime = timeString;
          updateData.completedBy = currentUser;
          updateData.completedAt = Date.now(); // Store timestamp for analytics
          // Automatically stop "In Progress" if it was active
          updateData.isInProgress = false;
          updateData.inProgressBy = null;
          // Unblock if it was blocked? Or let inventory stay? 
          // Usually if done, it shouldn't be blocked.
          updateData.isBlocked = false; 
      } else {
          // Reopening
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
          
          // If starting progress, record start time if not already set
          if (newStatus && !task.startedAt) {
              updateData.startedAt = Date.now();
          }

          await updateDoc(doc(db, 'tasks', id), updateData);
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
              // Starting blockage
              inventoryHistory.push({ start: Date.now() });
          } else {
              // Ending blockage - find the last open session
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
            limit(1000) // Safety limit
        );
        
        const snapshot = await getDocs(q);
        
        const toArchiveDocs = snapshot.docs.filter(doc => {
            const task = doc.data() as Task;
            // Archive if it's older than 24h OR if it's a legacy task without a completion timestamp
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
        />
      )}
    </div>
  );
};

export default App;