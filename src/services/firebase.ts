// [OWNER: SYNC] Firebase auth + Firestore. With no env config the app runs in
// DEMO MODE and these functions are no-ops (AppContext uses src/mocks instead).
//
// Data model (see firestore.rules):
//   users/{uid}:  name, lastLocation{latitude,longitude}, locationTs, status, groupIds[], expoPushToken
//   groups/{gid}: name, inviteCode, memberIds[], meetingPlace, safeAreas[]
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
// @ts-ignore getReactNativePersistence is only in firebase's RN typings
import { getAuth, getReactNativePersistence, initializeAuth, signInAnonymously, type Auth } from 'firebase/auth';
import {
  arrayUnion,
  collection,
  doc,
  documentId,
  getDocs,
  getFirestore,
  initializeFirestore,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
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
  try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast Refresh re-runs this module while Auth is already initialised on the app.
    auth = getAuth(app);
  }
  try {
    // Auto-detect long polling: Firestore's default WebChannel transport can hang on
    // React Native and on restrictive (hackathon) Wi-Fi.
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    db = getFirestore(app); // already initialised (Fast Refresh)
  }
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
// Helpers
// ---------------------------------------------------------------------------

/** No 0/O/1/I so codes are easy to read aloud and type. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

async function isCodeFree(firestore: Firestore, code: string): Promise<boolean> {
  const snap = await getDocs(query(collection(firestore, 'groups'), where('inviteCode', '==', code), limit(1)));
  return snap.empty;
}

function toGroup(id: string, d: DocumentData): Group {
  return {
    id,
    name: d.name ?? 'Group',
    inviteCode: d.inviteCode ?? '',
    memberIds: d.memberIds ?? [],
    meetingPlace: d.meetingPlace ?? null,
    safeAreas: d.safeAreas ?? [],
  };
}

function toMember(uid: string, d: DocumentData): Member {
  const l = d.lastLocation;
  const hasLoc = l && typeof l.latitude === 'number' && typeof l.longitude === 'number';
  return {
    uid,
    name: d.name ?? 'Unnamed',
    location: hasLoc ? { latitude: l.latitude, longitude: l.longitude } : null,
    locationTs: typeof d.locationTs === 'number' ? d.locationTs : null,
    status: d.status === 'safe' || d.status === 'need_help' ? d.status : 'unknown',
  };
}

// ---------------------------------------------------------------------------
// Profile / groups
// ---------------------------------------------------------------------------

/** users/{uid} { name } (merge, so it works whether or not the doc exists yet). */
export async function saveProfile(uid: string, name: string): Promise<void> {
  const firestore = getDb();
  if (!firestore) return;
  await setDoc(doc(firestore, 'users', uid), { name }, { merge: true });
}

/** Creates groups/{auto} with a random 6-char inviteCode and the creator as the only member. */
export async function createGroup(uid: string, name: string): Promise<Group | null> {
  const firestore = getDb();
  if (!firestore) return null;

  let inviteCode = randomCode();
  for (let i = 0; i < 4 && !(await isCodeFree(firestore, inviteCode)); i++) inviteCode = randomCode();

  const ref = doc(collection(firestore, 'groups'));
  const data = { name, inviteCode, memberIds: [uid], meetingPlace: null, safeAreas: [] };
  await setDoc(ref, data);
  // Best effort: remember the group on the user doc (also creates users/{uid} if missing).
  await setDoc(doc(firestore, 'users', uid), { groupIds: arrayUnion(ref.id) }, { merge: true }).catch(() => {});
  return toGroup(ref.id, data);
}

/** Looks up a group by invite code and adds `uid` to memberIds. Returns null for an unknown code. */
export async function joinGroup(uid: string, inviteCode: string): Promise<Group | null> {
  const firestore = getDb();
  if (!firestore) return null;

  const code = inviteCode.trim().toUpperCase();
  const snap = await getDocs(query(collection(firestore, 'groups'), where('inviteCode', '==', code), limit(1)));
  const found = snap.docs[0];
  if (!found) return null;

  await updateDoc(found.ref, { memberIds: arrayUnion(uid) });
  await setDoc(doc(firestore, 'users', uid), { groupIds: arrayUnion(found.id) }, { merge: true }).catch(() => {});

  const g = toGroup(found.id, found.data());
  return g.memberIds.includes(uid) ? g : { ...g, memberIds: [...g.memberIds, uid] };
}

// ---------------------------------------------------------------------------
// Live listeners (each returns an unsubscribe function)
// ---------------------------------------------------------------------------

export function subscribeGroup(groupId: string, cb: (g: Group) => void): () => void {
  const firestore = getDb();
  if (!firestore) return () => {};
  return onSnapshot(
    doc(firestore, 'groups', groupId),
    (snap) => {
      if (snap.exists()) cb(toGroup(snap.id, snap.data()));
    },
    (e) => console.warn('subscribeGroup', e.message),
  );
}

/** Live member profiles. Firestore `in` queries take at most 30 ids, so large groups are chunked. */
export function subscribeMembers(memberIds: string[], cb: (m: Member[]) => void): () => void {
  const firestore = getDb();
  if (!firestore || memberIds.length === 0) return () => {};

  const chunks: string[][] = [];
  for (let i = 0; i < memberIds.length; i += 30) chunks.push(memberIds.slice(i, i + 30));

  const results = new Map<number, Member[]>();
  const unsubs = chunks.map((ids, i) =>
    onSnapshot(
      query(collection(firestore, 'users'), where(documentId(), 'in', ids)),
      (snap) => {
        results.set(i, snap.docs.map((d) => toMember(d.id, d.data())));
        cb(Array.from(results.values()).flat());
      },
      (e) => console.warn('subscribeMembers', e.message),
    ),
  );
  return () => unsubs.forEach((u) => u());
}

// ---------------------------------------------------------------------------
// Writes. users/{uid} writes use setDoc+merge (not updateDoc) so they succeed even if
// the profile doc doesn't exist yet, e.g. the first location fix before a name is saved.
// ---------------------------------------------------------------------------

/** Caller already throttles (see location.shouldPublish). */
export async function publishLocation(uid: string, coord: LatLng): Promise<void> {
  const firestore = getDb();
  if (!firestore) return;
  await setDoc(
    doc(firestore, 'users', uid),
    { lastLocation: { latitude: coord.latitude, longitude: coord.longitude }, locationTs: Date.now() },
    { merge: true },
  );
}

/** TODO (stretch): push to the group via Expo Push API when status becomes 'need_help'. */
export async function publishStatus(uid: string, status: MemberStatus): Promise<void> {
  const firestore = getDb();
  if (!firestore) return;
  await setDoc(doc(firestore, 'users', uid), { status }, { merge: true });
}

export async function setMeetingPlace(groupId: string, place: Place): Promise<void> {
  const firestore = getDb();
  if (!firestore) return;
  await updateDoc(doc(firestore, 'groups', groupId), { meetingPlace: place });
}

export async function addSafeArea(groupId: string, place: Place): Promise<void> {
  const firestore = getDb();
  if (!firestore) return;
  await updateDoc(doc(firestore, 'groups', groupId), { safeAreas: arrayUnion(place) });
}
