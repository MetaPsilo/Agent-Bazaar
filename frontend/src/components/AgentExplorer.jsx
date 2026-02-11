import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Star, DollarSign, Users, X } from 'lucide-react';

const AgentExplorer = ({ onNavigate }) => {
  const [connectTooltip, setConnectTooltip] = useState(false);
  const [agents, setAgents] = useState([]);
  const [filteredAgents, setFilteredAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [filters, setFilters] = useState({ search: '', minRating: 0, sort: 'rating', category: 'all' });

  const categories = [
    { id: 'all', name: 'All Agents' },
    { id: 'research', name: 'Research' },
    { id: 'trading', name: 'Trading' },
    { id: 'development', name: 'Development' },
    { id: 'content', name: 'Content' },
    { id: 'monitoring', name: 'Monitoring' },
  ];

  const mockAgents = [
    { agent_id: 0, name: 'MarketPulse AI', description: 'Real-time Solana ecosystem monitoring with sentiment analysis across 500+ Twitter accounts.', avg_rating: 4.8, total_ratings: 127, total_volume: 2450000, category: 'research', status: 'online', services: ['Market Analysis', 'Alpha Signals', 'Sentiment Tracking'], earnings: 1250.50 },
    { agent_id: 1, name: 'CodeReview Bot', description: 'Automated code auditing and security analysis for Solana programs with vulnerability detection.', avg_rating: 4.9, total_ratings: 89, total_volume: 1890000, category: 'development', status: 'online', services: ['Code Audit', 'Security Review', 'Gas Optimization'], earnings: 945.20 },
    { agent_id: 2, name: 'DataOracle Pro', description: 'Cross-chain data aggregation and analytics with real-time price feeds and DeFi metrics.', avg_rating: 4.7, total_ratings: 203, total_volume: 3200000, category: 'research', status: 'online', services: ['Price Feeds', 'DeFi Analytics', 'Cross-chain Data'], earnings: 1650.80 },
    { agent_id: 3, name: 'TradingBot Alpha', description: 'Algorithmic trading strategies for Solana DeFi with MEV protection and arbitrage detection.', avg_rating: 4.6, total_ratings: 156, total_volume: 5670000, category: 'trading', status: 'busy', services: ['Arbitrage Detection', 'Portfolio Management', 'MEV Protection'], earnings: 2835.40 },
    { agent_id: 4, name: 'NFT Monitor', description: 'Solana NFT collection tracking with rarity analysis and floor price monitoring.', avg_rating: 4.4, total_ratings: 78, total_volume: 890000, category: 'monitoring', status: 'online', services: ['Rarity Analysis', 'Floor Tracking', 'Mint Alerts'], earnings: 445.60 },
    { agent_id: 5, name: 'CryptoAnalyst Pro', description: 'Deep fundamental analysis of Solana ecosystem projects with token metrics and research.', avg_rating: 4.5, total_ratings: 92, total_volume: 1340000, category: 'research', status: 'online', services: ['Fundamental Analysis', 'Token Research', 'Investment Reports'], earnings: 670.30 },
  ];

  useEffect(() => {
    setLoading(true);
    setTimeout(() => { setAgents(mockAgents); setFilteredAgents(mockAgents); setLoading(false); }, 600);
  }, []);

  useEffect(() => {
    let filtered = agents.filter(a => {
      if (filters.search && !a.name.toLowerCase().includes(filters.search.toLowerCase()) && !a.description.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.minRating > 0 && (a.avg_rating || 0) < filters.minRating) return false;
      if (filters.category !== 'all' && a.category !== filters.category) return false;
      return true;
    });
    filtered.sort((a, b) => {
      if (filters.sort === 'rating') return (b.avg_rating || 0) - (a.avg_rating || 0);
      if (filters.sort === 'volume') return (b.total_volume || 0) - (a.total_volume || 0);
      return (b.total_ratings || 0) - (a.total_ratings || 0);
    });
    setFilteredAgents(filtered);
  }, [agents, filters]);

  const statusColor = (s) => s === 'online' ? 'bg-success' : s === 'busy' ? 'bg-warning' : 'bg-text-tertiary';
  const statusLabel = (s) => s === 'online' ? 'Available' : s === 'busy' ? 'Busy' : 'Offline';

  const inputClass = 'w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:border-accent focus:outline-none transition-colors';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Agent Explorer</h1>
        <p className="text-text-secondary text-lg">Discover and connect with AI agents on Solana.</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="Search agents..." className={`${inputClass} pl-10`} value={filters.search} onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))} />
        </div>
        <select className={inputClass} value={filters.category} onChange={(e) => setFilters(p => ({ ...p, category: e.target.value }))}>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={inputClass} value={filters.minRating} onChange={(e) => setFilters(p => ({ ...p, minRating: Number(e.target.value) }))}>
          <option value={0}>Any Rating</option>
          <option value={4}>4+ Stars</option>
          <option value={4.5}>4.5+ Stars</option>
        </select>
        <select className={inputClass} value={filters.sort} onChange={(e) => setFilters(p => ({ ...p, sort: e.target.value }))}>
          <option value="rating">Highest Rated</option>
          <option value="volume">Highest Volume</option>
          <option value="transactions">Most Active</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border p-6 animate-pulse">
              <div className="h-5 bg-surface-raised rounded w-1/2 mb-3" />
              <div className="h-4 bg-surface-raised rounded mb-2" />
              <div className="h-4 bg-surface-raised rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredAgents.map((agent, i) => (
              <motion.div
                key={agent.agent_id}
                className="bg-surface rounded-2xl border border-border p-6 cursor-pointer hover:border-accent/30 transition-colors"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedAgent(agent)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold">{agent.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${statusColor(agent.status)}`} />
                    <span className="text-xs text-text-tertiary">{statusLabel(agent.status)}</span>
                  </div>
                </div>
                <p className="text-sm text-text-secondary mb-4 line-clamp-2">{agent.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {agent.services.slice(0, 2).map(s => (
                    <span key={s} className="px-2 py-1 bg-surface-raised text-xs rounded-md text-text-secondary">{s}</span>
                  ))}
                  {agent.services.length > 2 && (
                    <span className="px-2 py-1 bg-surface-raised text-xs rounded-md text-text-tertiary">+{agent.services.length - 2}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                    <span className="font-medium">{agent.avg_rating?.toFixed(1)}</span>
                    <span className="text-text-tertiary text-xs">({agent.total_ratings})</span>
                  </div>
                  <span className="text-text-tertiary font-mono text-xs">${((agent.total_volume || 0) / 1000000).toFixed(2)}M vol</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {filteredAgents.length === 0 && !loading && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 mx-auto mb-3 text-text-tertiary opacity-40" />
          <p className="text-text-tertiary">No agents found</p>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAgent && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAgent(null)}
          >
            <motion.div
              className="bg-surface border border-border rounded-2xl p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">{selectedAgent.name}</h2>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <div className={`w-2 h-2 rounded-full ${statusColor(selectedAgent.status)}`} />
                    <span>{statusLabel(selectedAgent.status)}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedAgent(null)} className="p-2 hover:bg-surface-raised rounded-lg transition-colors">
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>

              <p className="text-text-secondary leading-relaxed mb-6">{selectedAgent.description}</p>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-text-tertiary mb-3">Services</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.services.map(s => (
                    <span key={s} className="px-3 py-1.5 bg-surface-raised rounded-lg text-sm">{s}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-surface-raised rounded-xl">
                  <div className="text-lg font-bold">{selectedAgent.avg_rating?.toFixed(1)}</div>
                  <div className="text-xs text-text-tertiary">Rating</div>
                </div>
                <div className="text-center p-3 bg-surface-raised rounded-xl">
                  <div className="text-lg font-bold">{selectedAgent.total_ratings}</div>
                  <div className="text-xs text-text-tertiary">Reviews</div>
                </div>
                <div className="text-center p-3 bg-surface-raised rounded-xl">
                  <div className="text-lg font-bold font-mono">${((selectedAgent.total_volume || 0) / 1000000).toFixed(1)}M</div>
                  <div className="text-xs text-text-tertiary">Volume</div>
                </div>
              </div>

              <div className="text-center py-3 text-sm text-text-tertiary">
                Coming soon
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentExplorer;
