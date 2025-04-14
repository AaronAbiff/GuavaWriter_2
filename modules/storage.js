// Storage Module

// Initialize Dexie.js
const db = new Dexie('GuavaWriter');

// Initialize the database schema
export async function initStorage() {
    db.version(1).stores({
        sessions: 'id,timestamp',
        archive: 'id,timestamp'
    });
    
    // Create a default session if none exists
    const count = await db.sessions.count();
    if (count === 0) {
        await db.sessions.put({
            id: 'current',
            timestamp: new Date().toISOString(),
            step: 1
        });
    }
}

// Save session data
export async function saveSession(data) {
    if (data === null) {
        // Clear the current session
        await db.sessions.delete('current');
        await db.sessions.put({
            id: 'current',
            timestamp: new Date().toISOString(),
            step: 1
        });
        return;
    }
    
    await db.sessions.update('current', {
        ...data,
        timestamp: new Date().toISOString()
    });
}

// Load session data
export async function loadSession() {
    return await db.sessions.get('current');
}

// Export session data as JSON
export async function exportSession() {
    const session = await loadSession();
    return session;
}

// Import session data from JSON
export async function importSession(data) {
    // Archive the current session
    const currentSession = await loadSession();
    if (currentSession) {
        await db.archive.put({
            ...currentSession,
            id: `archive_${Date.now()}`,
            archivedAt: new Date().toISOString()
        });
    }
    
    // Import the new session
    await db.sessions.update('current', {
        ...data,
        timestamp: new Date().toISOString()
    });
}

// List archived sessions
export async function listArchives() {
    return await db.archive.toArray();
}

// Load an archived session
export async function loadArchive(id) {
    return await db.archive.get(id);
}
