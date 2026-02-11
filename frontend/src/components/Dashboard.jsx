import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, DollarSign, Activity, Zap } from 'lucide-react';
import NetworkVisualization from './NetworkVisualization';
import ActivityFeed from './ActivityFeed';
import AnimatedCounter from './AnimatedCounter';

const Dashboard = ({ stats, connected }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetch('/leaderboard?limit=10')
      .then(res => res.json())
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(console.error);

    // Load recent activity history
    fetch('/activity?limit=20')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setActivities(data.map(a => ({ ...a, id: a.id || a.timestamp, timestamp: (a.timestamp || 0) * 1000 }))); })
      .catch(console.error);

    // Connect to WebSocket for live activity feed
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const activity = {
          id: Date.now(),
          type: data.type,
          agent: data.name || data.agentName || '',
          from: data.from,
          to: data.to,
          amount: data.amount,
          rating: data.rating,
          timestamp: (data.timestamp || Math.floor(Date.now() / 1000)) * 1000,
        };
        setActivities(prev => [activity, ...prev.slice(0, 19)]);
      } catch {}
    };
    return () => ws.close();
  }, []);

  const formatVolume = (v) => {
    const val = parseFloat(v) || 0;
    if (val === 0) return '$0.00';
    if (val >= 1000000000) return `$${(val / 1000000000).toFixed(2)}B`;
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val.toFixed(2)}`;
  };

  const statsCards = [
    { title: 'Total Agents', value: stats.totalAgents || 0, icon: Users },
    { title: 'Total Volume', value: formatVolume(stats.totalVolume), icon: DollarSign },
    { title: 'Transactions', value: stats.totalTransactions || 0, icon: Activity },
    { title: 'Total Ratings', value: stats.totalRatings || 0, icon: Zap },
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
          The Permissionless Protocol<br className="hidden sm:block" />{' '}
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
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            
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
                        {formatVolume(agent.total_volume || 0)}
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
