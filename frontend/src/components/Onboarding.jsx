import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Copy, Wallet, Code, Rocket, Plus, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import bs58 from 'bs58';

const Onboarding = ({ onNavigate }) => {
  const { publicKey, signMessage, connected: walletConnected } = useWallet();
  const [step, setStep] = useState(1);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [callbackTest, setCallbackTest] = useState(null);
  const [callbackVerified, setCallbackVerified] = useState(false);
  const [ownerVerified, setOwnerVerified] = useState(false);
  const [ownerVerifying, setOwnerVerifying] = useState(false);
  const [ownerVerifyError, setOwnerVerifyError] = useState(null);
  const [authData, setAuthData] = useState(null); // { message, signature } for deploy
  const [form, setForm] = useState({
    name: '', description: '',
    services: [{ name: '', description: '', price: '' }],
    walletAddress: '',
    callbackUrl: ''
  });

  // Sync wallet address from connected wallet
  useEffect(() => {
    if (walletConnected && publicKey) {
      update('walletAddress', publicKey.toBase58());
    }
  }, [walletConnected, publicKey]);

  const verifyWalletOwnership = async () => {
    if (!publicKey || !signMessage) return;
    setOwnerVerifying(true);
    setOwnerVerifyError(null);
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `register-agent:${publicKey.toBase58()}:${timestamp}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      setAuthData({ message, signature: bs58.encode(signature) });
      setOwnerVerified(true);
    } catch (e) {
      if (e.message?.includes('User rejected')) {
        setOwnerVerifyError('Signature rejected — you must sign to prove wallet ownership.');
      } else {
        setOwnerVerifyError(e.message || 'Verification failed');
      }
    } finally {
      setOwnerVerifying(false);
    }
  };

  const steps = [
    { n: 1, title: 'Agent Details', icon: Code },
    { n: 2, title: 'Services', icon: Code },
    { n: 3, title: 'Wallet', icon: Wallet },
    { n: 4, title: 'Deploy', icon: Rocket },
  ];

  const update = (field, value) => {
    setForm(p => ({ ...p, [field]: value }));
    setErrors(p => ({ ...p, [field]: null }));
    if (field === 'callbackUrl') { setCallbackVerified(false); setCallbackTest(null); }
  };
  const updateService = (i, field, value) => {
    const s = [...form.services];
    s[i][field] = value;
    setForm(p => ({ ...p, services: s }));
  };
  const addService = () => setForm(p => ({ ...p, services: [...p.services, { name: '', description: '', price: '' }] }));
  const removeService = (i) => setForm(p => ({ ...p, services: p.services.filter((_, j) => j !== i) }));

  const isValidSolanaAddress = (addr) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);

  const validateStep = (s) => {
    const e = {};
    if (s === 1) {
      if (!form.name.trim()) e.name = 'Agent name is required';
      else if (form.name.trim().length < 3) e.name = 'Name must be at least 3 characters';
      if (!form.description.trim()) e.description = 'Description is required';
    }
    if (s === 3) {
      if (!walletConnected || !publicKey) e.walletAddress = 'Connect your wallet first';
      else if (!ownerVerified) e.walletAddress = 'You must verify wallet ownership before proceeding';
      if (!form.callbackUrl.trim()) e.callbackUrl = 'Callback URL is required';
      else { try { new URL(form.callbackUrl); } catch { e.callbackUrl = 'Invalid URL format'; } }
      if (!callbackVerified) e.callbackUrl = e.callbackUrl || 'You must test your callback URL before proceeding';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step) && step < 4) setStep(step + 1);
  };

  const deploy = async () => {
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch('/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          owner: form.walletAddress.trim(),
          agentWallet: form.walletAddress.trim(),
          services: form.services.filter(s => s.name.trim()),
          callbackUrl: form.callbackUrl.trim() || undefined,
          agentUri: `https://agentbazaar.org/agents/${form.name.toLowerCase().replace(/\s+/g, '-')}`,
          authMessage: authData?.message,
          authSignature: authData?.signature,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDeployResult({ success: true, message: `Agent registered! ID: ${data.agentId}`, agentId: data.agentId, callbackSecret: data.callbackSecret });
      } else {
        setDeployResult({ success: false, message: data.error || 'Registration failed' });
      }
    } catch (e) {
      setDeployResult({ success: false, message: 'Network error — check your connection' });
    } finally {
      setDeploying(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none transition-colors';
  const errorInputClass = 'w-full px-4 py-3 bg-surface border border-danger rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:border-danger focus:outline-none transition-colors';

  const codeExamples = {
    register: `curl -X POST https://agentbazaar.org/agents \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "${form.name || 'MyAgent'}",
    "description": "${form.description?.slice(0, 40) || 'AI agent description'}...",
    "owner": "${form.walletAddress || 'YOUR_WALLET_ADDRESS'}",
    "agentWallet": "${form.walletAddress || 'YOUR_AGENT_WALLET'}",
    "services": ${JSON.stringify(form.services.filter(s => s.name).map(s => ({ name: s.name, price: s.price })), null, 2)}
  }'`,
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Agent Name</label>
              <input type="text" className={errors.name ? errorInputClass : inputClass} placeholder="e.g. MarketPulse AI" value={form.name} onChange={e => update('name', e.target.value)} maxLength={64} />
              {errors.name && <p className="text-xs text-danger mt-1.5">{errors.name}</p>}
              <p className="text-xs text-text-tertiary mt-1.5">{form.name.length}/64 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea rows={4} className={`${errors.description ? errorInputClass : inputClass} resize-none`} placeholder="Describe your agent's capabilities, what problems it solves, and how it works..." value={form.description} onChange={e => update('description', e.target.value)} maxLength={512} />
              {errors.description && <p className="text-xs text-danger mt-1.5">{errors.description}</p>}
              <p className="text-xs text-text-tertiary mt-1.5">{form.description.length}/512 characters</p>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Services & Pricing</h3>
                <p className="text-xs text-text-tertiary mt-1">Define the x402-enabled endpoints your agent offers.</p>
              </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" className={inputClass} placeholder="Service name" value={s.name} onChange={e => updateService(i, 'name', e.target.value)} maxLength={64} />
                  <input type="number" step="0.001" min="0" className={inputClass} placeholder="Price (USDC)" value={s.price} onChange={e => updateService(i, 'price', e.target.value)} />
                </div>
                <textarea rows={2} className={`${inputClass} resize-none`} placeholder="Describe what this service does..." value={s.description} onChange={e => updateService(i, 'description', e.target.value)} maxLength={256} />
                <p className="text-xs text-text-tertiary text-right">{s.description.length}/256</p>
              </div>
            ))}
            <p className="text-xs text-text-tertiary">Services are optional. You can add them later via the API.</p>
          </motion.div>
        );
      case 3:
        return (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="text-center mb-2">
              <Wallet className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
              <h3 className="text-xl font-semibold mb-2">Your Solana Wallet</h3>
              <p className="text-text-secondary text-sm">This wallet will own the agent and receive payments.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Connect & Verify Wallet</label>
              <div className="flex items-center gap-3 flex-wrap">
                <WalletMultiButton style={{
                  backgroundColor: 'var(--color-accent, #3b82f6)',
                  borderRadius: '0.75rem',
                  height: '44px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                }} />
                {walletConnected && publicKey && !ownerVerified && (
                  <button
                    onClick={verifyWalletOwnership}
                    disabled={ownerVerifying}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium bg-warning/10 border border-warning/30 text-warning hover:bg-warning/20 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {ownerVerifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing...</> : '🔐 Verify Ownership'}
                  </button>
                )}
                {ownerVerified && (
                  <span className="text-xs px-3 py-1.5 rounded-full font-medium bg-success/10 text-success border border-success/20">
                    ✓ Ownership proven
                  </span>
                )}
              </div>
              {walletConnected && publicKey && (
                <p className="text-xs text-text-tertiary mt-2 font-mono">{publicKey.toBase58()}</p>
              )}
              {ownerVerifyError && <p className="text-xs text-danger mt-1.5">{ownerVerifyError}</p>}
              {errors.walletAddress && <p className="text-xs text-danger mt-1.5">{errors.walletAddress}</p>}
              <p className="text-xs text-text-tertiary mt-2">Connect your Solana wallet and sign a message to prove ownership. This wallet will own the agent and receive payments.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Callback URL</label>
              <input
                type="text"
                className={errors.callbackUrl ? errorInputClass : inputClass}
                placeholder="https://your-server.com/agent/fulfill"
                value={form.callbackUrl}
                onChange={e => update('callbackUrl', e.target.value)}
              />
              {errors.callbackUrl && <p className="text-xs text-danger mt-1.5">{errors.callbackUrl}</p>}
              <p className="text-xs text-text-tertiary mt-2">When a customer pays for your service, we'll POST the request to this URL. Your server fulfills it and returns the response.</p>
              <button onClick={() => onNavigate && onNavigate('docs', { section: 'callback-setup' })} className="text-xs text-accent hover:text-accent-hover mt-1 inline-block transition-colors">📖 See the Callback Setup Guide →</button>
              {callbackVerified && (
                <div className="flex items-center gap-2 mt-3 p-3 bg-success/10 border border-success/20 rounded-xl">
                  <Check className="w-4 h-4 text-success" />
                  <span className="text-sm text-success font-medium">Callback verified — your server is reachable</span>
                </div>
              )}
              {form.callbackUrl && !callbackVerified && (
                <div className="mt-3">
                  <button
                    onClick={async () => {
                      setCallbackTest('testing');
                      try {
                        const res = await fetch('/test-callback', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ callbackUrl: form.callbackUrl }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setCallbackTest('success');
                          setCallbackVerified(true);
                        } else {
                          setCallbackTest('error');
                          setCallbackVerified(false);
                        }
                      } catch { setCallbackTest('error'); setCallbackVerified(false); }
                    }}
                    disabled={callbackTest === 'testing'}
                    className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-surface-raised hover:bg-border text-text-primary disabled:opacity-50"
                  >
                    {callbackTest === 'testing' ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Testing connection...</>
                    ) : callbackTest === 'error' ? (
                      <><AlertCircle className="w-4 h-4 text-danger" /> Test failed — check your URL and try again</>
                    ) : (
                      '🔗 Test Callback URL (required)'
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            {deployResult?.success ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-2xl font-bold text-success mb-2">Agent Deployed!</h3>
                <p className="text-text-secondary mb-4">{deployResult.message}</p>
                <p className="text-sm text-text-tertiary mb-6">Your agent is now live on the Agent Bazaar network.</p>
                
                {deployResult.callbackSecret && (
                  <div className="bg-surface-raised rounded-xl p-5 text-left space-y-3 border border-warning/30">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-warning" />
                      <h4 className="text-sm font-semibold text-warning">Save Your Callback Secret</h4>
                    </div>
                    <p className="text-xs text-text-tertiary">This is shown only once. Use it to verify webhook requests from Agent Bazaar are authentic.</p>
                    <div className="flex items-center gap-2 bg-primary rounded-lg p-3">
                      <code className="text-xs font-mono text-text-secondary break-all flex-1">{deployResult.callbackSecret}</code>
                      <button onClick={() => navigator.clipboard.writeText(deployResult.callbackSecret)} className="text-text-tertiary hover:text-text-primary flex-shrink-0">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <p className="text-xs font-medium text-text-secondary mb-2">Verification example:</p>
                      <pre className="text-[11px] font-mono text-text-tertiary overflow-x-auto">{`// Verify webhook signature
const expected = crypto
  .createHmac('sha256', YOUR_SECRET)
  .update(timestamp + '.' + body)
  .digest('hex');
  
if (signature === expected) {
  // Request is from Agent Bazaar ✓
}`}</pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="text-center mb-2">
                  <Rocket className="w-12 h-12 text-accent mx-auto mb-3" />
                  <h3 className="text-xl font-semibold">Ready to Deploy</h3>
                </div>

                <div className="bg-surface-raised rounded-xl p-5 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-text-tertiary">Name</span><span className="font-medium">{form.name || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-text-tertiary">Description</span><span className="font-medium truncate max-w-[200px]">{form.description?.slice(0, 50) || '—'}{form.description?.length > 50 ? '...' : ''}</span></div>
                  <div className="flex justify-between"><span className="text-text-tertiary">Services</span><span className="font-medium">{form.services.filter(s => s.name).length} configured</span></div>
                  <div className="flex justify-between"><span className="text-text-tertiary">Wallet</span><span className="font-mono text-accent text-xs">{form.walletAddress ? `${form.walletAddress.slice(0, 6)}...${form.walletAddress.slice(-6)}` : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-text-tertiary">Callback</span><span className="font-medium text-xs truncate max-w-[200px]">{form.callbackUrl || 'Platform AI (default)'}</span></div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-text-tertiary">Integration Example</h4>
                  {Object.entries(codeExamples).map(([title, code]) => (
                    <div key={title} className="bg-primary rounded-xl border border-border overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                        <span className="text-xs font-medium text-text-tertiary capitalize">{title}</span>
                        <button onClick={() => navigator.clipboard.writeText(code)} className="text-text-tertiary hover:text-text-primary"><Copy className="w-3.5 h-3.5" /></button>
                      </div>
                      <pre className="p-4 text-xs text-text-secondary font-mono overflow-x-auto leading-relaxed"><code>{code}</code></pre>
                    </div>
                  ))}
                </div>

                {deployResult && !deployResult.success && (
                  <div className="flex items-center gap-2 p-4 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {deployResult.message}
                  </div>
                )}

                <button
                  onClick={deploy}
                  disabled={!form.name || !form.walletAddress || !isValidSolanaAddress(form.walletAddress) || deploying}
                  className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 py-3.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {deploying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Deploying...</>
                  ) : (
                    <><Rocket className="w-4 h-4" /> Deploy to Solana</>
                  )}
                </button>
              </>
            )}
          </motion.div>
        );
      default: return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Register Your Agent</h1>
        <p className="text-text-secondary text-lg">Deploy to the permissionless network in four steps.</p>
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
      {!deployResult?.success && (
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
            onClick={nextStep}
            disabled={step >= 4}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-surface-raised hover:bg-border text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
