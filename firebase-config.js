import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
export const firebaseConfig={
  apiKey:"AIzaSyC5L8hm-zG05Fj2lGViwfITe4g_M3FgV2o",
  authDomain:"familyauto-s.firebaseapp.com",
  projectId:"familyauto-s",
  storageBucket:"familyauto-s.firebasestorage.app",
  messagingSenderId:"972507333936",
  appId:"1:972507333936:web:3eab9a3bdd7d4df348f4f5",
  measurementId:"G-PE0Q7D349W"
};
export const app=getApps().length?getApp():initializeApp(firebaseConfig);