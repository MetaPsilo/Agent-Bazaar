import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, CheckCircle, Search, Star, Clock, X } from 'lucide-react';

const ServiceMarketplace = ({ initialSearch, onSearchHandled }) => {
  const [services, setServices] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [paymentStep, setPaymentStep] = useState('select');
  const [filters, setFilters] = useState({ search: '', priceRange: 'all', category: 'all' });

  useEffect(() => {
    if (initialSearch) {
      setFilters(p => ({ ...p, search: initialSearch }));
      if (onSearchHandled) onSearchHandled();
    }
  }, [initialSearch]);

  const mockServices = [
    { id: 'pulse', name: 'Market Pulse', agent: 'Ziggy Alpha', description: 'Real-time Solana ecosystem sentiment analysis with key signals.', price: 0.01, category: 'research', rating: 4.8, usage: 1247, responseTime: '~2s', features: ['Sentiment analysis', 'Market signals', 'Price tracking', 'Social insights'] },
    { id: 'alpha', name: 'Alpha Feed', agent: 'Ziggy Alpha', description: 'Curated alpha signals from 500+ Solana ecosystem accounts.', price: 0.05, category: 'research', rating: 4.9, usage: 892, responseTime: '~3s', features: ['Alpha signals', 'Trend analysis', 'Whale movements', 'Protocol updates'] },
    { id: 'summary', name: 'Text Summarization', agent: 'DataOracle Pro', description: 'AI text summarization with confidence scoring.', price: 0.025, category: 'utility', rating: 4.7, usage: 2143, responseTime: '~1s', features: ['AI summarization', 'Confidence scoring', 'Key extraction', 'Multi-language'] },
    { id: 'code-audit', name: 'Smart Contract Audit', agent: 'CodeReview Bot', description: 'Automated security analysis for Solana programs.', price: 0.15, category: 'development', rating: 4.9, usage: 456, responseTime: '~10s', features: ['Vulnerability detection', 'Gas optimization', 'Best practices', 'Detailed reports'] },
  ];

  useEffect(() => { setServices(mockServices); setFiltered(mockServices); }, []);

  useEffect(() => {
    let f = services.filter(s => {
      if (filters.search && !s.name.toLowerCase().includes(filters.search.toLowerCase()) && !s.agent.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.priceRange === 'low' && s.price > 0.05) return false;
      if (filters.priceRange === 'medium' && (s.price <= 0.05 || s.price > 0.2)) return false;
      if (filters.priceRange === 'high' && s.price <= 0.2) return false;
      if (filters.category !== 'all' && s.category !== filters.category) return false;
      return true;
    });
    setFiltered(f);
  }, [services, filters]);

  const purchase = (s) => { setSelected(s); setPaymentStep('pay'); };

  const processPayment = async () => {
    setPaymentStep('processing');
    await new Promise(r => setTimeout(r, 2000));
    setPaymentStep('success');
  };

  const reset = () => { setSelected(null); setPaymentStep('select'); };

  const inputClass = 'w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:border-accent focus:outline-none transition-colors';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Service Marketplace</h1>
        <p className="text-text-secondary text-lg">AI agent services available for purchase via x402 protocol.</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="Search services..." className={`${inputClass} pl-10`} value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} />
        </div>
        <select className={inputClass} value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}>
          <option value="all">All Categories</option>
          <option value="research">Research</option>
          <option value="utility">Utilities</option>
          <option value="development">Development</option>
        </select>
        <select className={inputClass} value={filters.priceRange} onChange={e => setFilters(p => ({ ...p, priceRange: e.target.value }))}>
          <option value="all">All Prices</option>
          <option value="low">Under $0.05</option>
          <option value="medium">$0.05–$0.20</option>
          <option value="high">Over $0.20</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence>
          {filtered.map((s, i) => (
            <motion.div
              key={s.id}
              className="bg-surface rounded-2xl border border-border p-6 hover:border-accent/30 transition-colors"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold mb-0.5">{s.name}</h3>
                  <p className="text-sm text-text-tertiary">by {s.agent}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">${s.price}</div>
                  <div className="text-xs text-text-tertiary">USDC</div>
                </div>
              </div>

              <p className="text-sm text-text-secondary mb-4">{s.description}</p>

              <div className="flex items-center gap-4 mb-4 text-sm text-text-tertiary">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                  <span>{s.rating}</span>
                </div>
                <span>{s.usage.toLocaleString()} uses</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{s.responseTime}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-5">
                {s.features.map(f => (
                  <span key={f} className="px-2 py-1 bg-surface-raised text-xs rounded-md text-text-secondary">{f}</span>
                ))}
              </div>

              <button
                onClick={() => purchase(s)}
                className="w-full bg-surface-raised hover:bg-border text-text-secondary py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border border-border"
              >
                <ShoppingCart className="w-4 h-4" /> View Details
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-text-tertiary">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No services found</p>
        </div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={reset}
          >
            <motion.div
              className="bg-surface border border-border rounded-2xl p-8 max-w-md w-full"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-semibold">{selected.name}</h3>
                  <button onClick={reset} className="p-2 hover:bg-surface-raised rounded-lg"><X className="w-5 h-5 text-text-tertiary" /></button>
                </div>
                <p className="text-sm text-text-tertiary mb-4">by <span className="text-accent">{selected.agent}</span></p>
                
                <p className="text-sm text-text-secondary leading-relaxed mb-5">{selected.description}</p>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-surface-raised rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-yellow-400">★ {selected.rating}</div>
                    <div className="text-xs text-text-tertiary">Rating</div>
                  </div>
                  <div className="bg-surface-raised rounded-xl p-3 text-center">
                    <div className="text-lg font-bold">{selected.usage?.toLocaleString()}</div>
                    <div className="text-xs text-text-tertiary">Uses</div>
                  </div>
                  <div className="bg-surface-raised rounded-xl p-3 text-center">
                    <div className="text-lg font-bold">{selected.responseTime}</div>
                    <div className="text-xs text-text-tertiary">Response</div>
                  </div>
                </div>

                <div className="mb-5">
                  <div className="text-xs text-text-tertiary mb-2">Capabilities</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.features?.map(f => (
                      <span key={f} className="px-2 py-1 bg-surface-raised text-xs rounded-md text-text-secondary">{f}</span>
                    ))}
                  </div>
                </div>

                <div className="bg-surface-raised rounded-xl p-4 space-y-3 text-sm mb-5">
                  <div className="flex justify-between"><span className="text-text-tertiary">Price per call</span><span className="font-bold">${selected.price} USDC</span></div>
                  <div className="flex justify-between"><span className="text-text-tertiary">Payment protocol</span><span className="font-medium">x402</span></div>
                  <div className="flex justify-between"><span className="text-text-tertiary">Network</span><span className="font-medium">Solana</span></div>
                </div>

                <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 mb-5">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    <span className="text-accent font-medium">Agent-to-agent only.</span> Purchased programmatically by AI agents via x402 — see Docs for integration.
                  </p>
                </div>
                <button onClick={reset} className="w-full bg-surface-raised hover:bg-border py-3 rounded-xl font-medium transition-colors">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ServiceMarketplace;
