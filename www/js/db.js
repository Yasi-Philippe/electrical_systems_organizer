/* Minimal IndexedDB wrapper.
   Store "dataset": one record holding the imported plant data.
   Store "docs": one record per stored document (PDF blobs + metadata). */
const DB = (() => {
  const DB_NAME = "pv-organizer";
  const VERSION = 2;
  const KEY = "current";

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("dataset")) db.createObjectStore("dataset");
        if (!db.objectStoreNames.contains("docs")) db.createObjectStore("docs", { keyPath: "id", autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function run(store, mode, fn) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }

  return {
    load: () => run("dataset", "readonly", (s) => s.get(KEY)),
    save: (data) => run("dataset", "readwrite", (s) => s.put(data, KEY)),
    clear: () => run("dataset", "readwrite", (s) => s.delete(KEY)),

    docsList: () => run("docs", "readonly", (s) => s.getAll()),
    docsGet: (id) => run("docs", "readonly", (s) => s.get(id)),
    docsAdd: (doc) => run("docs", "readwrite", (s) => s.add(doc)),
    docsDelete: (id) => run("docs", "readwrite", (s) => s.delete(id)),
  };
})();
