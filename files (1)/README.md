# 🎮 DVARY GAMES PLATFORM

A modern, production-ready gaming marketplace platform similar to Google Play Store and Steam, built with React, Node.js, Firebase, and FimiPay payment integration.

## ✨ Features

### Core Features
- **User Authentication**: Register, login, email verification, password reset
- **Game Store**: Browse free and VIP games with detailed information
- **Wallet System**: Secure wallet management with transaction history
- **Payment Integration**: FimiPay payment gateway for deposits
- **Purchase System**: Buy VIP games with wallet balance
- **Download Management**: Manage purchased games and downloads
- **User Profile**: View profile, wallet balance, purchase history
- **Notifications**: Real-time notifications and announcements

### Admin Dashboard
- **Game Management**: Add, edit, delete, publish, and hide games
- **User Management**: Search and manage users, view profiles
- **Wallet Management**: Add/remove/set user balances with transaction tracking
- **Payment Management**: Monitor and manage all payments
- **Bonus System**: Distribute bonuses to all users or specific groups
- **Analytics**: Comprehensive statistics and charts
- **Notification System**: Create and manage notifications
- **Announcement Bar**: Post global announcements

### Technical Features
- **PWA Support**: Progressive Web App with offline capabilities
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark Theme**: Professional dark mode UI
- **Security**: JWT authentication, encrypted passwords, secure transactions
- **Performance**: Lazy loading, code splitting, optimized images
- **Production Ready**: Error handling, logging, pagination

## 🛠️ Tech Stack

### Frontend
- **React 18** with Vite for fast development
- **Material-UI** for beautiful components
- **React Router v6** for navigation
- **Firebase** for authentication
- **Axios** for API communication
- **React Query** for data management
- **Chart.js** for analytics

### Backend
- **Node.js + Express** for REST API
- **Firebase Admin SDK** for backend services
- **Firestore** as NoSQL database
- **Firebase Storage** for file uploads
- **JWT** for token-based authentication
- **Express Validator** for input validation
- **Winston** for logging

### Payment
- **FimiPay API** for mobile money payments
- **HMAC SHA-256** for webhook verification

### Deployment
- **Docker** for containerization
- **Render** for hosting and CI/CD
- **GitHub** for version control

## 📋 Project Structure

```
dvary-games/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── config/         # Firebase and environment config
│   │   ├── middleware/     # Auth, validation, error handlers
│   │   ├── routes/         # API endpoints
│   │   ├── controllers/    # Business logic
│   │   ├── services/       # Wallet, payment, notification services
│   │   ├── models/         # Data models
│   │   ├── utils/          # Helpers, logging, tokens
│   │   └── server.js       # Main server file
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API and Firebase services
│   │   ├── context/        # Context API for state
│   │   ├── styles/         # Global styles and themes
│   │   ├── utils/          # Helper functions
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # React entry point
│   ├── public/
│   │   ├── manifest.json   # PWA manifest
│   │   └── service-worker.js
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── .env.example
│
├── render.yaml             # Render deployment config
├── docker-compose.yml      # Local development with Docker
├── Dockerfile              # Backend container image
├── DEPLOYMENT.md           # Detailed deployment guide
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ and npm v9+
- **Git** for version control
- **Firebase Project** (free tier is sufficient)
- **FimiPay Account** for payment processing
- **Render Account** for deployment (optional)

### Local Development Setup

#### 1. Clone Repository
```bash
git clone https://github.com/yourusername/dvary-games.git
cd dvary-games
```

#### 2. Backend Setup

```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# - Firebase project credentials
# - FimiPay API keys
# - JWT secret
nano .env

# Install dependencies
npm install

# Start development server
npm run dev
# Server runs on http://localhost:5000
```

#### 3. Frontend Setup

```bash
cd ../frontend

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# - Firebase config
# - Backend API URL
nano .env

# Install dependencies
npm install

# Start development server
npm run dev
# App runs on http://localhost:5173
```

#### 4. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or use existing one
3. Enable authentication methods:
   - Email/Password
   - Email link sign-in (optional)
4. Create Firestore database:
   - Start in test mode for development
5. Generate service account key:
   - Project Settings → Service Accounts
   - Click "Generate new private key"
   - Use the JSON file contents in backend `.env`

#### 5. Set Up FimiPay

1. Create account at [FimiPay](https://fimipay.com)
2. Get API credentials from dashboard
3. Set up webhook endpoint: `https://your-backend.com/api/payments/webhook`
4. Add credentials to backend `.env`

### Database Structure (Firestore Collections)

The app automatically creates these Firestore collections:

- **users** - User profiles and wallet information
- **games** - Game catalog
- **wallet_logs** - Transaction history
- **transactions** - Purchase records
- **payments** - Payment records
- **downloads** - Download history
- **notifications** - User notifications
- **announcements** - Global announcements
- **bonus** - Bonus distributions

## 🔐 Security Features

### Authentication
- Firebase Authentication with email/password
- JWT tokens for API requests
- Token refresh mechanism
- Secure password reset flow

### Authorization
- Role-based access control (user/admin)
- Protected routes on frontend
- Protected endpoints on backend
- Admin-only dashboard access

### Data Protection
- Input validation on frontend and backend
- SQL/NoSQL injection prevention
- XSS protection with Content Security Policy
- CSRF tokens for state-changing operations
- Secure password hashing with bcrypt

### Transaction Security
- Server-side balance validation
- Atomic Firestore transactions
- Duplicate purchase prevention
- Webhook signature verification
- HMAC-SHA256 signatures for payments

### Rate Limiting
- 100 requests per 15 minutes (general)
- 5 requests per 15 minutes (authentication)
- 20 requests per hour (payments)

## 📊 Database Schema

