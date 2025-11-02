# 🦎 Lil Gargs Vesting Platform

A modern, production-ready token vesting platform built on Solana blockchain. Manage multi-pool vesting schedules with real-time updates, animated UI, and comprehensive transaction handling.

![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Solana](https://img.shields.io/badge/Solana-Web3.js-purple?logo=solana)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.0-38bdf8?logo=tailwindcss)

## ✨ Features

### Core Functionality
- **Multi-Pool Vesting**: Manage tokens across multiple vesting pools simultaneously
- **Custom Claim Amounts**: Users can claim any amount up to their available balance
- **FIFO Distribution**: Automatic distribution across pools using First-In-First-Out logic
- **Real-Time Updates**: Live countdown timers and animated progress indicators
- **Transaction Polling**: Progressive status updates during blockchain confirmation
- **Demo Mode**: Portfolio-ready demo with mock data (no wallet required)

### User Experience
- **Animated Percentage Counter**: Smooth counting animation from 0% to actual vested percentage
- **Live Countdown Timer**: Real-time countdown showing days, hours, minutes, and seconds
- **Optimistic UI**: Instant feedback with background transaction verification
- **Comprehensive Error Handling**: User-friendly error messages with actionable guidance
- **Mobile-Responsive**: Fully optimized for mobile, tablet, and desktop
- **Cross-Tab Sync**: State synchronization across multiple browser tabs

### Technical Highlights
- **Decimal.js Integration**: Precise token calculations (no floating-point errors)
- **Transaction Status Polling**: Real-time blockchain confirmation tracking
- **Rate Limiting**: Prevents duplicate claims and spam
- **Request Deduplication**: Eliminates accidental double-claims
- **Vercel Analytics**: Built-in performance and usage tracking
- **Type-Safe**: Full TypeScript coverage with strict mode

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Solana wallet (Phantom, Solflare, etc.) for production use

### Installation

```bash
# Clone the repository
git clone https://github.com/ElderHorror/lil-gargs-vesting-frontend.git
cd lil-gargs-vesting-frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Environment Variables

Create a `.env.local` file with the following:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Solana RPC Endpoint (Helius recommended)
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Optional: Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx           # Root layout with analytics
│   │   ├── page.tsx             # Landing page
│   │   └── user/
│   │       └── vesting/         # Vesting dashboard page
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   │   ├── CircularProgress.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   └── RetryPrompt.tsx
│   │   └── user/                # User-facing components
│   │       ├── VestingDashboard.tsx
│   │       └── WalletConnectButton.tsx
│   ├── hooks/
│   │   └── useClaimWithFee.ts   # Claim transaction hook
│   ├── lib/
│   │   ├── apiClient.ts         # HTTP client with caching
│   │   └── demoData.ts          # Demo mode mock data
│   └── styles/
│       └── globals.css          # Global styles
├── public/                       # Static assets
├── package.json
└── README.md
```

## 🎯 Key Components

### VestingDashboard
Main dashboard component with tabbed interface:
- **Overview Tab**: Total claimable, stats, and claim button
- **History Tab**: Past claims with transaction signatures

**Features**:
- Real-time data fetching with auto-refresh
- Animated percentage counter
- Live countdown timer
- Demo mode toggle

### useClaimWithFee Hook
Manages the complete claim flow:
```typescript
const { executeClaim, loading, error, status, progress } = useClaimWithFee();

// Execute claim
const result = await executeClaim(amount);
```

**Status Flow**:
1. `preparing` (10%) - Calculating amounts
2. `signing_fee` (25%) - Waiting for wallet signature
3. `confirming_fee` (40%) - Confirming fee payment
4. `processing_claim` (60%) - Processing token transfer
5. `confirming_claim` (80%) - Polling transaction status
6. `success` (100%) - Complete

### CircularProgress
Animated SVG progress indicator:
```typescript
<CircularProgress 
  percentage={67.3} 
  label="Unlocked" 
  size={140} 
  strokeWidth={10} 
/>
```

## 🎨 Demo Mode

Perfect for portfolio presentations and testing:

```typescript
// Enable demo mode
Click "👁️ View Demo" button

// Features:
- Pre-populated with realistic data
- No wallet connection required
- Simulated claim transactions
- All UI animations work
- Safe for public demos
```

**Demo Data Includes**:
- 561.37 $GARG claimable
- 3 vesting pools (Genesis, Early Supporters, Community Rewards)
- 5 historical claims with dates and signatures
- 42.6% vested progress

## 🔧 Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Type checking
npm run type-check
```

### Code Style
- TypeScript strict mode enabled
- ESLint with Next.js config
- Prettier for formatting
- Tailwind CSS for styling

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production deployment
vercel --prod
```

### Environment Variables on Vercel
Add the following in Vercel dashboard:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOLANA_RPC_URL`

### Other Platforms
The app can be deployed to any platform supporting Next.js:
- Netlify
- AWS Amplify
- Railway
- Render

## 📊 Performance Optimizations

### Implemented
- ✅ Database query consolidation (N+1 → single query)
- ✅ Streamflow API caching (30 seconds)
- ✅ Price data caching (10 seconds)
- ✅ RPC call optimization (blockhash caching)
- ✅ Request deduplication
- ✅ Per-wallet rate limiting
- ✅ Transaction status polling
- ✅ Decimal.js for precision arithmetic

### Results
- **Claim latency**: 2-5s → 500ms-1s (75% faster)
- **Transaction confirmation**: 60-120s → 20-30s
- **Concurrent users**: Supports 50+ simultaneous claims
- **Zero precision errors**: Exact token calculations

## 🔐 Security Features

- **Rate Limiting**: 1 claim per wallet per 10 seconds
- **Duplicate Prevention**: Database-level unique constraints
- **Request Deduplication**: Prevents accidental double-claims
- **Input Validation**: Client and server-side validation
- **Error Handling**: Comprehensive error messages without exposing internals
- **Type Safety**: Full TypeScript coverage

## 🎥 Recording a Demo

For portfolio presentations:

1. **Enable Demo Mode**: Click "View Demo" button
2. **Record Screen**: Use OBS Studio, Loom, or Windows Game Bar
3. **Show Features**:
   - Dashboard with animated stats
   - Claim flow with progress indicators
   - History tab with past claims
4. **Duration**: 2 minutes recommended
5. **Resolution**: 1920x1080 (1080p)

## 🐛 Troubleshooting

### Common Issues

**Wallet won't connect**
- Ensure wallet extension is installed and unlocked
- Try refreshing the page
- Check browser console for errors

**Claims failing**
- Verify sufficient SOL for transaction fees (~0.01 SOL)
- Check wallet has available claimable balance
- Ensure not claiming too frequently (10s cooldown)

**Demo mode not working**
- Hard refresh the page (Ctrl+F5)
- Clear browser cache
- Check browser console for errors

## 📝 API Integration

The frontend integrates with a backend API:

```typescript
// Example API calls
GET  /api/user/vesting/summary-all?wallet={address}
POST /api/user/vesting/claim
POST /api/user/vesting/complete-claim
GET  /api/user/vesting/claim-status/{signature}
GET  /api/user/vesting/claim-history?wallet={address}
```

See backend documentation for full API reference.

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🙏 Acknowledgments

- **Solana Foundation** - Blockchain infrastructure
- **Vercel** - Hosting and analytics
- **Next.js Team** - Framework
- **Lil Gargs Community** - Project support

## 📞 Support

For issues or questions:
- Open a GitHub issue
- Contact: [Your contact info]

---

**Built with ❤️ for the Lil Gargs community**
