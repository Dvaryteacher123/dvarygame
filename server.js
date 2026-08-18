// ============================================
// DVARY GAMES & API MARKETPLACE - server.js
// ============================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const admin = require('firebase-admin');

// ============================================
// FIREBASE ADMIN SDK
// ============================================
let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else if (process.env.FIREBASE_PRIVATE_KEY) {
        serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        };
    } else {
        try {
            serviceAccount = require('./serviceAccountKey.json');
        } catch (e) {
            console.log('⚠️ No Firebase service account found.');
        }
    }
} catch (error) {
    console.error('❌ Error loading Firebase:', error);
}

if (admin.apps.length === 0 && serviceAccount) {
    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log('✅ Firebase Admin initialized');
    } catch (error) {
        console.error('❌ Firebase init error:', error);
    }
}

const db = admin.firestore();
const auth = admin.auth();

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dvary-games-secret-2026';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@dvary.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY;
const HARAKAPAY_BASE_URL = process.env.HARAKAPAY_BASE_URL || 'https://harakapay.net';
const HARAKAPAY_WEBHOOK_URL = process.env.HARAKAPAY_WEBHOOK_URL || 'https://dvary-games.onrender.com/api/webhook/harakapay';

// ============================================
// EXPRESS APP
// ============================================
const app = express();
const server = http.createServer(app);

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
}));

// ============================================
// SERVE STATIC FILES
// ============================================
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const authenticate = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: 'Invalid token' });
    }
};

const authenticateAdmin = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userDoc = await db.collection('users').doc(decoded.id).get();
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const userData = userDoc.data();
        if (userData.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        req.userId = decoded.id;
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: 'Invalid token' });
    }
};

