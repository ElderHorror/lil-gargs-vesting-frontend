export const DEMO_WALLET = "DemoWa11etXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

export const DEMO_SUMMARY = {
  totalClaimable: 561.37,
  totalLocked: 2438.63,
  totalClaimed: 1250.00,
  totalVested: 1811.37,
  vestedPercentage: 42.6,
  nextUnlockTime: Math.floor(Date.now() / 1000) + 432000, // 5 days from now
  pools: [
    {
      poolId: "genesis-pool-1",
      poolName: "Genesis Pool",
      claimable: 340.50,
      locked: 1459.50,
      claimed: 750.00,
      share: 45.5,
      nftCount: 3,
      status: "active"
    },
    {
      poolId: "early-supporters-2",
      poolName: "Early Supporters",
      claimable: 220.87,
      locked: 979.13,
      claimed: 500.00,
      share: 30.2,
      nftCount: 2,
      status: "active"
    },
    {
      poolId: "community-rewards-3",
      poolName: "Community Rewards",
      claimable: 0,
      locked: 0,
      claimed: 0,
      share: 24.3,
      nftCount: 1,
      status: "completed"
    }
  ]
};

export const DEMO_HISTORY = [
  {
    id: "demo-1",
    date: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    amount: 150.00,
    transactionSignature: "5xKzT...demo1",
    status: "confirmed",
    poolName: "Genesis Pool"
  },
  {
    id: "demo-2",
    date: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    amount: 200.00,
    transactionSignature: "3mPqR...demo2",
    status: "confirmed",
    poolName: "Early Supporters"
  },
  {
    id: "demo-3",
    date: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
    amount: 300.00,
    transactionSignature: "7nWxY...demo3",
    status: "confirmed",
    poolName: "Genesis Pool"
  },
  {
    id: "demo-4",
    date: new Date(Date.now() - 86400000 * 15).toISOString(), // 15 days ago
    amount: 250.00,
    transactionSignature: "9kLmN...demo4",
    status: "confirmed",
    poolName: "Early Supporters"
  },
  {
    id: "demo-5",
    date: new Date(Date.now() - 86400000 * 20).toISOString(), // 20 days ago
    amount: 350.00,
    transactionSignature: "2hBvC...demo5",
    status: "confirmed",
    poolName: "Genesis Pool"
  }
];
