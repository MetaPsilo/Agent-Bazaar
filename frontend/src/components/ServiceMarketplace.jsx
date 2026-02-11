import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Star, X } from 'lucide-react';

const ServiceMarketplace = ({ initialSearch, onSearchHandled }) => {
  const [services, setServices] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: '', priceRange: 'all' });

  useEffect(() => {
    if (initialSearch) {
      setFilters(p => ({ ...p, search: initialSearch }));
      if (onSearchHandled) onSearchHandled();
    }
  }, [initialSearch]);

  useEffect(() => {
    fetch('/agents')
      .then(res => res.json())
      .then(data => {
        const agents = Array.isArray(data) ? data : (data.agents || []);
        // Flatten agent services into marketplace listings
        const allServices = agents.flatMap(agent =>
          (agent.services || []).map((s, idx) => ({
            id: `${agent.agent_id}-${idx}`,
            name: typeof s === 'string' ? s : s.name,
            agent: agent.name,
            description: typeof s === 'string' ? '' : (s.description || ''),
            price: typeof s === 'string' ? 0 : (parseFloat(s.price) || 0),
            category: 'all',
            rating: agent.avg_rating || 0,
            usage: agent.total_ratings || 0,
            responseTime: '—',
            features: [],
          }))
        );
        setServices(allServices);
        setFiltered(allServices);
      })
      .catch(() => { setServices([]); setFiltered([]); });
  }, []);

  useEffect(() => {
    let f = services.filter(s => {
      if (filters.search && !s.name.toLowerCase().includes(filters.search.toLowerCase()) && !s.agent.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.priceRange === 'low' && s.price > 0.05) return false;
      if (filters.priceRange === 'medium' && (s.price <= 0.05 || s.price > 0.2)) return false;
      if (filters.priceRange === 'high' && s.price <= 0.2) return false;
      // Category filtering removed — not yet settable
      return true;
    });
    setFiltered(f);
  }, [services, filters]);

  const purchase = (s) => { setSelected(s); };
  const reset = () => { setSelected(null); };

  const inputClass = 'w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:border-accent focus:outline-none transition-colors';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Service Marketplace</h1>
        <p className="text-text-secondary text-lg">AI agent services available for purchase via x402 protocol.</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="Search services..." className={`${inputClass} pl-10`} value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} />
        </div>
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
        <div className="text-center py-20 text-text-tertiary">
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No services available yet</h3>
          <p className="text-sm max-w-md mx-auto">Services appear here when registered agents publish x402-enabled endpoints.</p>
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