// ============================================
// API KEY AUTHENTICATION MIDDLEWARE
// ============================================
const authenticateApiKey = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const apiKey = authHeader && authHeader.split(' ')[1];

    if (!apiKey) {
        return res.status(401).json({ success: false, error: 'API key required' });
    }

    try {
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const keySnapshot = await db.collection('apiKeys')
            .where('keyHash', '==', keyHash)
            .where('status', '==', 'active')
            .get();

        if (keySnapshot.empty) {
            return res.status(401).json({ success: false, error: 'Invalid API key' });
        }

        const keyDoc = keySnapshot.docs[0];
        const keyData = keyDoc.data();

        // Check expiry
        if (keyData.expiresAt) {
            const expiresAt = keyData.expiresAt.toDate ? keyData.expiresAt.toDate() : new Date(keyData.expiresAt);
            if (new Date() > expiresAt) {
                await db.collection('apiKeys').doc(keyDoc.id).update({ status: 'expired' });
                return res.status(403).json({
                    success: false,
                    error: 'API_KEY_EXPIRED',
                    message: 'Your API subscription has expired. Please renew your plan.'
                });
            }
        }

        // Check subscription
        if (keyData.subscriptionId) {
            const subDoc = await db.collection('subscriptions').doc(keyData.subscriptionId).get();
            if (subDoc.exists) {
                const subData = subDoc.data();
                if (subData.status !== 'active') {
                    return res.status(403).json({
                        success: false,
                        error: 'SUBSCRIPTION_INACTIVE',
                        message: 'Your subscription is not active. Please renew.'
                    });
                }
            }
        }

        // Update last used
        await db.collection('apiKeys').doc(keyDoc.id).update({
            lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Track usage
        await db.collection('apiUsage').add({
            keyId: keyDoc.id,
            userId: keyData.userId,
            endpoint: req.path,
            method: req.method,
            ip: req.ip,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        req.apiKeyData = keyData;
        req.apiKeyId = keyDoc.id;
        next();

    } catch (error) {
        console.error('API Key auth error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// ============================================
// ⭐⭐⭐ API ROUTES ⭐⭐⭐
// ============================================

// ============================================
// 1. AUTH ROUTES
// ============================================

// REGISTER
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, username, email, phone, password } = req.body;

        if (!name || !username || !email || !password) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        // Check username
        const usernameCheck = await db.collection('users').where('username', '==', username).get();
        if (!usernameCheck.empty) {
            return res.status(400).json({ success: false, error: 'Username already taken' });
        }

        // Check email
        const emailCheck = await db.collection('users').where('email', '==', email).get();
        if (!emailCheck.empty) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create Firebase Auth user
        let firebaseUser;
        try {
            firebaseUser = await auth.createUser({
                email: email,
                password: password,
                displayName: name,
            });
        } catch (authError) {
            console.error('Firebase auth error:', authError);
            return res.status(400).json({ success: false, error: 'Error creating user' });
        }

        // Save to Firestore
        const userData = {
            name,
            username,
            email,
            phone: phone || '',
            passwordHash,
            role: 'user',
            status: 'active',
            firebaseUid: firebaseUser.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const userRef = await db.collection('users').add(userData);
        const userId = userRef.id;
        await userRef.update({ id: userId });

        // Generate JWT
        const token = jwt.sign({ id: userId, username, email }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            success: true,
            message: 'Account created successfully! 🎮',
            user: {
                id: userId,
                name,
                username,
                email,
                role: 'user',
            },
            token,
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ success: false, error: 'Identifier and password required' });
        }

        // Find by username or email
        let userSnapshot = await db.collection('users').where('username', '==', identifier).get();
        let userDoc = null;
        let userId = null;

        if (userSnapshot.empty) {
            userSnapshot = await db.collection('users').where('email', '==', identifier).get();
            if (!userSnapshot.empty) {
                userDoc = userSnapshot.docs[0];
                userId = userDoc.id;
            }
        } else {
            userDoc = userSnapshot.docs[0];
            userId = userDoc.id;
        }

        if (!userDoc) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const userData = userDoc.data();

        if (userData.status === 'banned') {
            return res.status(403).json({ success: false, error: 'Account is banned' });
        }

        const validPassword = await bcrypt.compare(password, userData.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const token = jwt.sign({
            id: userId,
            username: userData.username,
            email: userData.email,
            role: userData.role || 'user'
        }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            message: 'Login successful! 🎮',
            user: {
                id: userId,
                name: userData.name,
                username: userData.username,
                email: userData.email,
                role: userData.role || 'user',
            },
            token,
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// CHECK USERNAME
app.post('/api/auth/check-username', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ success: false, error: 'Username required' });
        }
        const snapshot = await db.collection('users').where('username', '==', username).get();
        res.json({ success: true, exists: !snapshot.empty });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================
// 2. USER ROUTES
// ============================================

// GET PROFILE
app.get('/api/profile', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const userData = userDoc.data();
        delete userData.passwordHash;

        res.json({
            success: true,
            user: {
                id: userId,
                ...userData,
            },
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// UPDATE PROFILE
app.put('/api/profile', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const { name, username, phone } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;

        if (username) {
            const check = await db.collection('users').where('username', '==', username).get();
            if (!check.empty) {
                for (const doc of check.docs) {
                    if (doc.id !== userId) {
                        return res.status(400).json({ success: false, error: 'Username already taken' });
                    }
                }
            }
            updateData.username = username;
        }

        updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        await db.collection('users').doc(userId).update(updateData);

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        delete userData.passwordHash;

        res.json({
            success: true,
            message: 'Profile updated! ✅',
            user: { id: userId, ...userData },
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// CHANGE PASSWORD
app.post('/api/profile/password', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, error: 'Current and new password required' });
        }

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const userData = userDoc.data();
        const valid = await bcrypt.compare(currentPassword, userData.passwordHash);
        if (!valid) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }

        const saltRounds = 10;
        const newHash = await bcrypt.hash(newPassword, saltRounds);
        await db.collection('users').doc(userId).update({ passwordHash: newHash });

        res.json({ success: true, message: 'Password changed! ✅' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================
// 3. GAME ROUTES
// ============================================

// GET ALL GAMES (Public)
app.get('/api/games', async (req, res) => {
    try {
        const { category, search, limit } = req.query;

        let query = db.collection('games');
        if (category) query = query.where('category', '==', category);

        const snapshot = await query.limit(parseInt(limit) || 50).get();
        const games = [];

        snapshot.forEach(doc => {
            games.push({ id: doc.id, ...doc.data() });
        });

        let result = games;
        if (search) {
            const s = search.toLowerCase();
            result = games.filter(g =>
                g.title?.toLowerCase().includes(s) ||
                g.description?.toLowerCase().includes(s)
            );
        }

        res.json({ success: true, games: result });

    } catch (error) {
        console.error('Get games error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// GET GAME BY ID
app.get('/api/games/:id', async (req, res) => {
    try {
        const gameId = req.params.id;
        const doc = await db.collection('games').doc(gameId).get();

        if (!doc.exists) {
            return res.status(404).json({ success: false, error: 'Game not found' });
        }

        res.json({ success: true, game: { id: doc.id, ...doc.data() } });

    } catch (error) {
        console.error('Get game error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================
// 4. PLAN ROUTES
// ============================================

// GET ALL PLANS (Public)
app.get('/api/plans', async (req, res) => {
    try {
        const snapshot = await db.collection('plans')
            .where('active', '==', true)
            .orderBy('price')
            .get();

        const plans = [];
        snapshot.forEach(doc => {
            plans.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, plans });

    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// GET PLAN BY ID
app.get('/api/plans/:id', async (req, res) => {
    try {
        const planId = req.params.id;
        const doc = await db.collection('plans').doc(planId).get();

        if (!doc.exists) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }

        res.json({ success: true, plan: { id: doc.id, ...doc.data() } });

    } catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================
// 5. SUBSCRIPTION ROUTES
// ============================================

// CREATE SUBSCRIPTION (via payment)
app.post('/api/subscriptions/create', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const { planId, phone } = req.body;

        if (!planId || !phone) {
            return res.status(400).json({ success: false, error: 'Plan ID and phone required' });
        }

        const planDoc = await db.collection('plans').doc(planId).get();
        if (!planDoc.exists) {
            return res.status(404).json({ success: false, error: 'Plan not found' });
        }

        const plan = planDoc.data();
        const orderId = `ORD${Date.now()}${Math.random().toString(36).substring(2, 8)}`;

        // Create order
        const orderData = {
            userId,
            productType: 'API_PLAN',
            productId: planId,
            planName: plan.name,
            amount: plan.price,
            currency: 'TZS',
            status: 'pending',
            paymentProvider: 'HarakaPay',
            orderId: orderId,
            phone: phone,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const orderRef = await db.collection('orders').add(orderData);
        const orderIdFirestore = orderRef.id;
        await orderRef.update({ id: orderIdFirestore });

        // Initiate HarakaPay payment
        if (HARAKAPAY_API_KEY) {
            try {
                const harakapayResponse = await axios.post(
                    `${HARAKAPAY_BASE_URL}/api/v1/collect`,
                    {
                        phone: phone,
                        amount: plan.price,
                        description: `${plan.name} API Plan - ${orderId}`,
                        webhook_url: HARAKAPAY_WEBHOOK_URL,
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': HARAKAPAY_API_KEY,
                        },
                        timeout: 30000,
                    }
                );

                if (harakapayResponse.data.success) {
                    await db.collection('orders').doc(orderIdFirestore).update({
                        transactionId: harakapayResponse.data.order_id,
                    });

                    res.json({
                        success: true,
                        message: 'Payment initiated. Please check your phone.',
                        orderId: orderId,
                        status: 'pending',
                    });
                } else {
                    await db.collection('orders').doc(orderIdFirestore).update({ status: 'failed' });
                    res.status(400).json({
                        success: false,
                        error: harakapayResponse.data.error || 'Payment initiation failed',
                    });
                }
            } catch (harakaError) {
                console.error('HarakaPay error:', harakaError);
                await db.collection('orders').doc(orderIdFirestore).update({ status: 'failed' });
                res.status(500).json({ success: false, error: 'Payment gateway error' });
            }
        } else {
            // Demo mode - auto complete
            await db.collection('orders').doc(orderIdFirestore).update({ status: 'paid' });
            await activateSubscription(userId, planId, orderIdFirestore);

            res.json({
                success: true,
                message: 'Subscription activated (demo mode)',
                orderId: orderId,
                status: 'paid',
            });
        }

    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// GET USER SUBSCRIPTIONS
app.get('/api/subscriptions', authenticate, async (req, res) => {
    try {
        const userId = req.userId;

        const snapshot = await db.collection('subscriptions')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        const subscriptions = [];
        snapshot.forEach(doc => {
            subscriptions.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, subscriptions });

    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================
// 6. API KEY ROUTES
// ============================================

// GENERATE API KEY
app.post('/api/keys/generate', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const { subscriptionId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({ success: false, error: 'Subscription ID required' });
        }

        const subDoc = await db.collection('subscriptions').doc(subscriptionId).get();
        if (!subDoc.exists) {
            return res.status(404).json({ success: false, error: 'Subscription not found' });
        }

        const subData = subDoc.data();
        if (subData.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        if (subData.status !== 'active') {
            return res.status(400).json({ success: false, error: 'Subscription is not active' });
        }

        // Revoke old keys
        const oldKeys = await db.collection('apiKeys')
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        const batch = db.batch();
        oldKeys.forEach(doc => {
            batch.update(doc.ref, { status: 'revoked' });
        });
        await batch.commit();

        // Generate new key
        const newKey = await generateApiKey(userId, subscriptionId);

        if (!newKey) {
            return res.status(500).json({ success: false, error: 'Failed to generate API key' });
        }

        res.json({
            success: true,
            message: 'API Key generated successfully!',
            apiKey: newKey,
            warning: 'Copy your API key now. It will not be shown again.',
        });

    } catch (error) {
        console.error('Generate API key error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// GET USER API KEYS
app.get('/api/keys', authenticate, async (req, res) => {
    try {
        const userId = req.userId;

        const snapshot = await db.collection('apiKeys')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        const keys = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            keys.push({
                id: doc.id,
                keyPrefix: data.keyPrefix || 'dv_live_',
                status: data.status || 'active',
                createdAt: data.createdAt,
                expiresAt: data.expiresAt,
                lastUsedAt: data.lastUsedAt,
                subscriptionId: data.subscriptionId,
            });
        });

        res.json({ success: true, keys });

    } catch (error) {
        console.error('Get API keys error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// REVOKE API KEY
app.post('/api/keys/revoke/:keyId', authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        const keyId = req.params.keyId;

        const keyDoc = await db.collection('apiKeys').doc(keyId).get();
        if (!keyDoc.exists) {
            return res.status(404).json({ success: false, error: 'API key not found' });
        }

        const keyData = keyDoc.data();
        if (keyData.userId !== userId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        await db.collection('apiKeys').doc(keyId).update({
            status: 'revoked',
            revokedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ success: true, message: 'API key revoked successfully' });

    } catch (error) {
        console.error('Revoke API key error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================
// 7. ORDER ROUTES
// ============================================

// GET USER ORDERS
app.get('/api/orders', authenticate, async (req, res) => {
    try {
        const userId = req.userId;

        const snapshot = await db.collection('orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        const orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });

        res.json({ success: true, orders });

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================
// 8. USAGE ROUTES
// ============================================

// GET API USAGE
app.get('/api/usage', authenticate, async (req, res) => {
    try {
        const userId = req.userId;

        // Get user's API keys
        const keySnapshot = await db.collection('apiKeys')
            .where('userId', '==', userId)
            .get();

        const keyIds = [];
        keySnapshot.forEach(doc => keyIds.push(doc.id));

        if (keyIds.length === 0) {
            return res.json({
                success: true,
                total: 0,
                today: 0,
                thisMonth: 0,
                lastRequest: null,
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        let total = 0;
        let todayCount = 0;
        let monthCount = 0;
        let lastRequest = null;

        for (const keyId of keyIds) {
            const usageSnapshot = await db.collection('apiUsage')
                .where('keyId', '==', keyId)
                .get();

            usageSnapshot.forEach(doc => {
                const data = doc.data();
                total++;

                const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                if (createdAt >= today) todayCount++;
                if (createdAt >= monthStart) monthCount++;

                if (!lastRequest || createdAt > lastRequest) {
                    lastRequest = createdAt;
                }
            });
        }

        res.json({
            success: true,
            total,
            today: todayCount,
            thisMonth: monthCount,
            lastRequest,
        });

    } catch (error) {
        console.error('Get usage error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================
// 9. HARAKAPAY WEBHOOK
// ============================================

app.post('/api/webhook/harakapay', async (req, res) => {
    try {
        const payload = req.body;
        console.log('📨 HarakaPay Webhook:', JSON.stringify(payload, null, 2));

        const { order_id, status, amount, net_amount, fee_amount, completed_at } = payload;

        if (!order_id) {
            return res.status(400).json({ error: 'Invalid webhook payload' });
        }

        // Find order by transactionId
        const orderSnapshot = await db.collection('orders')
            .where('transactionId', '==', order_id)
            .get();

        if (orderSnapshot.empty) {
            console.error('Order not found for transaction:', order_id);
            return res.status(404).json({ error: 'Order not found' });
        }

        const orderDoc = orderSnapshot.docs[0];
        const orderId = orderDoc.id;
        const orderData = orderDoc.data();

        if (orderData.status === 'paid') {
            return res.json({ status: 'already_processed' });
        }

        // Update order
        await db.collection('orders').doc(orderId).update({
            status: status === 'completed' || status === 'converted' ? 'paid' : 'failed',
            paidAt: completed_at ? new Date(completed_at) : admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (status === 'completed' || status === 'converted') {
            // Activate subscription
            await activateSubscription(orderData.userId, orderData.productId, orderId);
        }

        res.json({ status: 'success' });

    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// 10. ADMIN ROUTES
// ============================================

// GET ALL USERS (Admin)
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('users').get();
        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            delete data.passwordHash;
            users.push({ id: doc.id, ...data });
        });
        res.json({ success: true, users });
    } catch (error) {
        console.error('Admin get users error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// GET ALL ORDERS (Admin)
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('orders')
            .orderBy('createdAt', 'desc')
            .get();
        const orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Admin get orders error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// UPDATE ADMIN SETTINGS
app.put('/api/admin/settings', authenticateAdmin, async (req, res) => {
    try {
        const { email, password } = req.body;
        const adminId = req.userId;

        const updateData = {};
        if (email) updateData.email = email;
        if (password && password.length >= 6) {
            const saltRounds = 10;
            updateData.passwordHash = await bcrypt.hash(password, saltRounds);
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, error: 'No changes to save' });
        }

        await db.collection('users').doc(adminId).update(updateData);
        res.json({ success: true, message: 'Settings updated!' });

    } catch (error) {
        console.error('Admin settings error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function activateSubscription(userId, planId, orderId) {
    try {
        const planDoc = await db.collection('plans').doc(planId).get();
        if (!planDoc.exists) return;

        const plan = planDoc.data();
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

        // Check if user already has active subscription
        const existingSub = await db.collection('subscriptions')
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        let startDate = now;
        let expiryDate = expiresAt;

        if (!existingSub.empty) {
            const subDoc = existingSub.docs[0];
            const subData = subDoc.data();
            if (subData.expiresAt) {
                const currentExpiry = subData.expiresAt.toDate ? subData.expiresAt.toDate() : new Date(subData.expiresAt);
                if (new Date() < currentExpiry) {
                    expiryDate = new Date(currentExpiry);
                    expiryDate.setDate(expiryDate.getDate() + plan.durationDays);
                    startDate = currentExpiry;
                }
            }
            await db.collection('subscriptions').doc(subDoc.id).update({ status: 'inactive' });
        }

        const subData = {
            userId,
            planId,
            planName: plan.name,
            status: 'active',
            startedAt: startDate,
            expiresAt: expiryDate,
            orderId: orderId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const subRef = await db.collection('subscriptions').add(subData);
        const subId = subRef.id;
        await subRef.update({ id: subId });

        // Generate API key
        await generateApiKey(userId, subId);

        // Update order
        await db.collection('orders').doc(orderId).update({
            status: 'paid',
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            subscriptionId: subId,
        });

        // Notification
        await db.collection('notifications').add({
            userId,
            title: 'API Subscription Activated',
            message: `Your ${plan.name} plan is now active! Expires: ${expiryDate.toLocaleDateString()}`,
            type: 'subscription',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Subscription activated for user ${userId}`);

    } catch (error) {
        console.error('Activate subscription error:', error);
    }
}

async function generateApiKey(userId, subscriptionId) {
    try {
        const prefix = 'dv_live_';
        const randomBytes = crypto.randomBytes(24).toString('hex');
        const apiKey = prefix + randomBytes;

        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const subDoc = await db.collection('subscriptions').doc(subscriptionId).get();
        const subData = subDoc.data();

        const keyData = {
            userId,
            subscriptionId,
            keyHash,
            keyPrefix: prefix,
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: subData.expiresAt || new Date(new Date().setDate(new Date().getDate() + 30)),
            lastUsedAt: null,
        };

        await db.collection('apiKeys').add(keyData);

        // Notification
        await db.collection('notifications').add({
            userId,
            title: 'API Key Generated',
            message: 'Your API key has been generated successfully. Keep it secure!',
            type: 'api_key',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return apiKey;

    } catch (error) {
        console.error('Generate API key error:', error);
        return null;
    }
}

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// START SERVER
// ============================================
async function startServer() {
    try {
        // Create default admin if not exists
        const adminSnapshot = await db.collection('users')
            .where('email', '==', ADMIN_EMAIL)
            .get();

        if (adminSnapshot.empty) {
            console.log('🔐 Creating admin user...');
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);

            let firebaseUser;
            try {
                firebaseUser = await auth.createUser({
                    email: ADMIN_EMAIL,
                    password: ADMIN_PASSWORD,
                    displayName: 'Admin',
                });
            } catch (e) { console.error('Firebase admin create error:', e); }

            const adminData = {
                name: 'Admin',
                username: 'admin',
                email: ADMIN_EMAIL,
                passwordHash,
                role: 'admin',
                status: 'active',
                firebaseUid: firebaseUser?.uid || '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            const adminRef = await db.collection('users').add(adminData);
            await adminRef.update({ id: adminRef.id });
            console.log('✅ Admin user created!');
            console.log(`🔐 Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
        } else {
            console.log('✅ Admin user exists');
        }

        // Create default plans if none exist
        const plansSnapshot = await db.collection('plans').get();
        if (plansSnapshot.empty) {
            console.log('📝 Creating default API plans...');
            const defaultPlans = [
                {
                    name: 'BASIC',
                    price: 5000,
                    durationDays: 30,
                    dailyLimit: 100,
                    features: ['API Access', '100 requests/day', 'Email Support'],
                    active: true,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                {
                    name: 'PRO',
                    price: 10000,
                    durationDays: 30,
                    dailyLimit: 1000,
                    features: ['API Access', '1,000 requests/day', 'Priority Support', 'Higher Rate Limit'],
                    active: true,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                {
                    name: 'PREMIUM',
                    price: 20000,
                    durationDays: 30,
                    dailyLimit: 10000,
                    features: ['API Access', '10,000 requests/day', 'VIP Support', 'Unlimited Rate Limit'],
                    active: true,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                }
            ];

            for (const plan of defaultPlans) {
                await db.collection('plans').add(plan);
            }
            console.log('✅ Default API plans created!');
        }

        // Create default games if none exist
        const gamesSnapshot = await db.collection('games').get();
        if (gamesSnapshot.empty) {
            console.log('🎮 Creating default games...');
            const defaultGames = [
                {
                    title: 'Cyber Quest',
                    category: 'Action',
                    price: 15000,
                    cover: '🎯',
                    description: 'An epic cyberpunk adventure game',
                    isFree: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                {
                    title: 'Space Racer',
                    category: 'Racing',
                    price: 10000,
                    cover: '🚀',
                    description: 'Race through the galaxy at light speed',
                    isFree: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                {
                    title: 'Puzzle Master',
                    category: 'Puzzle',
                    price: 0,
                    cover: '🧩',
                    description: 'Challenge your brain with mind-bending puzzles',
                    isFree: true,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                {
                    title: 'Fantasy Kingdom',
                    category: 'RPG',
                    price: 25000,
                    cover: '🏰',
                    description: 'Build your kingdom and conquer the realm',
                    isFree: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                }
            ];

            for (const game of defaultGames) {
                await db.collection('games').add(game);
            }
            console.log('✅ Default games created!');
        }

        server.listen(PORT, () => {
            console.log('========================================');
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`🔐 Admin: ${ADMIN_EMAIL}`);
            console.log(`💳 HarakaPay: ${HARAKAPAY_BASE_URL}`);
            console.log('🎮 DVARY GAMES is ready!');
            console.log('========================================');
        });
    } catch (error) {
        console.error('Server startup error:', error);
        process.exit(1);
    }
}

startServer();

module.exports = { app, server };
