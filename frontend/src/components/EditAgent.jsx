import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Loader2, AlertCircle, CheckCircle, Save, Wallet } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import bs58 from 'bs58';

const EditAgent = ({ agent, onClose, onSaved }) => {
  const { publicKey, signMessage, connected } = useWallet();
  const [form, setForm] = useState({
    name: agent.name || '',
    description: agent.description || '',
    callbackUrl: agent.callback_url || '',
    services: (agent.services || []).map(s => ({ ...s })),
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const isOwner = connected && publicKey && publicKey.toBase58() === agent.owner;

  const inputClass = 'w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none transition-colors';

  const update = (field, value) => setForm(p => ({ ...p, [field]: value }));
  const updateService = (i, field, value) => {
    const s = [...form.services];
    s[i] = { ...s[i], [field]: value };
    setForm(p => ({ ...p, services: s }));
  };
  const addService = () => {
    if (form.services.length >= 20) return;
    setForm(p => ({ ...p, services: [...p.services, { name: '', description: '', price: '' }] }));
  };
  const removeService = (i) => setForm(p => ({ ...p, services: p.services.filter((_, j) => j !== i) }));

  const handleSave = async () => {
    if (!publicKey || !signMessage) return;
    setSaving(true);
    setResult(null);
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `update:${agent.agent_id}:${timestamp}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      const signatureBase58 = bs58.encode(signature);

      const body = {
        owner: publicKey.toBase58(),
        authMessage: message,
        authSignature: signatureBase58,
      };
      if (form.name !== agent.name) body.name = form.name;
      if (form.description !== agent.description) body.description = form.description;
      if (form.callbackUrl !== (agent.callback_url || '')) body.callbackUrl = form.callbackUrl || null;
      body.services = form.services.filter(s => s.name.trim());

      const res = await fetch(`/agents/${agent.agent_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: 'Agent updated successfully!' });
        onSaved?.();
      } else {
        setResult({ success: false, message: data.error || 'Update failed' });
      }
    } catch (e) {
      if (e.message?.includes('User rejected')) {
        setResult({ success: false, message: 'Signature rejected — you must approve the sign request in your wallet.' });
      } else {
        setResult({ success: false, message: e.message || 'Failed to sign message' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-surface border border-border rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Edit Agent</h2>
            <p className="text-sm text-text-tertiary mt-1">{agent.name} — ID #{agent.agent_id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-raised rounded-lg transition-colors">
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        {/* Wallet connection */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Wallet className="w-5 h-5 text-accent" />
            <span className="text-sm font-medium">Connect the owner wallet to edit</span>
          </div>
          <div className="flex items-center gap-4">
            <WalletMultiButton style={{
              backgroundColor: 'var(--color-accent, #3b82f6)',
              borderRadius: '0.75rem',
              height: '44px',
              fontSize: '14px',
              fontFamily: 'inherit',
            }} />
            {connected && (
              <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                isOwner
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-danger/10 text-danger border border-danger/20'
              }`}>
                {isOwner ? '✓ Owner verified' : '✗ Not the owner wallet'}
              </span>
            )}
          </div>
          {connected && !isOwner && (
            <p className="text-xs text-text-tertiary mt-2">
              Connected: {publicKey?.toBase58().slice(0, 8)}... — Owner: {agent.owner?.slice(0, 8)}...
            </p>
          )}
        </div>

        {/* Form — only enabled if owner */}
        <div className={`space-y-6 ${!isOwner ? 'opacity-40 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-sm font-medium mb-2">Name</label>
            <input type="text" className={inputClass} value={form.name} onChange={e => update('name', e.target.value)} maxLength={64} />
            <p className="text-xs text-text-tertiary mt-1">{form.name.length}/64</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea rows={3} className={`${inputClass} resize-none`} value={form.description} onChange={e => update('description', e.target.value)} maxLength={512} />
            <p className="text-xs text-text-tertiary mt-1">{form.description.length}/512</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Callback URL</label>
            <input type="text" className={inputClass} value={form.callbackUrl} onChange={e => update('callbackUrl', e.target.value)} placeholder="https://your-server.com/agent/fulfill" />
          </div>

          {/* Services */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm">Services</h3>
                <p className="text-xs text-text-tertiary">{form.services.length}/20 services</p>
              </div>
              <button onClick={addService} disabled={form.services.length >= 20} className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors disabled:opacity-30">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <div className="space-y-3">
              {form.services.map((s, i) => (
                <div key={i} className="bg-surface-raised rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-secondary">Service {i + 1}</span>
                    <button onClick={() => removeService(i)} className="text-text-tertiary hover:text-danger transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input type="text" className={inputClass} placeholder="Service name" value={s.name} onChange={e => updateService(i, 'name', e.target.value)} maxLength={64} />
                      <p className="text-xs text-text-tertiary mt-1">{(s.name || '').length}/64</p>
                    </div>
                    <input type="number" step="0.001" min="0" className={inputClass} placeholder="Price (USDC)" value={s.price} onChange={e => updateService(i, 'price', e.target.value)} />
                  </div>
                  <div>
                    <textarea rows={2} className={`${inputClass} resize-none`} placeholder="Service description..." value={s.description} onChange={e => updateService(i, 'description', e.target.value)} maxLength={256} />
                    <p className="text-xs text-text-tertiary mt-1 text-right">{(s.description || '').length}/256</p>
                  </div>
                </div>
              ))}
              {form.services.length === 0 && (
                <p className="text-sm text-text-tertiary text-center py-4">No services. Click "Add" to create one.</p>
              )}
            </div>
          </div>

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-center gap-2 p-4 rounded-xl text-sm ${
                  result.success ? 'bg-success/10 border border-success/20 text-success' : 'bg-danger/10 border border-danger/20 text-danger'
                }`}
              >
                {result.success ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {result.message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || !isOwner}
            className="w-full bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing & saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EditAgent;
