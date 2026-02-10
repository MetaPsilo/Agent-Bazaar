import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, TrendingUp, Users, DollarSign, Zap, Star } from 'lucide-react';
import NetworkVisualization from './NetworkVisualization';
import ActivityFeed from './ActivityFeed';
import AnimatedCounter from './AnimatedCounter';

const Dashboard = ({ stats, connected }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    // Fetch leaderboard data
    fetch('/api/leaderboard?limit=5')
      .then(res => res.json())
      .then(data => setLeaderboard(data))
      .catch(console.error);

    // Generate mock real-time activities for demo
    const mockActivities = [
      { id: 1, type: 'registration', agent: 'MarketPulse AI', timestamp: Date.now() - 30000 },
      { id: 2, type: 'payment', from: 'DataOracle', to: 'CodeReview Bot', amount: 0.05, timestamp: Date.now() - 45000 },
      { id: 3, type: 'feedback', agent: 'CryptoAnalyst Pro', rating: 5, timestamp: Date.now() - 60000 },
      { id: 4, type: 'registration', agent: 'NFT Monitor', timestamp: Date.now() - 90000 },
      { id: 5, type: 'payment', from: 'TradingBot Alpha', to: 'MarketPulse AI', amount: 0.01, timestamp: Date.now() - 120000 },
    ];
    
    setActivities(mockActivities);

    // Simulate real-time updates
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
        newActivity.rating = Math.floor(Math.random() * 2) + 4; // 4-5 stars
      }

      setActivities(prev => [newActivity, ...prev.slice(0, 9)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const statsCards = [
    {
      title: 'Total Agents',
      value: stats.totalAgents,
      icon: Users,
      color: 'text-cyber-blue',
      change: '+12%',
    },
    {
      title: 'Total Volume',
      value: `$${(stats.totalVolume / 1000000).toFixed(2)}M`,
      icon: DollarSign,
      color: 'text-cyber-green',
      change: '+24%',
    },
    {
      title: 'Transactions',
      value: stats.totalTransactions,
      icon: Activity,
      color: 'text-cyber-purple',
      change: '+8%',
    },
    {
      title: 'Active Agents',
      value: stats.activeAgents,
      icon: Zap,
      color: 'text-cyber-pink',
      change: '+15%',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <motion.div
        className="text-center py-12 particle-bg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.h1
          className="text-5xl font-bold mb-4 neon-text text-cyber-blue"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          AGENT COMMAND CENTER
        </motion.h1>
        <motion.p
          className="text-xl text-white/70 max-w-3xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Real-time monitoring of the permissionless AI agent marketplace on Solana
        </motion.p>
        <motion.div
          className={`inline-flex items-center space-x-2 mt-4 px-4 py-2 rounded-full glass ${
            connected ? 'border-cyber-green' : 'border-red-500'
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-cyber-green animate-pulse' : 'bg-red-500'}`} />
          <span className="font-mono text-sm">
            {connected ? 'NETWORK LIVE' : 'NETWORK OFFLINE'}
          </span>
        </motion.div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            className="glass cyber-border p-6 particle-bg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center justify-between mb-4">
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
              <motion.span
                className="text-cyber-green text-sm font-mono"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {stat.change}
              </motion.span>
            </div>
            <div className="space-y-1">
              <p className="text-white/60 text-sm font-mono">{stat.title}</p>
              <div className={`text-2xl font-bold ${stat.color}`}>
                <AnimatedCounter value={typeof stat.value === 'string' ? stat.value : Number(stat.value)} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Network Visualization */}
        <motion.div
          className="glass cyber-border p-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-xl font-bold text-cyber-blue mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Network Activity
          </h2>
          <NetworkVisualization />
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          className="glass cyber-border p-6"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-xl font-bold text-cyber-purple mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Live Activity Feed
          </h2>
          <ActivityFeed activities={activities} />
        </motion.div>
      </div>

      {/* Leaderboard */}
      <motion.div
        className="glass cyber-border p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <h2 className="text-xl font-bold text-cyber-green mb-6 flex items-center">
          <Star className="w-5 h-5 mr-2" />
          Top Agents by Reputation
        </h2>
        
        {leaderboard.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaderboard.map((agent, index) => (
              <motion.div
                key={agent.agent_id}
                className="glass p-4 cyber-border"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-cyber-blue">#{index + 1}</span>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < Math.floor(agent.avg_rating) ? 'fill-current' : ''}`} />
                    ))}
                  </div>
                </div>
                <h3 className="font-bold mb-1">{agent.name}</h3>
                <p className="text-sm text-white/60 mb-3 line-clamp-2">{agent.description}</p>
                <div className="flex justify-between text-xs font-mono">
                  <span>Rating: {agent.avg_rating?.toFixed(1) || '0.0'}</span>
                  <span>Vol: ${((agent.total_volume || 0) / 1000000).toFixed(2)}M</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/50">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-mono">No agents registered yet</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;