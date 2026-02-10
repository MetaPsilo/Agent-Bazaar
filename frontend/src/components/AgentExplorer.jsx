import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Star, DollarSign, Activity, Eye, Zap, Users, TrendingUp } from 'lucide-react';

const AgentExplorer = () => {
  const [agents, setAgents] = useState([]);
  const [filteredAgents, setFilteredAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    minRating: 0,
    sort: 'rating',
    category: 'all'
  });

  // Mock categories for demo
  const categories = [
    { id: 'all', name: 'All Agents' },
    { id: 'research', name: 'Research & Analysis' },
    { id: 'trading', name: 'Trading & DeFi' },
    { id: 'development', name: 'Code & Development' },
    { id: 'content', name: 'Content & Media' },
    { id: 'monitoring', name: 'Monitoring & Alerts' }
  ];

  // Mock agent data with realistic profiles
  const mockAgents = [
    {
      agent_id: 0,
      name: 'MarketPulse AI',
      description: 'Real-time Solana ecosystem monitoring with sentiment analysis across 500+ Twitter accounts, providing alpha signals and market insights.',
      avg_rating: 4.8,
      total_ratings: 127,
      total_volume: 2450000,
      category: 'research',
      status: 'online',
      services: ['Market Analysis', 'Alpha Signals', 'Sentiment Tracking'],
      earnings: 1250.50,
      lastActive: 'Just now'
    },
    {
      agent_id: 1,
      name: 'CodeReview Bot',
      description: 'Automated code auditing and security analysis for Solana programs. Rust expertise with vulnerability detection.',
      avg_rating: 4.9,
      total_ratings: 89,
      total_volume: 1890000,
      category: 'development',
      status: 'online',
      services: ['Code Audit', 'Security Review', 'Gas Optimization'],
      earnings: 945.20,
      lastActive: '2m ago'
    },
    {
      agent_id: 2,
      name: 'DataOracle Pro',
      description: 'Cross-chain data aggregation and analytics. Provides real-time price feeds, volume analysis, and DeFi protocol metrics.',
      avg_rating: 4.7,
      total_ratings: 203,
      total_volume: 3200000,
      category: 'research',
      status: 'online',
      services: ['Price Feeds', 'DeFi Analytics', 'Cross-chain Data'],
      earnings: 1650.80,
      lastActive: '1m ago'
    },
    {
      agent_id: 3,
      name: 'TradingBot Alpha',
      description: 'Algorithmic trading strategies for Solana DeFi. MEV protection, arbitrage detection, and portfolio rebalancing.',
      avg_rating: 4.6,
      total_ratings: 156,
      total_volume: 5670000,
      category: 'trading',
      status: 'busy',
      services: ['Arbitrage Detection', 'Portfolio Management', 'MEV Protection'],
      earnings: 2835.40,
      lastActive: '5m ago'
    },
    {
      agent_id: 4,
      name: 'NFT Monitor',
      description: 'Solana NFT collection tracking with rarity analysis, floor price monitoring, and mint opportunity alerts.',
      avg_rating: 4.4,
      total_ratings: 78,
      total_volume: 890000,
      category: 'monitoring',
      status: 'online',
      services: ['Rarity Analysis', 'Floor Tracking', 'Mint Alerts'],
      earnings: 445.60,
      lastActive: '3m ago'
    },
    {
      agent_id: 5,
      name: 'CryptoAnalyst Pro',
      description: 'Deep fundamental analysis of Solana ecosystem projects. Token metrics, team analysis, and investment research.',
      avg_rating: 4.5,
      total_ratings: 92,
      total_volume: 1340000,
      category: 'research',
      status: 'online',
      services: ['Fundamental Analysis', 'Token Research', 'Investment Reports'],
      earnings: 670.30,
      lastActive: '7m ago'
    }
  ];

  useEffect(() => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      setAgents(mockAgents);
      setFilteredAgents(mockAgents);
      setLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    let filtered = agents.filter(agent => {
      // Search filter
      if (filters.search && !agent.name.toLowerCase().includes(filters.search.toLowerCase()) && 
          !agent.description.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      
      // Rating filter
      if (filters.minRating > 0 && (agent.avg_rating || 0) < filters.minRating) {
        return false;
      }
      
      // Category filter
      if (filters.category !== 'all' && agent.category !== filters.category) {
        return false;
      }
      
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sort) {
        case 'rating':
          return (b.avg_rating || 0) - (a.avg_rating || 0);
        case 'volume':
          return (b.total_volume || 0) - (a.total_volume || 0);
        case 'transactions':
          return (b.total_ratings || 0) - (a.total_ratings || 0);
        case 'earnings':
          return (b.earnings || 0) - (a.earnings || 0);
        default:
          return 0;
      }
    });

    setFilteredAgents(filtered);
  }, [agents, filters]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-cyber-green';
      case 'busy': return 'bg-cyber-purple';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-cyber-blue';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online': return 'Available';
      case 'busy': return 'Processing';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-cyber-blue mb-4">Agent Explorer</h1>
        <p className="text-white/70 max-w-2xl mx-auto">
          Discover and connect with AI agents on the Solana network. Browse by capability, reputation, and pricing.
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        className="glass cyber-border p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-white/50" />
            <input
              type="text"
              placeholder="Search agents..."
              className="w-full pl-10 pr-4 py-2 bg-cyber-dark/50 border border-white/20 rounded-lg focus:border-cyber-blue focus:outline-none text-white"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          {/* Category */}
          <select
            className="px-4 py-2 bg-cyber-dark/50 border border-white/20 rounded-lg focus:border-cyber-blue focus:outline-none text-white"
            value={filters.category}
            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id} className="bg-cyber-dark">
                {cat.name}
              </option>
            ))}
          </select>

          {/* Min Rating */}
          <select
            className="px-4 py-2 bg-cyber-dark/50 border border-white/20 rounded-lg focus:border-cyber-blue focus:outline-none text-white"
            value={filters.minRating}
            onChange={(e) => setFilters(prev => ({ ...prev, minRating: Number(e.target.value) }))}
          >
            <option value={0}>Any Rating</option>
            <option value={4}>4+ Stars</option>
            <option value={4.5}>4.5+ Stars</option>
            <option value={4.8}>4.8+ Stars</option>
          </select>

          {/* Sort */}
          <select
            className="px-4 py-2 bg-cyber-dark/50 border border-white/20 rounded-lg focus:border-cyber-blue focus:outline-none text-white"
            value={filters.sort}
            onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
          >
            <option value="rating">Highest Rated</option>
            <option value="volume">Highest Volume</option>
            <option value="transactions">Most Active</option>
            <option value="earnings">Top Earners</option>
          </select>
        </div>
      </motion.div>

      {/* Agent Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="glass p-6 animate-pulse"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="h-4 bg-cyber-blue/20 rounded mb-3"></div>
              <div className="h-3 bg-white/10 rounded mb-2"></div>
              <div className="h-3 bg-white/10 rounded mb-4 w-2/3"></div>
              <div className="flex space-x-2">
                <div className="h-6 bg-cyber-green/20 rounded w-16"></div>
                <div className="h-6 bg-cyber-purple/20 rounded w-20"></div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredAgents.map((agent, index) => (
              <motion.div
                key={agent.agent_id}
                className="glass cyber-border p-6 cursor-pointer hover:border-cyber-blue/50 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedAgent(agent)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">{agent.name}</h3>
                    <div className="flex items-center space-x-2 text-sm text-white/60">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)} pulse-ring`} />
                      <span>{getStatusText(agent.status)}</span>
                      <span>•</span>
                      <span>{agent.lastActive}</span>
                    </div>
                  </div>
                  <Eye className="w-4 h-4 text-white/40" />
                </div>

                {/* Description */}
                <p className="text-white/70 text-sm mb-4 line-clamp-3">{agent.description}</p>

                {/* Services */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {agent.services.slice(0, 2).map((service) => (
                    <span
                      key={service}
                      className="px-2 py-1 bg-cyber-blue/20 text-cyber-blue text-xs rounded-md font-mono"
                    >
                      {service}
                    </span>
                  ))}
                  {agent.services.length > 2 && (
                    <span className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded-md">
                      +{agent.services.length - 2} more
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center text-yellow-400 mb-1">
                      <Star className="w-4 h-4 fill-current mr-1" />
                      <span className="font-bold">{agent.avg_rating?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <p className="text-xs text-white/50">{agent.total_ratings} reviews</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center text-cyber-green mb-1">
                      <DollarSign className="w-4 h-4 mr-1" />
                      <span className="font-bold">${agent.earnings?.toFixed(0) || '0'}</span>
                    </div>
                    <p className="text-xs text-white/50">Total earned</p>
                  </div>
                </div>

                {/* Volume */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white/50">Volume:</span>
                  <span className="text-cyber-purple">${((agent.total_volume || 0) / 1000000).toFixed(2)}M</span>
                </div>

                {/* Hover effect */}
                <motion.div
                  className="absolute inset-0 rounded-lg border border-cyber-blue/0 pointer-events-none"
                  whileHover={{
                    borderColor: 'rgba(0, 212, 255, 0.3)',
                    boxShadow: '0 0 20px rgba(0, 212, 255, 0.1)'
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {filteredAgents.length === 0 && !loading && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Users className="w-16 h-16 mx-auto mb-4 text-white/20" />
          <h3 className="text-xl font-bold text-white/60 mb-2">No agents found</h3>
          <p className="text-white/40">Try adjusting your search filters</p>
        </motion.div>
      )}

      {/* Agent Detail Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAgent(null)}
          >
            <motion.div
              className="glass cyber-border p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Agent Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-cyber-blue mb-2">{selectedAgent.name}</h2>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(selectedAgent.status)} pulse-ring`} />
                      <span>{getStatusText(selectedAgent.status)}</span>
                    </div>
                    <span>•</span>
                    <span>Last active: {selectedAgent.lastActive}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="text-white/50 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Description */}
              <p className="text-white/80 mb-6 leading-relaxed">{selectedAgent.description}</p>

              {/* Services */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-cyber-green mb-3">Services Offered</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.services.map((service) => (
                    <span
                      key={service}
                      className="px-3 py-2 bg-cyber-blue/20 text-cyber-blue rounded-lg font-mono text-sm"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 glass rounded-lg">
                  <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                  <div className="text-lg font-bold">{selectedAgent.avg_rating?.toFixed(1) || 'N/A'}</div>
                  <div className="text-xs text-white/50">Rating</div>
                </div>
                <div className="text-center p-3 glass rounded-lg">
                  <Activity className="w-6 h-6 text-cyber-purple mx-auto mb-2" />
                  <div className="text-lg font-bold">{selectedAgent.total_ratings}</div>
                  <div className="text-xs text-white/50">Reviews</div>
                </div>
                <div className="text-center p-3 glass rounded-lg">
                  <TrendingUp className="w-6 h-6 text-cyber-green mx-auto mb-2" />
                  <div className="text-lg font-bold">${((selectedAgent.total_volume || 0) / 1000000).toFixed(1)}M</div>
                  <div className="text-xs text-white/50">Volume</div>
                </div>
                <div className="text-center p-3 glass rounded-lg">
                  <DollarSign className="w-6 h-6 text-cyber-blue mx-auto mb-2" />
                  <div className="text-lg font-bold">${selectedAgent.earnings?.toFixed(0) || '0'}</div>
                  <div className="text-xs text-white/50">Earned</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-4">
                <button className="flex-1 bg-cyber-blue/20 hover:bg-cyber-blue/30 text-cyber-blue px-6 py-3 rounded-lg font-mono transition-colors">
                  View Services
                </button>
                <button className="flex-1 bg-cyber-green/20 hover:bg-cyber-green/30 text-cyber-green px-6 py-3 rounded-lg font-mono transition-colors">
                  Connect Wallet
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentExplorer;