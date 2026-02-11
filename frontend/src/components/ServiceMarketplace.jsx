import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, CreditCard, CheckCircle, Search, Filter, DollarSign, Zap, Star, Clock, ArrowRight } from 'lucide-react';

const ServiceMarketplace = () => {
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [paymentStep, setPaymentStep] = useState('select'); // select, pay, processing, success
  const [filters, setFilters] = useState({
    search: '',
    priceRange: 'all',
    category: 'all'
  });

  // Mock services data
  const mockServices = [
    {
      id: 'pulse',
      name: 'Market Pulse',
      agent: 'Ziggy Alpha',
      agentId: 0,
      description: 'Real-time Solana ecosystem sentiment analysis with key signals and market insights.',
      price: 0.01,
      priceUSDC: '10000',
      category: 'research',
      rating: 4.8,
      usage: 1247,
      responseTime: '~2s',
      endpoint: '/services/research/pulse',
      features: [
        'Real-time sentiment analysis',
        'Key market signals',
        'Price movement tracking',
        'Social media insights'
      ]
    },
    {
      id: 'alpha',
      name: 'Alpha Feed',
      agent: 'Ziggy Alpha',
      agentId: 0,
      description: 'Curated alpha signals from 500+ Solana ecosystem accounts with trend analysis.',
      price: 0.05,
      priceUSDC: '50000',
      category: 'research',
      rating: 4.9,
      usage: 892,
      responseTime: '~3s',
      endpoint: '/services/research/alpha',
      features: [
        'Curated alpha signals',
        'Trend analysis',
        'Whale movements',
        'Protocol updates'
      ]
    },
    {
      id: 'summary',
      name: 'Text Summarization',
      agent: 'DataOracle Pro',
      agentId: 2,
      description: 'Advanced AI text summarization with confidence scoring and key insights extraction.',
      price: 0.025,
      priceUSDC: '25000',
      category: 'utility',
      rating: 4.7,
      usage: 2143,
      responseTime: '~1s',
      endpoint: '/services/text-summary',
      features: [
        'AI-powered summarization',
        'Confidence scoring',
        'Key insights extraction',
        'Multi-language support'
      ]
    },
    {
      id: 'code-audit',
      name: 'Smart Contract Audit',
      agent: 'CodeReview Bot',
      agentId: 1,
      description: 'Automated security analysis for Solana programs with vulnerability detection.',
      price: 0.15,
      priceUSDC: '150000',
      category: 'development',
      rating: 4.9,
      usage: 456,
      responseTime: '~10s',
      endpoint: '/services/code/audit',
      features: [
        'Security vulnerability detection',
        'Gas optimization suggestions',
        'Best practices analysis',
        'Detailed reporting'
      ]
    }
  ];

  useEffect(() => {
    setServices(mockServices);
    setFilteredServices(mockServices);
  }, []);

  useEffect(() => {
    let filtered = services.filter(service => {
      // Search filter
      if (filters.search && 
          !service.name.toLowerCase().includes(filters.search.toLowerCase()) && 
          !service.description.toLowerCase().includes(filters.search.toLowerCase()) &&
          !service.agent.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      
      // Price range filter
      if (filters.priceRange !== 'all') {
        const price = service.price;
        switch (filters.priceRange) {
          case 'low':
            if (price > 0.05) return false;
            break;
          case 'medium':
            if (price <= 0.05 || price > 0.2) return false;
            break;
          case 'high':
            if (price <= 0.2) return false;
            break;
        }
      }
      
      // Category filter
      if (filters.category !== 'all' && service.category !== filters.category) {
        return false;
      }
      
      return true;
    });

    setFilteredServices(filtered);
  }, [services, filters]);

  const handlePurchase = async (service) => {
    setSelectedService(service);
    setPaymentStep('pay');
  };

  const processPayment = async () => {
    setPaymentStep('processing');
    
    try {
      // Simulate x402 payment flow
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Call the actual service endpoint
      const response = await fetch(`/${selectedService.endpoint}`);
      
      if (response.status === 402) {
        // Handle payment required
        const paymentInfo = await response.json();
        console.log('Payment required:', paymentInfo);
        
        // Simulate payment completion
        await new Promise(resolve => setTimeout(resolve, 1000));
        setPaymentStep('success');
      } else {
        // Service already accessible or error
        setPaymentStep('success');
      }
    } catch (error) {
      console.error('Payment failed:', error);
      // Handle error
      setPaymentStep('select');
    }
  };

  const resetPayment = () => {
    setSelectedService(null);
    setPaymentStep('select');
  };

  const categories = [
    { id: 'all', name: 'All Categories' },
    { id: 'research', name: 'Research & Analysis' },
    { id: 'utility', name: 'Utilities' },
    { id: 'development', name: 'Development' },
    { id: 'trading', name: 'Trading' }
  ];

  const priceRanges = [
    { id: 'all', name: 'All Prices' },
    { id: 'low', name: 'Under $0.05' },
    { id: 'medium', name: '$0.05 - $0.20' },
    { id: 'high', name: 'Over $0.20' }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-cyber-blue mb-4">Service Marketplace</h1>
        <p className="text-white/70 max-w-2xl mx-auto">
          Browse and purchase AI services from agents on the Solana network. 
          All payments use x402 protocol with USDC.
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        className="glass cyber-border p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-white/50" />
            <input
              type="text"
              placeholder="Search services..."
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

          {/* Price Range */}
          <select
            className="px-4 py-2 bg-cyber-dark/50 border border-white/20 rounded-lg focus:border-cyber-blue focus:outline-none text-white"
            value={filters.priceRange}
            onChange={(e) => setFilters(prev => ({ ...prev, priceRange: e.target.value }))}
          >
            {priceRanges.map(range => (
              <option key={range.id} value={range.id} className="bg-cyber-dark">
                {range.name}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredServices.map((service, index) => (
            <motion.div
              key={service.id}
              className="glass cyber-border p-6 hover:border-cyber-blue/50 transition-colors cursor-pointer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
            >
              {/* Service Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{service.name}</h3>
                  <p className="text-cyber-blue text-sm font-mono">by {service.agent}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-cyber-green">${service.price}</div>
                  <div className="text-xs text-white/50 font-mono">USDC</div>
                </div>
              </div>

              {/* Description */}
              <p className="text-white/70 text-sm mb-4 line-clamp-2">{service.description}</p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                <div>
                  <div className="flex items-center justify-center text-yellow-400 mb-1">
                    <Star className="w-3 h-3 fill-current mr-1" />
                    <span className="text-sm font-bold">{service.rating}</span>
                  </div>
                  <p className="text-xs text-white/50">Rating</p>
                </div>
                <div>
                  <div className="flex items-center justify-center text-cyber-purple mb-1">
                    <Zap className="w-3 h-3 mr-1" />
                    <span className="text-sm font-bold">{service.usage}</span>
                  </div>
                  <p className="text-xs text-white/50">Uses</p>
                </div>
                <div>
                  <div className="flex items-center justify-center text-cyber-blue mb-1">
                    <Clock className="w-3 h-3 mr-1" />
                    <span className="text-sm font-bold">{service.responseTime}</span>
                  </div>
                  <p className="text-xs text-white/50">Speed</p>
                </div>
              </div>

              {/* Features */}
              <div className="mb-4">
                <div className="flex flex-wrap gap-1">
                  {service.features.slice(0, 2).map((feature) => (
                    <span
                      key={feature}
                      className="px-2 py-1 bg-cyber-blue/20 text-cyber-blue text-xs rounded-md font-mono"
                    >
                      {feature}
                    </span>
                  ))}
                  {service.features.length > 2 && (
                    <span className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded-md">
                      +{service.features.length - 2} more
                    </span>
                  )}
                </div>
              </div>

              {/* Purchase Button */}
              <motion.button
                onClick={() => handlePurchase(service)}
                className="w-full bg-gradient-to-r from-cyber-green/80 to-cyber-blue/80 hover:from-cyber-green hover:to-cyber-blue px-4 py-3 rounded-lg font-bold text-white transition-all flex items-center justify-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Purchase Service</span>
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredServices.length === 0 && (
        <motion.div
          className="text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-white/20" />
          <h3 className="text-xl font-bold text-white/60 mb-2">No services found</h3>
          <p className="text-white/40">Try adjusting your search filters</p>
        </motion.div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {selectedService && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="glass cyber-border p-8 max-w-lg w-full"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              {paymentStep === 'pay' && (
                <div className="text-center">
                  <CreditCard className="w-16 h-16 text-cyber-blue mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">Complete Payment</h3>
                  <p className="text-white/70 mb-6">
                    You're about to purchase <strong>{selectedService.name}</strong> from{' '}
                    <strong>{selectedService.agent}</strong>
                  </p>

                  <div className="glass p-4 rounded-lg mb-6">
                    <div className="flex justify-between mb-3">
                      <span className="text-white/70">Service:</span>
                      <span className="text-white font-medium">{selectedService.name}</span>
                    </div>
                    <div className="flex justify-between mb-3">
                      <span className="text-white/70">Provider:</span>
                      <span className="text-cyber-blue">{selectedService.agent}</span>
                    </div>
                    <div className="flex justify-between mb-3">
                      <span className="text-white/70">Price:</span>
                      <span className="text-cyber-green font-bold">${selectedService.price} USDC</span>
                    </div>
                    <div className="border-t border-white/10 pt-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-white">Total:</span>
                        <span className="text-cyber-green">${selectedService.price} USDC</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={resetPayment}
                      className="flex-1 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <motion.button
                      onClick={processPayment}
                      className="flex-1 bg-gradient-to-r from-cyber-green to-cyber-blue px-6 py-3 rounded-lg font-bold text-white transition-all"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Pay with USDC
                    </motion.button>
                  </div>
                </div>
              )}

              {paymentStep === 'processing' && (
                <div className="text-center">
                  <motion.div
                    className="w-16 h-16 border-4 border-cyber-blue/30 border-t-cyber-blue rounded-full mx-auto mb-4"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <h3 className="text-2xl font-bold text-white mb-2">Processing Payment</h3>
                  <p className="text-white/70 mb-4">
                    Verifying USDC transaction on Solana...
                  </p>
                  <div className="space-y-2 text-left">
                    <motion.div
                      className="flex items-center text-sm"
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <CheckCircle className="w-4 h-4 text-cyber-green mr-2" />
                      <span>Payment submitted</span>
                    </motion.div>
                    <motion.div
                      className="flex items-center text-sm"
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.0 }}
                    >
                      <CheckCircle className="w-4 h-4 text-cyber-green mr-2" />
                      <span>Transaction confirmed</span>
                    </motion.div>
                    <motion.div
                      className="flex items-center text-sm"
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.5 }}
                    >
                      <motion.div
                        className="w-4 h-4 border-2 border-cyber-blue/30 border-t-cyber-blue rounded-full mr-2"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                      />
                      <span>Calling service...</span>
                    </motion.div>
                  </div>
                </div>
              )}

              {paymentStep === 'success' && (
                <motion.div
                  className="text-center"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <div className="w-16 h-16 bg-cyber-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-cyber-green" />
                  </div>
                  <h3 className="text-2xl font-bold text-cyber-green mb-2">Payment Successful!</h3>
                  <p className="text-white/70 mb-6">
                    Your service request has been processed. The agent is preparing your response.
                  </p>

                  <div className="glass p-4 rounded-lg mb-6 text-left">
                    <h4 className="font-bold text-white mb-3">Service Response:</h4>
                    <div className="space-y-2 text-sm text-white/80">
                      {selectedService.id === 'pulse' && (
                        <div>
                          <p className="font-mono text-cyber-blue mb-2">Market Pulse Data:</p>
                          <p>• Current Solana ecosystem sentiment: BULLISH</p>
                          <p>• Key signals: Jupiter V2 launch trending</p>
                          <p>• SOL price: +5.2% (24h)</p>
                          <p>• DeFi TVL: $1.2B (+3.1%)</p>
                        </div>
                      )}
                      {selectedService.id === 'alpha' && (
                        <div>
                          <p className="font-mono text-cyber-blue mb-2">Alpha Signals:</p>
                          <p>🔥 @toly hints at Firedancer improvements</p>
                          <p>📊 Whale alert: 1M USDC → Jupiter farming</p>
                          <p>🚀 Solana Mobile announcement expected</p>
                        </div>
                      )}
                      {selectedService.id === 'summary' && (
                        <div>
                          <p className="font-mono text-cyber-blue mb-2">Text Summary:</p>
                          <p>High-performance blockchain supporting crypto apps that scale today...</p>
                          <p>Confidence: 92%</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={resetPayment}
                      className="flex-1 bg-cyber-blue/20 hover:bg-cyber-blue/30 text-cyber-blue px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Use Again
                    </button>
                    <button
                      onClick={resetPayment}
                      className="flex-1 bg-cyber-green/20 hover:bg-cyber-green/30 text-cyber-green px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ServiceMarketplace;