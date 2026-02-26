import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Database, BarChart } from 'lucide-react';
import AmbientBackground from '../components/ui/AmbientBackground';
import AnimatedCard from '../components/ui/AnimatedCard';
import { motion } from 'framer-motion';
import { staggeredContainerVariants, staggeredItemVariants } from '../components/ui/StaggeredList';

export default function DataDashboard() {
    const { user } = useAuth();

    return (
        <>
            <AmbientBackground />
            <div className="space-y-8 relative z-10 w-full overflow-hidden p-6 animate-fade-in">
                <motion.div
                    className="max-w-7xl mx-auto space-y-8"
                    variants={staggeredContainerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.div variants={staggeredItemVariants} className="mb-6">
                        <h1 className="text-3xl font-bold text-white mb-1">Data Steward Dashboard</h1>
                        <p className="text-gray-400">Data Governance and Quality Control</p>
                    </motion.div>

                    <motion.div variants={staggeredItemVariants}>
                        <AnimatedCard className="glass-panel p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Database className="w-6 h-6 text-blue-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-white">Data Governance</h2>
                            </div>
                            <div className="text-gray-400 text-center py-12">
                                Data stewardship features coming soon...
                            </div>
                        </AnimatedCard>
                    </motion.div>
                </motion.div>
            </div>
        </>
    );
}
