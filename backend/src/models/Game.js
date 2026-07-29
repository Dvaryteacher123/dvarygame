import { db } from '../config/firebase.js';

const COLLECTION = 'games';

export class Game {
  static async create(gameData) {
    const docRef = db.collection(COLLECTION).doc();
    await docRef.set({
      ...gameData,
      id: docRef.id,
      downloads: 0,
      isHidden: false,
      isFeatured: false,
      isTrending: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return docRef;
  }

  static async findById(id) {
    const doc = await db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  static async update(id, data) {
    await db.collection(COLLECTION).doc(id).update({
      ...data,
      updatedAt: new Date().toISOString()
    });
    return this.findById(id);
  }

  static async delete(id) {
    await db.collection(COLLECTION).doc(id).delete();
    return true;
  }

  static async getAll(options = {}) {
    let query = db.collection(COLLECTION);
    
    if (options.isHidden !== undefined) {
      query = query.where('isHidden', '==', options.isHidden);
    }
    
    if (options.type) {
      query = query.where('type', '==', options.type);
    }
    
    if (options.category) {
      query = query.where('category', '==', options.category);
    }
    
    query = query.orderBy('createdAt', 'desc');
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    let games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (options.search) {
      const search = options.search.toLowerCase();
      games = games.filter(g => 
        g.name?.toLowerCase().includes(search) ||
        g.description?.toLowerCase().includes(search) ||
        g.category?.toLowerCase().includes(search)
      );
    }
    
    return games;
  }

  static async incrementDownloads(id) {
    const gameRef = db.collection(COLLECTION).doc(id);
    await gameRef.update({
      downloads: admin.firestore.FieldValue.increment(1)
    });
  }

  static async getStats() {
    const snapshot = await db.collection(COLLECTION).get();
    const games = snapshot.docs.map(doc => doc.data());
    return {
      total: games.length,
      vip: games.filter(g => g.type === 'vip').length,
      free: games.filter(g => g.type === 'free').length,
      featured: games.filter(g => g.isFeatured).length,
      trending: games.filter(g => g.isTrending).length,
      totalDownloads: games.reduce((sum, g) => sum + (g.downloads || 0), 0)
    };
  }
}
