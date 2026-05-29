import { registerGroupListeners } from './groupListeners.js';
import { registerContactListeners } from './conatctListeners.js';

export async function registerSocketListeners(socket, db) {
    await registerGroupListeners(socket, db);
    await registerContactListeners(socket, db);
}