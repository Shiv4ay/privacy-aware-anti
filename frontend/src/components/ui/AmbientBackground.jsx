import React from 'react';
import { motion } from 'framer-motion';

export default function AmbientBackground() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Top Left Gold Orb */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    x: [0, 100, 0],
                    y: [0, 50, 0],
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[#FFD86B] rounded-full mix-blend-screen filter blur-[150px] opacity-[0.08]"
            />
            {/* Center Right Blue Orb */}
            <motion.div
                animate={{
                    scale: [1, 1.5, 1],
                    x: [0, -100, 0],
                    y: [0, -50, 0],
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] bg-blue-500 rounded-full mix-blend-screen filter blur-[150px] opacity-[0.05]"
            />
            {/* Bottom Left Purple Orb */}
            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    x: [0, 50, 0],
                    y: [0, 100, 0],
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-[20%] left-[20%] w-[40%] h-[40%] bg-purple-500 rounded-full mix-blend-screen filter blur-[120px] opacity-[0.05]"
            />
        </div>
    );
}
