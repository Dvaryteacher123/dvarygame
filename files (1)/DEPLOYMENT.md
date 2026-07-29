# 🚀 DVARY GAMES - RENDER DEPLOYMENT GUIDE

Complete step-by-step guide to deploy DVARY GAMES platform to Render.

## 📋 Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] GitHub account with code pushed
- [ ] Render account (https://render.com)
- [ ] Firebase project with credentials
- [ ] FimiPay account with API keys
- [ ] Database collections created in Firestore
- [ ] Admin user created in Firebase

## 🔧 Step 1: Prepare Your Repository

### 1.1 Ensure Code is on GitHub

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: DVARY Games platform"

# Add GitHub remote
git remote add origin https://github.com/yourusername/dvary-games.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 1.2 Verify .gitignore

Ensure sensitive files are excluded:

```bash
# Check .gitignore contains:
cat .gitignore
```

Should include:
- node_modules/
- .env
- .env.local
- logs/
- dist/
- build/

### 1.3 Update render.yaml

Verify render.yaml has correct configuration:

```yaml
# Check that paths are correct for your project structure
# Update service names if needed
# Ensure environment variables are listed
```

## 🌐 Step 2: Set Up Render

### 2.1 Create Render Account

1. Go to https://render.com
2. Click "Get Started"
3. Sign up with GitHub (recommended)
4. Grant Render access to your repositories

### 2.2 Create Blueprint Deployment

1. Dashboard → "New +" → "Blueprint"
2. Select your GitHub repository (dvary-games)
3. Render will detect render.yaml
4. Click "Create Blueprint"

## 🔐 Step 3: Configure Environment Variables

### 3.1 Add Backend Environment Variables

In Render Dashboard:

1. Go to `dvary-games-backend` service
2. Environment → Add Variable

**Required Variables:**

```
PORT                      5000
NODE_ENV                  production
FRONTEND_URL              (auto-populated)
BACKEND_URL               (auto-populated)

FIREBASE_PROJECT_ID       your-firebase-project-id
FIREBASE_CLIENT_EMAIL     your-firebase-email@appspot.gserviceaccount.com
FIREBASE_PRIVATE_KEY      -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n

FIMIPAY_PUBLIC_KEY        your-fimipay-public-key
FIMIPAY_SECRET_KEY        your-fimipay-secret-key
FIMIPAY_WEBHOOK_SECRET    your-fimipay-webhook-secret
FIMIPAY_BASE_URL          https://api.fimipay.com/v1

JWT_SECRET                (generate random: openssl rand -base64 32)

ADMIN_EMAIL               admin@dvary.com
ADMIN_PASSWORD            (strong password, change after setup)

LOG_LEVEL                 info
```

### 3.2 Add Frontend Environment Variables

1. Go to `dvary-games-frontend` service
2. Environment → Add Variable

**Required Variables:**

```
VITE_API_URL              https://dvary-games-backend.onrender.com/api
VITE_BACKEND_URL          https://dvary-games-backend.onrender.com

VITE_FIREBASE_API_KEY     your-api-key
VITE_FIREBASE_AUTH_DOMAIN your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID  your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID your-sender-id
VITE_FIREBASE_APP_ID      your-app-id
VITE_FIREBASE_MEASUREMENT_ID your-measurement-id

VITE_ENABLE_PWA           true
VITE_ENABLE_ANALYTICS     true
VITE_ENABLE_NOTIFICATIONS true
```

## 🔐 Step 4: Get Firebase Credentials

### 4.1 Firebase Service Account Key

1. Firebase Console → Project Settings
2. Service Accounts tab
3. Click "Generate new private key"
4. Opens JSON file with credentials:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-...@appspot.gserviceaccount.com",
  ...
}
```

5. Copy `private_key` and `client_email` to Render environment

### 4.2 Firebase Web Config

1. Firebase Console → Project Settings
2. Your apps → Web app config
3. Copy all values to Render frontend environment

## 💳 Step 5: Configure FimiPay

### 5.1 Get FimiPay Credentials

1. Log in to FimiPay Dashboard
2. Settings → API Keys
3. Copy:
   - Public Key
   - Secret Key
   - Webhook Secret

### 5.2 Set Webhook URL

1. FimiPay Dashboard → Webhooks
2. Add webhook: `https://dvary-games-backend.onrender.com/api/payments/webhook`
3. Save webhook secret
4. Add to Render environment as `FIMIPAY_WEBHOOK_SECRET`

## 🔄 Step 6: Deploy

### Option A: Using Blueprint (Automatic)

1. Render Dashboard → Services
2. Select deployment
3. Click "Deploy"
4. Wait for automatic deployment (usually 5-10 minutes)

### Option B: Manual Deployment

```bash
# 1. Make changes locally
git add .
git commit -m "Update deployment configuration"
git push origin main

# 2. Render automatically triggers deployment
# Check status in Render Dashboard

# 3. View logs
# Click service → Logs tab
```

