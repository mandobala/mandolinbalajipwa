import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';

export async function logActivity(
  user: User,
  event: 'signed_in' | 'song_loaded' | 'song_played',
  meta?: { song?: string; raga?: string; file?: string }
) {
  try {
    await addDoc(collection(db, 'activity'), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      event,
      ...(meta ?? {}),
      timestamp: serverTimestamp(),
    });
  } catch {
    // Logging failures should never break the player
  }
}
