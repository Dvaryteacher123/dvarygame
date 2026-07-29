import { initiatePayment, verifyWebhookSignature } from '../services/fimiPayService.js';
import { Wallet } from '../models/Wallet.js';
import { Transaction } from '../models/Transaction.js';
import { db } from '../config/firebase.js';

export const initiateDeposit = async (req, res) => {
  try {
    const { phoneNumber, amount, network } = req.body;
    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!phoneNumber || !amount || !network) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (amount < 1000) {
      return res.status(400).json({ error: 'Minimum deposit is 1000 TZS' });
    }

    if (amount > 1000000) {
      return res.status(400).json({ error: 'Maximum deposit is 1,000,000 TZS' });
    }

    const reference = `DVARY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const paymentResult = await initiatePayment({
      phoneNumber,
      amount,
      network,
      reference,
      buyerEmail: userData?.email || 'customer@example.com',
      buyerName: userData?.username || 'Customer',
      test_outcome: process.env.NODE_ENV === 'development' ? 'success' : null
    });

    await db.collection('transactions').add({
      userId,
      amount,
      reference,
      network,
      phoneNumber,
      status: 'pending',
      type: 'deposit',
      orderId: paymentResult.order_id,
      transactionId: paymentResult.transaction_id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        reference,
        orderId: paymentResult.order_id,
        status: paymentResult.payment_status || 'PENDING',
        amount: paymentResult.amount || amount
      }
    });
  } catch (error) {
    console.error('❌ Initiate deposit error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate payment' });
  }
};

export const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'] || req.headers['x-webhook-secret'];
    const isValid = verifyWebhookSignature(req.body, signature);

    if (!isValid && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { order_id, status, amount, reference, transaction_id } = req.body;

    let transactionSnapshot = await db.collection('transactions')
      .where('reference', '==', reference || order_id)
      .limit(1)
      .get();

    if (transactionSnapshot.empty) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const transactionDoc = transactionSnapshot.docs[0];
    const transaction = transactionDoc.data();
    const userId = transaction.userId;

    if (status === 'success' || status === 'completed') {
      if (transaction.status === 'completed') {
        return res.json({ status: 'already_processed' });
      }

      await Wallet.updateBalance(userId, amount, 'add', 'deposit');

      await db.collection('transactions').doc(transactionDoc.id).update({
        status: 'completed',
        transactionId: transaction_id || transaction.transactionId,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await sendNotification(userId, '💰 Deposit Successful', 
        `Your deposit of ${amount} TZS has been confirmed and added to your wallet.`);

      console.log(`✅ Deposit completed: ${amount} TZS for user ${userId}`);
    } else if (status === 'failed') {
      await db.collection('transactions').doc(transactionDoc.id).update({
        status: 'failed',
        failedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await sendNotification(userId, '❌ Deposit Failed',
        `Your deposit of ${amount} TZS failed. Please try again.`);

      console.log(`❌ Deposit failed: ${amount} TZS for user ${userId}`);
    }

    res.json({ status: 'webhook_processed', transaction_status: status });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.uid;

    const snapshot = await db.collection('transactions')
      .where('reference', '==', reference)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = snapshot.docs[0].data();
    res.json({
      reference: transaction.reference,
      status: transaction.status,
      amount: transaction.amount,
      network: transaction.network,
      phoneNumber: transaction.phoneNumber,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt || null
    });
  } catch (error) {
    console.error('❌ Get payment status error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 50 } = req.query;

    const snapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .where('type', '==', 'deposit')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();

    const payments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(payments);
  } catch (error) {
    console.error('❌ Get payment history error:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
};

async function sendNotification(userId, title, description) {
  try {
    await db.collection('notifications').add({
      userId,
      title,
      description,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Send notification error:', error);
  }
  }
