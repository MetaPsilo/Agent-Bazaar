import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, ArrowRight, Star, Zap, DollarSign } from 'lucide-react';

const ActivityFeed = ({ activities = [] }) => {
  const getActivityIcon = (type) => {
    switch (type) {
      case 'registration':
        return UserPlus;
      case 'payment':
        return ArrowRight;
      case 'feedback':
        return Star;
      default:
        return Zap;
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'registration':
        return 'text-cyber-green';
      case 'payment':
        return 'text-cyber-blue';
      case 'feedback':
        return 'text-cyber-purple';
      default:
        return 'text-white';
    }
  };

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatActivity = (activity) => {
    switch (activity.type) {
      case 'registration':
        return {
          title: 'Agent Registration',
          description: `${activity.agent} joined the network`,
          subtitle: 'New agent available for services',
        };
      case 'payment':
        return {
          title: 'Service Payment',
          description: `${activity.from} → ${activity.to}`,
          subtitle: `$${activity.amount} USDC`,
        };
      case 'feedback':
        return {
          title: 'Feedback Submitted',
          description: `${activity.agent} rated ${activity.rating}/5`,
          subtitle: 'Reputation updated',
        };
      default:
        return {
          title: 'Network Activity',
          description: activity.agent || 'Unknown',
          subtitle: 'System event',
        };
    }
  };

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
      <AnimatePresence>
        {activities.map((activity) => {
          const Icon = getActivityIcon(activity.type);
          const colorClass = getActivityColor(activity.type);
          const formatted = formatActivity(activity);

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              className="glass p-3 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-start space-x-3">
                {/* Icon */}
                <div className={`flex-shrink-0 p-2 rounded-lg bg-gradient-to-br from-current/10 to-current/5 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-white">{formatted.title}</h4>
                    <span className="text-xs font-mono text-white/50">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-white/80 mb-1">
                    {formatted.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono ${colorClass}`}>
                      {formatted.subtitle}
                    </span>
                    
                    {/* Transaction indicator for payments */}
                    {activity.type === 'payment' && (
                      <motion.div
                        className="flex items-center space-x-1 text-xs font-mono text-cyber-green"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        <DollarSign className="w-3 h-3" />
                        <span>TX</span>
                      </motion.div>
                    )}
                    
                    {/* Star rating for feedback */}
                    {activity.type === 'feedback' && (
                      <div className="flex space-x-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < activity.rating 
                                ? 'text-yellow-400 fill-current' 
                                : 'text-white/20'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Activity pulse indicator — removed, parent not positioned */}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {activities.length === 0 && (
        <motion.div
          className="text-center py-8 text-white/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="font-mono text-sm">Waiting for network activity...</p>
        </motion.div>
      )}

      {/* Data stream effect at the bottom */}
      <motion.div
        className="h-1 rounded-full data-stream opacity-30"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
};

export default ActivityFeed;