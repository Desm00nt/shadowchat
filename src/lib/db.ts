import { openDB, type IDBPDatabase } from 'idb';

export interface ChatMessage {
  id: string;
  chatId: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
}

export interface Contact {
  peerId: string;
  name: string;
  addedAt: number;
  lastSeen?: number;
  avatar?: string;
}

export interface UserProfile {
  peerId: string;
  name: string;
  createdAt: number;
}

const DB_NAME = 'denchat-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase | null = null;

export async function getDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Messages store
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('byChatId', 'chatId');
        msgStore.createIndex('byTimestamp', 'timestamp');
      }
      // Contacts store
      if (!db.objectStoreNames.contains('contacts')) {
        db.createObjectStore('contacts', { keyPath: 'peerId' });
      }
      // Profile store
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'peerId' });
      }
    },
  });

  return dbInstance;
}

// Profile
export async function saveProfile(profile: UserProfile) {
  const db = await getDB();
  await db.put('profile', profile);
}

export async function getProfile(): Promise<UserProfile | undefined> {
  const db = await getDB();
  const all = await db.getAll('profile');
  return all[0];
}

// Contacts
export async function saveContact(contact: Contact) {
  const db = await getDB();
  await db.put('contacts', contact);
}

export async function getContacts(): Promise<Contact[]> {
  const db = await getDB();
  return db.getAll('contacts');
}

export async function deleteContact(peerId: string) {
  const db = await getDB();
  await db.delete('contacts', peerId);
}

// Messages
export async function saveMessage(message: ChatMessage) {
  const db = await getDB();
  await db.put('messages', message);
}

export async function getMessagesByChatId(chatId: string): Promise<ChatMessage[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('messages', 'byChatId', chatId);
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getAllMessages(): Promise<ChatMessage[]> {
  const db = await getDB();
  return db.getAll('messages');
}

export async function deleteMessagesByChatId(chatId: string) {
  const db = await getDB();
  const messages = await db.getAllFromIndex('messages', 'byChatId', chatId);
  const tx = db.transaction('messages', 'readwrite');
  for (const msg of messages) {
    await tx.store.delete(msg.id);
  }
  await tx.done;
}
