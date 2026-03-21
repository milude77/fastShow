import { db } from './chatServer.js';

export async function compareContactInformation(userId, version) {
    const userContactVersion = await db('users')
        .where('id', userId)
        .select('contact_list_version')
        .first();
    if (!userContactVersion || userContactVersion.contact_list_version === version) {
        return
    }
    const contactListChange = await db('user_event')
        .where('user_id', userId)
        .andWhere('id', '>', version)
        .select('event_data', 'action')

    return { contactListChange, contactVersion: userContactVersion.contact_list_version }
}
