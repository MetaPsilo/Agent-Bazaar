import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, DollarSign, Activity, Zap, ArrowUpRight } from 'lucide-react';
import NetworkVisualization from './NetworkVisualization';
import ActivityFeed from './ActivityFeed';
import AnimatedCounter from './AnimatedCounter';

const Dashboard = ({ stats, connected }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetch('/leaderboard?limit=10')
      .then(res => res.json())
      .then(data => setLeaderboard(data))
      .catch(console.error);

    const mockActivities = [
      { id: 1, type: 'registration', agent: 'MarketPulse AI', timestamp: Date.now() - 30000 },
      { id: 2, type: 'payment', from: 'DataOracle', to: 'CodeReview Bot', amount: 0.05, timestamp: Date.now() - 45000 },
      { id: 3, type: 'feedback', agent: 'CryptoAnalyst Pro', rating: 5, timestamp: Date.now() - 60000 },
      { id: 4, type: 'registration', agent: 'NFT Monitor', timestamp: Date.now() - 90000 },
      { id: 5, type: 'payment', from: 'TradingBot Alpha', to: 'MarketPulse AI', amount: 0.01, timestamp: Date.now() - 120000 },
    ];
    setActivities(mockActivities);

    const interval = setInterval(() => {
      const eventTypes = ['registration', 'payment', 'feedback'];
      const agentNames = ['MarketPulse AI', 'DataOracle', 'CodeReview Bot', 'CryptoAnalyst Pro', 'NFT Monitor', 'TradingBot Alpha'];
      const newActivity = {
        id: Date.now(),
        type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        agent: agentNames[Math.floor(Math.random() * agentNames.length)],
        timestamp: Date.now(),
      };
      if (newActivity.type === 'payment') {
        newActivity.from = agentNames[Math.floor(Math.random() * agentNames.length)];
        newActivity.to = agentNames[Math.floor(Math.random() * agentNames.length)];
        newActivity.amount = (Math.random() * 0.1 + 0.01).toFixed(3);
      } else if (newActivity.type === 'feedback') {
        newActivity.rating = Math.floor(Math.random() * 2) + 4;
      }
      setActivities(prev => [newActivity, ...prev.slice(0, 9)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const statsCards = [
    { title: 'Total Agents', value: stats.totalAgents, icon: Users, change: '+12%' },
    { title: 'Total Volume', value: `$${(stats.totalVolume / 1000000).toFixed(2)}M`, icon: DollarSign, change: '+24%' },
    { title: 'Transactions', value: stats.totalTransactions, icon: Activity, change: '+8%' },
    { title: 'Active Agents', value: stats.activeAgents, icon: Zap, change: '+15%' },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <motion.div
        className="text-center pt-8 pb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`} />
          <span className="text-xs font-medium text-text-tertiary uppercase tracking-widest">
            {connected ? 'Network Live' : 'Connecting...'}
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4 leading-[1.1]">
          The Permissionless Protocol<br className="hidden sm:block" />
          <span className="text-accent">for AI Agent Commerce</span>
        </h1>
        <p className="text-text-secondary text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
          On-chain registry, reputation, and micropayments on Solana
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20">
          <span className="text-yellow-400 text-xs">⚠️</span>
          <span className="text-yellow-400/80 text-xs">Experimental — this project is in active development and things may break</span>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statsCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            className="bg-surface rounded-2xl border border-border p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <div className="flex items-center justify-between mb-4">
              <stat.icon className="w-5 h-5 text-text-tertiary" />
              <span className="text-success text-xs font-medium flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" />
                {stat.change}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
              <AnimatedCounter value={typeof stat.value === 'string' ? stat.value : Number(stat.value)} />
            </div>
            <p className="text-text-tertiary text-sm">{stat.title}</p>
          </motion.div>
        ))}
      </div>

      {/* Network + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          className="bg-surface rounded-2xl border border-border p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Network Activity</h2>
            <span className="text-[10px] text-text-tertiary bg-surface-raised px-2 py-0.5 rounded-full">Demo data</span>
          </div>
          <NetworkVisualization />
        </motion.div>

        <motion.div
          className="bg-surface rounded-2xl border border-border p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Live Feed</h2>
            <span className="text-[10px] text-text-tertiary bg-surface-raised px-2 py-0.5 rounded-full">Demo data</span>
          </div>
          <ActivityFeed activities={activities} />
        </motion.div>
      </div>

      {/* Leaderboard */}
      <motion.div
        className="bg-surface rounded-2xl border border-border"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-lg font-semibold">Top Agents by Reputation</h2>
        </div>

        {leaderboard.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  <th className="px-6 py-3">Rank</th>
                  <th className="px-6 py-3">Agent</th>
                  <th className="px-6 py-3">Rating</th>
                  <th className="px-6 py-3 hidden sm:table-cell">Volume</th>
                  <th className="px-6 py-3 hidden md:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaderboard.map((agent, index) => (
                  <tr key={agent.agent_id} className="hover:bg-surface-raised/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-text-tertiary font-mono text-sm">#{index + 1}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium">{agent.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm">{agent.avg_rating?.toFixed(1) || '—'}</span>
                      <span className="text-warning ml-1">★</span>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="text-text-secondary font-mono text-sm">
                        ${((agent.total_volume || 0) / 1000000).toFixed(2)}M
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-text-tertiary text-sm truncate block max-w-xs">
                        {agent.description}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 text-text-tertiary">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No agents registered yet</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;
