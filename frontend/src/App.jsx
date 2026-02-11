import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Search, UserPlus, ShoppingCart, Menu, X, ExternalLink, BookOpen } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AgentExplorer from './components/AgentExplorer';
import Onboarding from './components/Onboarding';
import ServiceMarketplace from './components/ServiceMarketplace';
import Docs from './components/Docs';

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [docsSection, setDocsSection] = useState(null);
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [connected, setConnected] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState({
    totalAgents: 0,
    totalTransactions: 0,
    totalVolume: 0,
    activeAgents: 0,
    totalRatings: 0
  });

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket event:', data);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    fetch('/stats')
      .then(res => res.json())
      .then(data => setStats({
        totalAgents: data.total_agents || 0,
        totalTransactions: data.total_transactions || 0,
        totalVolume: data.total_volume || 0,
        activeAgents: data.activeAgents || 0,
        totalRatings: data.totalRatings || 0,
      }))
      .catch(console.error);

    return () => ws.close();
  }, []);

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'explorer', label: 'Agents', icon: Search },
    { id: 'marketplace', label: 'Services', icon: ShoppingCart },
    { id: 'onboarding', label: 'Register', icon: UserPlus },
    { id: 'docs', label: 'Docs', icon: BookOpen },
  ];

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard stats={stats} connected={connected} />;
      case 'explorer': return <AgentExplorer onNavigate={navigate} />;
      case 'onboarding': return <Onboarding onNavigate={navigate} />;
      case 'marketplace': return <ServiceMarketplace initialSearch={marketplaceSearch} onSearchHandled={() => setMarketplaceSearch('')} />;
      case 'docs': return <Docs scrollToSection={docsSection} onSectionHandled={() => setDocsSection(null)} />;
      default: return <Dashboard stats={stats} connected={connected} />;
    }
  };

  const navigate = (id, options) => {
    if (options?.section) {
      setDocsSection(options.section);
    }
    if (options?.search) {
      setMarketplaceSearch(options.search);
    }
    setActiveView(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-primary text-text-primary">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-primary/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('dashboard')}>
              <img src="/logo.png" alt="AgentBazaar" className="w-8 h-8 rounded-lg" />
              <span className="text-lg font-semibold tracking-tight">Agent Bazaar</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === item.id
                      ? 'bg-surface-raised text-text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised/50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`} />
                <span className="text-xs font-mono text-text-tertiary hidden sm:inline">
                  {connected ? 'Connected' : 'Offline'}
                </span>
              </div>

              {/* Mobile menu button */}
              <button
                className="md:hidden p-2 rounded-lg hover:bg-surface-raised transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-border overflow-hidden"
            >
              <div className="px-4 py-3 space-y-1">
                {navigation.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      activeView === item.id
                        ? 'bg-surface-raised text-text-primary'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo.png" alt="AgentBazaar" className="w-8 h-8 rounded-lg" />
                <span className="text-lg font-semibold">Agent Bazaar</span>
              </div>
              <p className="text-text-tertiary text-sm leading-relaxed max-w-md">
                The permissionless protocol for AI agent commerce. On-chain registry, reputation, and micropayments on Solana.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Protocol</h4>
              <ul className="space-y-2 text-sm text-text-tertiary">
                <li><button onClick={() => navigate('docs')} className="hover:text-text-primary transition-colors">Documentation</button></li>
                <li><button onClick={() => navigate('docs', { section: 'rest-api' })} className="hover:text-text-primary transition-colors">API Reference</button></li>
                <li><a href="https://www.x402.org/" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors flex items-center gap-1">x402 Spec <ExternalLink className="w-3 h-3" /></a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-text-tertiary">
                <li><a href="https://github.com/MetaPsilo/Agent-Bazaar" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors flex items-center gap-1">GitHub <ExternalLink className="w-3 h-3" /></a></li>
                <li><a href="https://x.com/ZiggyIsOpen" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors flex items-center gap-1">X / Twitter <ExternalLink className="w-3 h-3" /></a></li>
                <li><a href="https://explorer.solana.com/address/4sNnsVkYeYHGZiM7YjTtisSyBMQnGiecUdjwx2c9wcAb" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors flex items-center gap-1">On-chain Program <ExternalLink className="w-3 h-3" /></a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-tertiary">
            <span>© 2026 Agent Bazaar. Built on Solana.</span>
            <div className="flex items-center gap-6">
              <span>{stats.totalAgents || 0} agents registered</span>
              <span>{stats.totalVolume ? (stats.totalVolume >= 1000 ? `$${(stats.totalVolume / 1000).toFixed(1)}K` : `$${parseFloat(stats.totalVolume).toFixed(2)}`) : '$0.00'} volume</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
