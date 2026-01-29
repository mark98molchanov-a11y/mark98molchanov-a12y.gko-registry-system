class IndexedDBManager {
    constructor(dbName = 'TreeAppDB', version = 3) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }
    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('treeData')) {
                    db.createObjectStore('treeData', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'id' });
                }
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            
            request.onerror = (event) => {
                reject(`IndexedDB error: ${event.target.error}`);
            };
        });
    }
    async getStore(storeName, mode = 'readonly') {
        if (!this.db) await this.open();
        return this.db.transaction(storeName, mode).objectStore(storeName);
    }
    async saveData(key, data) {
        try {
            const store = await this.getStore('treeData', 'readwrite');
            return new Promise((resolve, reject) => {
                const request = store.put({ id: key, data });
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('Save error:', error);
            throw error;
        }
    }
    async loadData(key) {
        try {
            const store = await this.getStore('treeData');
            return new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result?.data || null);
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('Load error:', error);
            throw error;
        }
    }

    async saveFile(fileId, fileData) {
        try {
            const store = await this.getStore('files', 'readwrite');
            return new Promise((resolve, reject) => {
                const request = store.put({ id: fileId, ...fileData });
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('File save error:', error);
            throw error;
        }
    }
    async getFile(fileId) {
        try {
            const store = await this.getStore('files');
            return new Promise((resolve, reject) => {
                const request = store.get(fileId);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('File load error:', error);
            throw error;
        }
    }
    async deleteFile(fileId) {
        try {
            const store = await this.getStore('files', 'readwrite');
            return new Promise((resolve, reject) => {
                const request = store.delete(fileId);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('File delete error:', error);
            throw error;
        }
    }
    async getAllFiles() {
        try {
            const store = await this.getStore('files');
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (error) {
            console.error('Get all files error:', error);
            throw error;
        }
    }
}
