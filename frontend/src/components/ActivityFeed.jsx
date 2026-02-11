import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, ArrowRight, Star, Zap } from 'lucide-react';

const ActivityFeed = ({ activities = [] }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'registration': return UserPlus;
      case 'payment': return ArrowRight;
      case 'feedback': return Star;
      default: return Zap;
    }
  };

  const formatTime = (ts) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
  };

  const formatActivity = (a) => {
    switch (a.type) {
      case 'registration': return { text: `${a.agent} joined`, detail: 'New agent' };
      case 'payment': return { text: `${a.from} → ${a.to}`, detail: `$${a.amount} USDC` };
      case 'feedback': return { text: `${a.agent} rated ${a.rating}/5`, detail: 'Review' };
      default: return { text: a.agent || 'Event', detail: 'System' };
    }
  };

  return (
    <div className="space-y-1 max-h-80 overflow-y-auto">
      <AnimatePresence>
        {activities.map((activity) => {
          const Icon = getIcon(activity.type);
          const fmt = formatActivity(activity);
          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-raised/50 transition-colors"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-text-tertiary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{fmt.text}</p>
                <p className="text-xs text-text-tertiary">{fmt.detail}</p>
              </div>
              <span className="text-xs text-text-tertiary font-mono flex-shrink-0">
                {formatTime(activity.timestamp)}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {activities.length === 0 && (
        <div className="text-center py-12 text-text-tertiary">
          <p className="text-sm">Waiting for activity...</p>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
