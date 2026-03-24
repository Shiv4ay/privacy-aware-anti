import React, { useEffect, useState, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SystemPulseChart = ({ color = "#fbbf24", dataPoint = 0 }) => {
    const [data, setData] = useState([]);
    const frameRef = useRef(0);

    // Initialize with 30 points of zeros
    useEffect(() => {
        const initialData = Array.from({ length: 30 }, (_, i) => ({
            time: i,
            value: 0
        }));
        setData(initialData);
    }, []);

    // Update with incoming real-time signal
    useEffect(() => {
        if (frameRef.current % 2 === 0) { // Slight throttle for smooth rendering
            setData(prev => {
                const newData = [...prev.slice(1), { 
                    time: Date.now(), 
                    value: dataPoint + (Math.random() * 0.5) // Add slight jitter for "alive" feel
                }];
                return newData;
            });
        }
        frameRef.current++;
    }, [dataPoint]);

    return (
        <div className="w-full h-32 relative group">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={[0, 'dataMax + 5']} />
                    <Tooltip 
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-black/80 border border-white/10 backdrop-blur-md p-2 rounded-lg shadow-xl">
                                        <p className="text-[10px] font-black text-white uppercase tracking-widest">
                                            Signal Intensity: {payload[0].value.toFixed(1)}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={color} 
                        fillOpacity={1} 
                        fill="url(#colorPulse)" 
                        strokeWidth={2}
                        isAnimationActive={false} // Disabled for real-time smoothness
                    />
                </AreaChart>
            </ResponsiveContainer>
            
            {/* Legend Overlay */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">Real-time Telemetry</span>
            </div>
        </div>
    );
};

export default SystemPulseChart;
