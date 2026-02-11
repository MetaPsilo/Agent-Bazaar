import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Copy, Wallet, Code, Rocket, Plus, Trash2 } from 'lucide-react';

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', description: '',
    services: [{ name: '', description: '', price: '' }],
    walletConnected: false, walletAddress: ''
  });

  const steps = [
    { n: 1, title: 'Agent Details', icon: Code },
    { n: 2, title: 'Services', icon: Code },
    { n: 3, title: 'Wallet', icon: Wallet },
    { n: 4, title: 'Deploy', icon: Rocket },
  ];

  const update = (field, value) => setForm(p => ({ ...p, [field]: value }));
  const updateService = (i, field, value) => {
    const s = [...form.services];
    s[i][field] = value;
    setForm(p => ({ ...p, services: s }));
  };
  const addService = () => setForm(p => ({ ...p, services: [...p.services, { name: '', description: '', price: '' }] }));
  const removeService = (i) => setForm(p => ({ ...p, services: p.services.filter((_, j) => j !== i) }));

  const connectWallet = () => {
    setTimeout(() => setForm(p => ({ ...p, walletConnected: true, walletAddress: 'HkrtQ8FGS2rkhCC11Z9gHaeMJ93DAfvutmTyq3bLvERd' })), 800);
  };

  const deploy = async () => {
    try {
      const res = await fetch('/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, description: form.description,
          owner: form.walletAddress, agentWallet: form.walletAddress,
          agentUri: `https://api.agentbazaar.com/agents/${form.name.toLowerCase().replace(/\s+/g, '-')}/registration.json`
        }),
      });
      if (res.ok) console.log('Agent registered:', await res.json());
    } catch (e) { console.error('Registration failed:', e); }
  };

  const inputClass = 'w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none transition-colors';

  const codeExamples = {
    register: `curl -X POST https://agentbazaar.org/agents \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "${form.name || 'MyAgent'}",
    "description": "AI agent description",
    "owner": "YOUR_WALLET_ADDRESS",
    "agentWallet": "YOUR_AGENT_WALLET"
  }'`,
    purchase: `const res = await fetch('/services/research/pulse');
if (res.status === 402) {
  const info = await res.json();
  const payment = await makePayment(info);
  const data = await fetch('/services/research/pulse', {
    headers: { 'Authorization': \`x402 \${proof}\` }
  }).then(r => r.json());
}`,
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Agent Name</label>
              <input type="text" className={inputClass} placeholder="e.g. MarketPulse AI" value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea rows={4} className={`${inputClass} resize-none`} placeholder="Describe your agent's capabilities..." value={form.description} onChange={e => update('description', e.target.value)} />
              <p className="text-xs text-text-tertiary mt-2">Be specific about capabilities and pricing model.</p>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Services & Pricing</h3>
              <button onClick={addService} className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {form.services.map((s, i) => (
              <div key={i} className="bg-surface-raised rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-secondary">Service {i + 1}</span>
                  {form.services.length > 1 && (
                    <button onClick={() => removeService(i)} className="text-text-tertiary hover:text-danger transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="text" className={inputClass} placeholder="Service name" value={s.name} onChange={e => updateService(i, 'name', e.target.value)} />
                  <input type="number" step="0.001" className={inputClass} placeholder="Price (USDC)" value={s.price} onChange={e => updateService(i, 'price', e.target.value)} />
                  <input type="text" className={inputClass} placeholder="Description" value={s.description} onChange={e => updateService(i, 'description', e.target.value)} />
                </div>
              </div>
            ))}
          </motion.div>
        );
      case 3:
        return (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-center">
            {!form.walletConnected ? (
              <>
                <Wallet className="w-16 h-16 text-text-tertiary mx-auto" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-text-secondary text-sm">Sign transactions and receive payments on Solana.</p>
                </div>
                <div className="flex gap-3 max-w-sm mx-auto">
                  <button onClick={connectWallet} className="flex-1 bg-[#ab9ff2] hover:bg-[#9b8fe2] text-white px-6 py-3 rounded-xl font-medium transition-colors">
                    Phantom
                  </button>
                  <button onClick={connectWallet} className="flex-1 bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-xl font-medium transition-colors">
                    Solflare
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-surface-raised rounded-xl p-6">
                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-success" />
                </div>
                <h3 className="text-lg font-semibold text-success mb-2">Wallet Connected</h3>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm font-mono text-text-secondary">{form.walletAddress.slice(0, 8)}...{form.walletAddress.slice(-8)}</span>
                  <button className="text-text-tertiary hover:text-text-primary"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}
          </motion.div>
        );
      case 4:
        return (
          <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-2">
              <Rocket className="w-12 h-12 text-accent mx-auto mb-3" />
              <h3 className="text-xl font-semibold">Ready to Deploy</h3>
            </div>

            <div className="bg-surface-raised rounded-xl p-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-text-tertiary">Name</span><span className="font-medium">{form.name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Services</span><span className="font-medium">{form.services.filter(s => s.name).length} configured</span></div>
              <div className="flex justify-between"><span className="text-text-tertiary">Wallet</span><span className="font-mono text-accent">{form.walletConnected ? 'Connected' : 'Not connected'}</span></div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-text-tertiary">Integration Examples</h4>
              {Object.entries(codeExamples).map(([title, code]) => (
                <div key={title} className="bg-primary rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                    <span className="text-xs font-medium text-text-tertiary capitalize">{title}</span>
                    <button className="text-text-tertiary hover:text-text-primary"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                  <pre className="p-4 text-xs text-text-secondary font-mono overflow-x-auto leading-relaxed"><code>{code}</code></pre>
                </div>
              ))}
            </div>

            <button
              onClick={deploy}
              disabled={!form.name || !form.walletConnected}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-3.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Rocket className="w-4 h-4" /> Deploy to Solana
            </button>
          </motion.div>
        );
      default: return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Register Your Agent</h1>
        <p className="text-text-secondary text-lg">Deploy to Solana in four steps. Start earning today.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step > s.n ? 'bg-success text-white' : step === s.n ? 'bg-accent text-white' : 'bg-surface-raised text-text-tertiary border border-border'
              }`}>
                {step > s.n ? <Check className="w-4 h-4" /> : s.n}
              </div>
              <span className="text-xs text-text-tertiary hidden sm:block">{s.title}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${step > s.n ? 'bg-success' : 'bg-border'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8">
        <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step > 1 && setStep(step - 1)}
          disabled={step <= 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-xs text-text-tertiary">Step {step} of 4</span>
        <button
          onClick={() => step < 4 && setStep(step + 1)}
          disabled={step >= 4}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-surface-raised hover:bg-border text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
