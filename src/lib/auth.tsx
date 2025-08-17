"use client";

import type { User } from '@/types';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<User | null>;
  logout: () => void;
  register: (name: string, email: string, pass:string, role?: 'USER' | 'ADMIN') => Promise<User | null>;
  loading: boolean;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('linklocker-user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('linklocker-user');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string): Promise<User | null> => {
    setLoading(true);
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            console.log("No user found with this email.");
            return null;
        }

        const userDoc = querySnapshot.docs[0];
        const foundUser = { id: userDoc.id, ...userDoc.data() } as User;
        
        // In a real app, you'd use a proper password hashing and verification library.
        // For this prototype, we'll do a simple string comparison.
        if (foundUser.password !== pass) {
            console.log("Password does not match.");
            return null;
        }

        // The password is correct, log the user in.
        setUser(foundUser);
        localStorage.setItem('linklocker-user', JSON.stringify(foundUser));
        return foundUser;
    } catch (e) {
        console.error("Error during login: ", e);
        return null;
    } finally {
        setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('linklocker-user');
  };

  const register = async (name: string, email: string, pass: string, role: 'USER' | 'ADMIN' = 'USER'): Promise<User | null> => {
    setLoading(true);
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));

    try {
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        console.log("An account with this email already exists.");
        return null;
      }

      const newUser: Omit<User, 'id'> = {
        name,
        email,
        password: pass, // In a real app, hash this password!
        role,
        avatarUrl: `https://placehold.co/100x100.png`,
        points: 0,
      };

      const docRef = await addDoc(usersRef, { ...newUser, createdAt: serverTimestamp() });
      const createdUser = { ...newUser, id: docRef.id };
      
      // Don't log in the user automatically, prompt them to log in.
      return createdUser;

    } catch (e) {
      console.error("Error during registration: ", e);
      return null;
    } finally {
        setLoading(false);
    }
  };
  
  const updateUser = (updatedUserData: User) => {
    setUser(updatedUserData);
    if (typeof window !== 'undefined') {
      localStorage.setItem('linklocker-user', JSON.stringify(updatedUserData));
    }
  }


  const value = { user, login, logout, register, loading, updateUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
