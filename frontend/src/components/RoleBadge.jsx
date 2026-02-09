import React from 'react';
import { Crown, Shield, User } from 'lucide-react';

/**
 * RoleBadge Component
 * Displays a role badge with icon and color coding
 */
export default function RoleBadge({ role, size = 'sm' }) {
    const roleConfig = {
        super_admin: {
            label: 'Super Admin',
            icon: Crown,
            gradient: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
            textColor: 'text-yellow-900',
            iconColor: 'text-yellow-900'
        },
        admin: {
            label: 'Admin',
            icon: Shield,
            gradient: 'bg-gradient-to-r from-blue-400 to-blue-600',
            textColor: 'text-blue-900',
            iconColor: 'text-blue-900'
        },
        user: {
            label: 'User',
            icon: User,
            gradient: 'bg-gradient-to-r from-gray-400 to-gray-600',
            textColor: 'text-gray-900',
            iconColor: 'text-gray-900'
        }
    };

    const config = roleConfig[role] || roleConfig.user;
    const Icon = config.icon;

    const sizeClasses = {
        sm: {
            container: 'px-2 py-1 text-xs',
            icon: 'w-3 h-3'
        },
        md: {
            container: 'px-3 py-1.5 text-sm',
            icon: 'w-4 h-4'
        },
        lg: {
            container: 'px-4 py-2 text-base',
            icon: 'w-5 h-5'
        }
    };

    const sizes = sizeClasses[size];

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full font-semibold ${config.gradient} ${config.textColor} ${sizes.container}`}
        >
            <Icon className={`${sizes.icon} ${config.iconColor}`} />
            {config.label}
        </span>
    );
}
