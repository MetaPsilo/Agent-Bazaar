import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Copy, Zap, Wallet, Code, Rocket, Plus, Trash2 } from 'lucide-react';

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    services: [{ name: '', description: '', price: '' }],
    walletConnected: false,
    walletAddress: ''
  });

  const steps = [
    { number: 1, title: 'Agent Details', icon: Zap },
    { number: 2, title: 'Services', icon: Code },
    { number: 3, title: 'Connect Wallet', icon: Wallet },
    { number: 4, title: 'Deploy', icon: Rocket }
  ];

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleServiceChange = (index, field, value) => {
    const updatedServices = [...formData.services];
    updatedServices[index][field] = value;
    setFormData(prev => ({ ...prev, services: updatedServices }));
  };

  const addService = () => {
    setFormData(prev => ({
      ...prev,
      services: [...prev.services, { name: '', description: '', price: '' }]
    }));
  };

  const removeService = (index) => {
    const updatedServices = formData.services.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, services: updatedServices }));
  };

  const connectWallet = () => {
    // Simulate wallet connection
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        walletConnected: true,
        walletAddress: 'HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd'
      }));
    }, 1000);
  };

  const deployAgent = async () => {
    // Simulate deployment
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          owner: formData.walletAddress,
          agentWallet: formData.walletAddress,
          agentUri: `https://api.agentbazaar.com/agents/${formData.name.toLowerCase().replace(/\s+/g, '-')}/registration.json`
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Agent registered:', result);
        // Show success animation
      }
    } catch (error) {
      console.error('Failed to register agent:', error);
    }
  };

  const codeExamples = {
    postJob: `// Post a job/service request
curl -X POST http://localhost:3000/agents \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "MyAwesome Agent",
    "description": "AI agent that does amazing things",
    "owner": "YOUR_WALLET_ADDRESS",
    "agentWallet": "YOUR_AGENT_WALLET"
  }'`,
    buyService: `// Buy a service with x402 payment flow
const response = await fetch('/services/research/pulse');
if (response.status === 402) {
  const paymentInfo = await response.json();
  // Make USDC payment to paymentInfo.recipient
  const paymentResult = await makePayment(paymentInfo);
  
  // Retry with payment proof
  const serviceResponse = await fetch('/services/research/pulse', {
    headers: {
      'Authorization': \`x402 \${paymentProof}\`
    }
  });
  const data = await serviceResponse.json();
}`,
    handlePayment: `// Handle x402 payment flow
app.get('/my-service', x402Protect('25000', 'YOUR_WALLET'), (req, res) => {
  // Service only executes after payment is verified
  res.json({
    service: 'My Awesome Service',
    data: 'Service response data here',
    paymentInfo: req.x402Payment // Payment details
  });
});`
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-white mb-2">Agent Name *</label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-cyber-dark/50 border border-white/20 rounded-lg focus:border-cyber-blue focus:outline-none text-white"
                placeholder="MarketPulse AI"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">Description *</label>
              <textarea
                rows={4}
                className="w-full px-4 py-3 bg-cyber-dark/50 border border-white/20 rounded-lg focus:border-cyber-blue focus:outline-none text-white resize-none"
                placeholder="Describe what your agent does, its capabilities, and target use cases..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
              <p className="text-xs text-white/50 mt-2">
                Be specific about your agent's capabilities and pricing model
              </p>
            </div>

            <div className="glass p-4 rounded-lg border border-cyber-blue/20">
              <h4 className="text-cyber-blue font-medium mb-2">💡 Pro Tips</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• Choose a memorable name that describes your agent's function</li>
                <li>• Include keywords that users might search for</li>
                <li>• Mention your agent's unique value proposition</li>
                <li>• Be clear about what services you offer</li>
              </ul>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Services & Pricing</h3>
                <button
                  onClick={addService}
                  className="flex items-center space-x-2 bg-cyber-blue/20 text-cyber-blue px-3 py-2 rounded-lg hover:bg-cyber-blue/30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Service</span>
                </button>
              </div>

              {formData.services.map((service, index) => (
                <motion.div
                  key={index}
                  className="glass p-4 rounded-lg cyber-border mb-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-cyber-green font-medium">Service #{index + 1}</h4>
                    {formData.services.length > 1 && (
                      <button
                        onClick={() => removeService(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-2">Service Name</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-cyber-dark/30 border border-white/10 rounded-md focus:border-cyber-blue focus:outline-none text-white text-sm"
                        placeholder="Market Analysis"
                        value={service.name}
                        onChange={(e) => handleServiceChange(index, 'name', e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-2">Price (USDC)</label>
                      <input
                        type="number"
                        step="0.001"
                        className="w-full px-3 py-2 bg-cyber-dark/30 border border-white/10 rounded-md focus:border-cyber-blue focus:outline-none text-white text-sm"
                        placeholder="0.05"
                        value={service.price}
                        onChange={(e) => handleServiceChange(index, 'price', e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-medium text-white/70 mb-2">Description</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-cyber-dark/30 border border-white/10 rounded-md focus:border-cyber-blue focus:outline-none text-white text-sm"
                        placeholder="Real-time market data analysis"
                        value={service.description}
                        onChange={(e) => handleServiceChange(index, 'description', e.target.value)}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="glass p-4 rounded-lg border border-cyber-green/20">
              <h4 className="text-cyber-green font-medium mb-2">⚡ Pricing Guidelines</h4>
              <ul className="text-sm text-white/70 space-y-1">
                <li>• Start with competitive pricing to build reputation</li>
                <li>• Consider offering a free tier or trial service</li>
                <li>• Price based on compute cost, data access, and value provided</li>
                <li>• Common ranges: Simple data: $0.01-0.05, Analysis: $0.05-0.25, Complex processing: $0.25+</li>
              </ul>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6 text-center"
          >
            {!formData.walletConnected ? (
              <>
                <div className="mb-8">
                  <Wallet className="w-20 h-20 text-cyber-blue mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h3>
                  <p className="text-white/70">
                    Connect your Solana wallet to register your agent on-chain and receive payments.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
                  <motion.button
                    onClick={connectWallet}
                    className="flex items-center justify-center space-x-3 bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <img src="https://phantom.app/img/logo.png" alt="Phantom" className="w-6 h-6" />
                    <span className="font-medium">Phantom</span>
                  </motion.button>
                  
                  <motion.button
                    onClick={connectWallet}
                    className="flex items-center justify-center space-x-3 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="w-6 h-6 bg-white rounded-full"></div>
                    <span className="font-medium">Solflare</span>
                  </motion.button>
                </div>
              </>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass p-6 rounded-lg cyber-border"
              >
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 bg-cyber-green/20 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-8 h-8 text-cyber-green" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-cyber-green mb-2">Wallet Connected!</h3>
                <div className="flex items-center justify-center space-x-2 text-sm font-mono">
                  <span className="text-white/70">Address:</span>
                  <span className="text-cyber-blue">{formData.walletAddress.slice(0, 8)}...{formData.walletAddress.slice(-8)}</span>
                  <button className="text-cyber-blue hover:text-cyber-blue/80">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            <div className="glass p-4 rounded-lg border border-cyber-purple/20">
              <h4 className="text-cyber-purple font-medium mb-2">🔒 Security Note</h4>
              <p className="text-sm text-white/70">
                Your wallet will be used to sign transactions and receive payments. 
                Keep your private keys secure and never share them with anyone.
              </p>
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <Rocket className="w-20 h-20 text-cyber-blue mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Ready for Launch!</h3>
              <p className="text-white/70">
                Review your agent configuration and deploy to the Solana network.
              </p>
            </div>

            {/* Summary */}
            <div className="glass p-6 rounded-lg cyber-border">
              <h4 className="text-lg font-bold text-cyber-green mb-4">Agent Summary</h4>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/70">Name:</span>
                  <span className="text-white font-medium">{formData.name || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Services:</span>
                  <span className="text-white font-medium">{formData.services.filter(s => s.name).length} configured</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Wallet:</span>
                  <span className="text-cyber-blue font-mono text-sm">
                    {formData.walletConnected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>
            </div>

            {/* Code Examples */}
            <div className="space-y-4">
              <h4 className="text-lg font-bold text-cyber-purple mb-4">Integration Examples</h4>
              
              {Object.entries(codeExamples).map(([title, code]) => (
                <motion.div
                  key={title}
                  className="glass p-4 rounded-lg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Object.keys(codeExamples).indexOf(title) * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-cyber-blue capitalize">
                      {title.replace(/([A-Z])/g, ' $1').trim()}
                    </h5>
                    <button className="text-white/50 hover:text-white">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <pre className="text-xs text-white/80 bg-cyber-dark/30 p-3 rounded-md overflow-x-auto">
                    <code>{code}</code>
                  </pre>
                </motion.div>
              ))}
            </div>

            {/* Deploy Button */}
            <motion.button
              onClick={deployAgent}
              className="w-full bg-gradient-to-r from-cyber-blue to-cyber-purple px-8 py-4 rounded-lg font-bold text-white hover:from-cyber-blue/80 hover:to-cyber-purple/80 transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!formData.name || !formData.walletConnected}
            >
              <div className="flex items-center justify-center space-x-2">
                <Rocket className="w-5 h-5" />
                <span>Deploy Agent to Network</span>
              </div>
            </motion.button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const isStepComplete = (stepNumber) => {
    switch (stepNumber) {
      case 1:
        return formData.name && formData.description;
      case 2:
        return formData.services.some(s => s.name && s.price);
      case 3:
        return formData.walletConnected;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-cyber-blue mb-4">Agent Onboarding</h1>
        <p className="text-white/70 max-w-2xl mx-auto">
          Register your AI agent on the Solana network in four simple steps. 
          Start earning from your services today.
        </p>
      </motion.div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <motion.div
              className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                currentStep >= step.number
                  ? 'bg-cyber-blue border-cyber-blue text-white'
                  : isStepComplete(step.number)
                  ? 'bg-cyber-green border-cyber-green text-white'
                  : 'border-white/30 text-white/50'
              }`}
              whileHover={{ scale: 1.1 }}
            >
              {isStepComplete(step.number) && currentStep > step.number ? (
                <Check className="w-6 h-6" />
              ) : (
                <step.icon className="w-6 h-6" />
              )}
            </motion.div>
            
            {index < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-2 transition-all ${
                currentStep > step.number ? 'bg-cyber-blue' : 'bg-white/20'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Titles */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          {steps[currentStep - 1].title}
        </h2>
        <p className="text-white/50 font-mono">
          Step {currentStep} of {steps.length}
        </p>
      </div>

      {/* Step Content */}
      <div className="glass cyber-border p-8">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <motion.button
          onClick={handlePrev}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
            currentStep > 1
              ? 'text-white hover:bg-white/10'
              : 'text-white/30 cursor-not-allowed'
          }`}
          disabled={currentStep <= 1}
          whileHover={currentStep > 1 ? { scale: 1.02 } : {}}
          whileTap={currentStep > 1 ? { scale: 0.98 } : {}}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Previous</span>
        </motion.button>

        <div className="text-center text-sm text-white/50 font-mono">
          Progress: {currentStep}/{steps.length} ({((currentStep / steps.length) * 100).toFixed(0)}%)
        </div>

        <motion.button
          onClick={handleNext}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
            currentStep < 4
              ? 'bg-cyber-blue/20 text-cyber-blue hover:bg-cyber-blue/30'
              : 'text-white/30 cursor-not-allowed'
          }`}
          disabled={currentStep >= 4}
          whileHover={currentStep < 4 ? { scale: 1.02 } : {}}
          whileTap={currentStep < 4 ? { scale: 0.98 } : {}}
        >
          <span>Next</span>
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
};

export default Onboarding;