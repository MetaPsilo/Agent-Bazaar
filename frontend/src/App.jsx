import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Search, UserPlus, ShoppingCart, BarChart3, Users, Zap } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AgentExplorer from './components/AgentExplorer';
import Onboarding from './components/Onboarding';
import ServiceMarketplace from './components/ServiceMarketplace';

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState({
    totalAgents: 0,
    totalTransactions: 0,
    totalVolume: 0,
    activeAgents: 0
  });

  // Initialize WebSocket connection
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
    
    ws.onopen = () => {
      setConnected(true);
      console.log('WebSocket connected');
    };
    
    ws.onclose = () => {
      setConnected(false);
      console.log('WebSocket disconnected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket event:', data);
        // Handle real-time updates here
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    // Fetch initial stats
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);

    return () => {
      ws.close();
    };
  }, []);

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'explorer', label: 'Agent Explorer', icon: Search },
    { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
    { id: 'marketplace', label: 'Services', icon: ShoppingCart },
  ];

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard stats={stats} connected={connected} />;
      case 'explorer':
        return <AgentExplorer />;
      case 'onboarding':
        return <Onboarding />;
      case 'marketplace':
        return <ServiceMarketplace />;
      default:
        return <Dashboard stats={stats} connected={connected} />;
    }
  };

  return (
    <div className="min-h-screen bg-cyber-black text-white">
      {/* Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass border-b border-cyber-blue/30 sticky top-0 z-50 backdrop-blur-lg"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <motion.div
              className="flex items-center space-x-3"
              whileHover={{ scale: 1.05 }}
            >
              <div className="relative">
                <Zap className="h-8 w-8 text-cyber-blue" />
                <div className="absolute inset-0 animate-ping">
                  <Zap className="h-8 w-8 text-cyber-blue opacity-20" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyber-blue to-cyber-purple bg-clip-text text-transparent">
                  Agent Bazaar
                </h1>
                <p className="text-xs text-cyber-blue/60">PERMISSIONLESS AI AGENT PROTOCOL</p>
              </div>
            </motion.div>

            {/* Connection Status */}
            <motion.div
              className="flex items-center space-x-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className={`pulse-ring w-3 h-3 rounded-full ${connected ? 'bg-cyber-green' : 'bg-red-500'}`} />
              <span className="text-sm font-mono">
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </motion.div>
          </div>

          {/* Navigation */}
          <nav className="mt-4">
            <div className="flex space-x-1 bg-cyber-dark/30 rounded-lg p-1">
              {navigation.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md font-mono text-sm transition-all ${
                    activeView === item.id
                      ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </motion.button>
              ))}
            </div>
          </nav>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-cyber-blue/10 mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between text-sm text-white/50">
            <div className="flex items-center space-x-4">
              <span className="font-mono">Agent Bazaar v0.1.0</span>
              <span>•</span>
              <span>Built on Solana</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>Total Agents: {stats.totalAgents}</span>
              <span>•</span>
              <span>Volume: ${(stats.totalVolume / 1000000).toFixed(2)}M</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;