// @ts-ignore
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Vaša konfigurácia pre Firebase projekt sklad-ulohy
const firebaseConfig = {
  apiKey: "AIzaSyAfpO5WnMt-6lWI6i0XNpfcPGkbrMEpoo4",
  authDomain: "sklad-ulohy.firebaseapp.com",
  projectId: "sklad-ulohy",
  storageBucket: "sklad-ulohy.firebasestorage.app",
  messagingSenderId: "782478005476",
  appId: "1:782478005476:web:8b9d08723322cb6f3088f1"
};

// Inicializácia Firebase
const app = initializeApp(firebaseConfig);

// Exportovanie databázy pre použitie v aplikácii
export const db = getFirestore(app);
