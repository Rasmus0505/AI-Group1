import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
    children: React.ReactNode;
    title?: React.ReactNode;
    extra?: React.ReactNode;
    className?: string;
    delay?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    children,
    title,
    extra,
    className = '',
    delay = 0
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            className={`glass-panel p-4 mb-4 ${className}`}
            style={{ overflow: 'hidden' }}
        >
            {(title || extra) && (
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                    {title && <h3 className="text-lg font-bold tech-gradient-text m-0">{title}</h3>}
                    {extra && <div className="text-sm text-slate-400">{extra}</div>}
                </div>
            )}
            <div className="relative">
                {children}
            </div>
        </motion.div>
    );
};

export default GlassCard;
