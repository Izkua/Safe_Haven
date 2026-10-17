// [OWNER: SYNC] Firebase auth + Firestore. With no env config the app runs in
// DEMO MODE and these functions are no-ops (AppContext uses src/mocks instead).
//
// Data model (see firestore.rules):
//   users/{uid}:  name, lastLocation{latitude,longitude}, locationTs, status, groupIds[], expoPushToken
//   groups/{gid}: name, inviteCode, memberIds[], meetingPlace, safeAreas[]
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
// @ts-ignore getReactNativePersistence is only in firebase's RN typings
import { getReactNativePersistence, initializeAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import type { Group, LatLng, Member, MemberStatus, Place } from '@/types';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = !!config.apiKey && !!config.projectId;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function init() {
  if (!isFirebaseConfigured || app) return;
  app = getApps()[0] ?? initializeApp(config);
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  db = getFirestore(app);
}

/** Returns the signed-in uid (anonymous auth), or 'me' in demo mode. */
export async function ensureSignedIn(): Promise<string> {
  init();
  if (!auth) return 'me';
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export function getDb(): Firestore | null {
  init();
  return db;
}

// ---------------------------------------------------------------------------
// Everything below is a stub with the agreed signature. Implement with
// firebase/firestore (doc, setDoc, updateDoc, onSnapshot, query, where, arrayUnion).
// ---------------------------------------------------------------------------

/** TODO [SYNC]: setDoc users/{uid} { name } (merge). */
export async function saveProfile(uid: string, name: string): Promise<void> {
  if (!getDb()) return;
  console.warn('TODO saveProfile', uid, name);
}

/** TODO [SYNC]: create groups/{auto} with random 6-char inviteCode, memberIds [uid]. */
export async function createGroup(uid: string, name: string): Promise<Group | null> {
  if (!getDb()) return null;
  console.warn('TODO createGroup', uid, name);
  return null;
}

/** TODO [SYNC]: query groups where inviteCode == code, arrayUnion(uid) into memberIds. */
export async function joinGroup(uid: string, inviteCode: string): Promise<Group | null> {
  if (!getDb()) return null;
  console.warn('TODO joinGroup', uid, inviteCode);
  return null;
}

/** TODO [SYNC]: onSnapshot(groups/{groupId}). Return unsubscribe. */
export function subscribeGroup(groupId: string, cb: (g: Group) => void): () => void {
  if (!getDb()) return () => {};
  console.warn('TODO subscribeGroup', groupId, cb);
  return () => {};
}

/** TODO [SYNC]: onSnapshot users where documentId() in memberIds (chunk by 30). */
export function subscribeMembers(memberIds: string[], cb: (m: Member[]) => void): () => void {
  if (!getDb()) return () => {};
  console.warn('TODO subscribeMembers', memberIds, cb);
  return () => {};
}

/** TODO [SYNC]: updateDoc users/{uid} { lastLocation, locationTs }. Caller already throttles. */
export async function publishLocation(uid: string, coord: LatLng): Promise<void> {
  if (!getDb()) return;
  console.warn('TODO publishLocation', uid, coord);
}

/** TODO [SYNC]: updateDoc users/{uid} { status }. Later: trigger push to group on 'need_help'. */
export async function publishStatus(uid: string, status: MemberStatus): Promise<void> {
  if (!getDb()) return;
  console.warn('TODO publishStatus', uid, status);
}

/** TODO [SYNC]: updateDoc groups/{groupId} { meetingPlace }. */
export async function setMeetingPlace(groupId: string, place: Place): Promise<void> {
  if (!getDb()) return;
  console.warn('TODO setMeetingPlace', groupId, place);
}

/** TODO [SYNC]: updateDoc groups/{groupId} { safeAreas: arrayUnion(place) }. */
export async function addSafeArea(groupId: string, place: Place): Promise<void> {
  if (!getDb()) return;
  console.warn('TODO addSafeArea', groupId, place);
}
