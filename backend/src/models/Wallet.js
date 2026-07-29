import { db } from '../config/firebase.js';

export class Wallet {
  static async create(userId) {
    const walletRef = db.collection('wallets').doc(userId);
    await walletRef.set({
      userId,
      balance: 0,
      totalDeposits: 0,
      totalPurchases: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return walletRef;
  }

  static async findById(userId) {
    const doc = await db.collection('wallets').doc(userId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  static async updateBalance(userId, amount, type, reason, adminName = null) {
    const walletRef = db.collection('wallets').doc(userId);
    const wallet = await this.findById(userId);
    if (!wallet) throw new Error('Wallet not found');

    let newBalance = wallet.balance;
    const updates = { updatedAt: new Date().toISOString() };

    if (type === 'add') {
      newBalance = wallet.balance + amount;
      updates.balance = newBalance;
      if (reason === 'deposit') {
        updates.totalDeposits = (wallet.totalDeposits || 0) + amount;
      }
    } else if (type === 'remove') {
      if (wallet.balance < amount) throw new Error('Insufficient balance');
      newBalance = wallet.balance - amount;
      updates.balance = newBalance;
      if (reason === 'purchase') {
        updates.totalPurchases = (wallet.totalPurchases || 0) + amount;
      }
    } else if (type === 'set') {
      newBalance = amount;
      updates.balance = amount;
    } else if (type === 'reset') {
      newBalance = 0;
      updates.balance = 0;
    }

    await walletRef.update(updates);

    // Create transaction record
    await db.collection('transactions').add({
      userId,
      amount,
      balanceAfter: newBalance,
      type,
      reason,
      adminName: adminName || null,
      timestamp: new Date().toISOString()
    });

    return newBalance;
  }

  static async getTotalBalance() {
    const snapshot = await db.collection('wallets').get();
    const wallets = snapshot.docs.map(doc => doc.data());
    return wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
  }
}