## ✅ Step 7: Verify Deployment

### 7.1 Check Backend

```bash
# Test health endpoint
curl https://dvary-games-backend.onrender.com/api/health

# Should return:
# {
#   "status": "OK",
#   "timestamp": "2024-...",
#   "uptime": ...,
#   "environment": "production"
# }
```

### 7.2 Check Frontend

1. Visit https://dvary-games-frontend.onrender.com
2. Check that app loads
3. Verify no 404 errors in console

### 7.3 Test Core Features

- [ ] Register new account
- [ ] Login with credentials
- [ ] View games
- [ ] Deposit (test mode with FimiPay)
- [ ] Purchase VIP game
- [ ] Admin dashboard access

## 🐛 Troubleshooting Deployment

### Backend Won't Start

**Error: Build failed**

1. Check build logs in Render dashboard
2. Verify Node.js version in package.json
3. Ensure all dependencies are in package.json
4. Check that src/server.js is correct path

```bash
# Local test
cd backend
npm install
npm start
```

**Error: Firebase initialization failed**

1. Verify FIREBASE_PRIVATE_KEY format:
   - Should start with -----BEGIN PRIVATE KEY-----
   - Should have \n for line breaks (not actual newlines)
   - Should end with -----END PRIVATE KEY-----\n

2. Test locally:
```bash
# In backend .env, set FIREBASE_PRIVATE_KEY exactly as in Render
NODE_ENV=production node src/server.js
```

### Frontend Won't Build

**Error: Build failed**

1. Check build logs
2. Verify all VITE_ variables are set
3. Ensure dist folder is created locally:

```bash
cd frontend
npm install
npm run build
# Should create dist/ folder
```

### Payment Webhook Not Working

1. Verify webhook URL is exactly: `https://dvary-games-backend.onrender.com/api/payments/webhook`
2. Check FimiPay webhook configuration
3. Test webhook in FimiPay dashboard
4. Check backend logs for webhook errors

### CORS Errors

**Error: Failed to fetch from backend**

1. Verify FRONTEND_URL in backend matches frontend domain
2. Check CORS configuration in backend

```javascript
// In server.js, verify:
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
  // ...
};
```

3. Update Render environment variable:
```
FRONTEND_URL: https://dvary-games-frontend.onrender.com
```

## 📊 Monitoring

### View Logs

1. Render Dashboard → Service → Logs
2. Search for errors or issues
3. Check for performance problems

### Set Up Alerts

1. Render Dashboard → Service → Settings
2. Add notifications for failures
3. Receive email alerts on deployment issues

### Monitor Performance

1. Use Render's built-in analytics
2. Monitor API response times
3. Track error rates
4. Watch CPU and memory usage

## 🔄 Continuous Deployment

### Automatic Deployments

Render automatically deploys when:
- Code is pushed to main branch
- render.yaml is updated
- Environment variables change

### Manual Deployment

```bash
# Make changes and push to GitHub
git add .
git commit -m "Feature description"
git push origin main

# Render automatically starts deployment
# Optionally manually trigger:
# Render Dashboard → Service → Deployment → Deploy
```

### Rolling Back

1. Render Dashboard → Service → Deployments
2. Find previous successful deployment
3. Click "Rollback"
4. Confirm rollback

## 🔐 Post-Deployment Security

### 1. Change Admin Password

1. Login to admin dashboard
2. Profile → Change Password
3. Use strong new password

### 2. Update FimiPay Webhook Secret

1. Generate new webhook secret in FimiPay
2. Update in Render environment
3. Verify webhook still works

### 3. Enable Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Users can only read/write own data
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid || 
                            get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### 4. Update Firebase Security Rules

1. Firebase Console → Firestore → Rules
2. Update with above rules
3. Publish rules

## 📈 Scaling

### If You Need More Resources

1. Render Dashboard → Service → Plan
2. Upgrade to higher tier:
   - Standard → Professional
   - Increases CPU, RAM, and bandwidth
3. May require manual scaling for databases

### Optimize Performance

1. Enable caching in frontend
2. Use database indexes in Firestore
3. Implement pagination on backend
4. Optimize images
5. Use CDN for static assets

## 🔗 Useful Links

- [Render Documentation](https://render.com/docs)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [FimiPay API Docs](https://fimipay.com/docs)
- [Express.js Deployment](https://expressjs.com/en/advanced/best-practice-performance.html)

## 📞 Support

If deployment fails:

1. Check Render logs for error messages
2. Verify all environment variables are set
3. Test backend locally with same environment
4. Check Firebase console for errors
5. Verify FimiPay credentials and webhook

For additional help:
- Render Support: https://render.com/support
- Firebase Support: https://firebase.google.com/support
- FimiPay Support: https://fimipay.com/support

---

**Deployment Complete! 🎉**

Your DVARY Games platform is now live on Render!

Next steps:
1. Share your app URL with users
2. Monitor performance and logs
3. Keep dependencies updated
4. Backup Firestore data regularly