### Users Collection
```javascript
{
  uid: string,
  email: string,
  username: string,
  phoneNumber: string,
  role: 'user' | 'admin',
  isEmailVerified: boolean,
  wallet: {
    balance: number,
    totalDeposits: number,
    totalPurchases: number,
    totalDownloads: number
  },
  purchasedGames: [gameId],
  createdAt: timestamp,
  updatedAt: timestamp,
  isActive: boolean
}
```

### Games Collection
```javascript
{
  id: string,
  name: string,
  description: string,
  category: string,
  version: string,
  size: string,
  coverImage: URL,
  screenshots: [URL],
  downloadUrls: [URL],
  type: 'FREE' | 'VIP',
  price: number, // if VIP
  downloads: number,
  rating: number,
  reviews: number,
  isPublished: boolean,
  isHidden: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

See `DVARY_PROJECT_STRUCTURE.md` for complete database schema.

## API Documentation

### Authentication Endpoints
```
POST   /api/auth/register           - Register new user
POST   /api/auth/login              - Login user
POST   /api/auth/logout             - Logout user
POST   /api/auth/forgot-password    - Request password reset
POST   /api/auth/reset-password     - Reset password
POST   /api/auth/verify-email       - Verify email address
GET    /api/auth/me                 - Get current user
PUT    /api/auth/update-profile     - Update profile
```

### Games Endpoints
```
GET    /api/games                   - Get all games (paginated)
GET    /api/games/:id               - Get game details
GET    /api/games/category/:cat     - Get games by category
POST   /api/games                   - Create game (admin)
PUT    /api/games/:id               - Update game (admin)
DELETE /api/games/:id               - Delete game (admin)
```

### Wallet Endpoints
```
GET    /api/wallet                  - Get wallet info
GET    /api/wallet/history          - Get transaction history
POST   /api/wallet/purchase         - Purchase game
POST   /api/wallet/verify           - Verify wallet balance
```

### Payment Endpoints
```
POST   /api/payments/deposit        - Initiate deposit
GET    /api/payments/status/:ref    - Check payment status
GET    /api/payments/history        - Get payment history
GET    /api/payments/networks       - Get available networks
POST   /api/payments/webhook        - FimiPay webhook callback
```

### Admin Endpoints
```
GET    /api/admin/stats             - Dashboard statistics
GET    /api/admin/users             - Get all users
PUT    /api/admin/users/:uid        - Update user
GET    /api/admin/wallet/:uid       - Get user wallet
POST   /api/admin/wallet/:uid/add   - Add wallet balance
POST   /api/admin/bonus             - Distribute bonus
GET    /api/admin/payments          - Get all payments
```

## 🚀 Deployment

### Deploy to Render

#### Option 1: Using render.yaml (Recommended)
```bash
# 1. Push code to GitHub
git push origin main

# 2. Go to https://render.com
# 3. Create new Blueprint deployment
# 4. Select your GitHub repo
# 5. Render will auto-detect render.yaml
# 6. Add environment variables
# 7. Deploy!
```

#### Option 2: Manual Render Deployment
See `DEPLOYMENT.md` for detailed step-by-step instructions.

### Environment Variables for Production

Set these in Render dashboard:

**Backend:**
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- FIMIPAY_PUBLIC_KEY
- FIMIPAY_SECRET_KEY
- FIMIPAY_WEBHOOK_SECRET
- JWT_SECRET (generate strong random)
- NODE_ENV=production

**Frontend:**
- VITE_API_URL=https://your-backend.onrender.com/api
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_PROJECT_ID
- (and other Firebase config from your project)

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
```

### Frontend Testing
```bash
cd frontend
npm test
```

### Manual Testing Checklist
- [ ] User registration and email verification
- [ ] Login and logout functionality
- [ ] Browse games and filter by category
- [ ] Wallet balance display
- [ ] Deposit via FimiPay (test mode)
- [ ] Purchase VIP game
- [ ] Download game
- [ ] Admin: Add new game
- [ ] Admin: Manage users
- [ ] Admin: View analytics

## 📱 PWA Features

The app is a Progressive Web App supporting:

- **Offline Mode**: Works partially without internet
- **Install Prompt**: Add to home screen on mobile
- **Push Notifications**: Real-time game updates
- **Service Worker**: Background sync and caching
- **Responsive**: Optimized for all screen sizes

To test PWA:
1. Open app in mobile browser or Chrome dev tools
2. Look for "Add to Home Screen" prompt
3. Install and launch from home screen
4. App works offline (with cached content)

## 🐛 Troubleshooting

### Firebase Connection Issues
- Verify Firebase credentials in .env
- Check Firestore security rules
- Ensure Firebase Admin SDK is properly initialized

### FimiPay Payment Fails
- Verify API credentials
- Check webhook configuration
- Ensure phone number format is correct (+255...)
- Check amount is within limits (100-5,000,000 TZS)

### Port Already in Use
```bash
# Find and kill process on port 5000 (backend)
lsof -ti:5000 | xargs kill -9

# Or use different port
PORT=3000 npm run dev
```

### Build Fails on Render
- Check build command in render.yaml
- Verify all environment variables are set
- Check Node version compatibility
- Review build logs in Render dashboard

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [Express.js Guide](https://expressjs.com)
- [Material-UI Documentation](https://mui.com)
- [Render Documentation](https://render.com/docs)
- [FimiPay API Docs](https://fimipay.com/docs)

## 📝 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support, email support@dvary.com or open an issue on GitHub.

## 🙏 Acknowledgments

- React and Express.js communities
- Firebase for powerful backend services
- FimiPay for payment processing
- Material-UI for beautiful components

---

**Made with ❤️ by DVARY Team**

Start building your gaming platform today! 🚀
