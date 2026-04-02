import React, { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { Music } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { logActivity } from '../../lib/activity';
import NotationPlayer from '../notation-player/NotationPlayer';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      const isNewSignIn = !user && u;
      setUser(u);
      setLoading(false);
      if (u && isNewSignIn) {
        await logActivity(u, 'signed_in');
      }
    });
    return unsubscribe;
  }, []);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: any) {
      if (e?.code !== 'auth/popup-closed-by-user') {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
        <div className="text-gray-400 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-10 max-w-sm w-full text-center">
          <div className="p-3 bg-black rounded-2xl inline-block mb-5">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-serif italic font-bold mb-2 text-[#1A1A1A]">
            Carnatic Notation Player
          </h1>
          <p className="text-sm text-gray-500 mb-8 font-serif italic">
            Sign in to access and play notation files
          </p>
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className="flex items-center justify-center gap-3 w-full px-6 py-3 rounded-full border border-gray-200 bg-white hover:bg-gray-50 font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GoogleIcon />
            {signingIn ? 'Signing in…' : 'Sign in with Google'}
          </button>
          {error && <p className="mt-4 text-xs text-red-500">{error}</p>}
        </div>
      </div>
    );
  }

  return <NotationPlayer user={user} onSignOut={handleSignOut} />;
}
