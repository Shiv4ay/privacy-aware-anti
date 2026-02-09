import React from 'react';

/**
 * AvatarInitials Component
 * Generates a colored circular avatar with user initials as fallback
 * Uses consistent colors based on username hash
 */
export default function AvatarInitials({ user, size = 'md' }) {
    const { username, email } = user;

    // Generate initials from username or email
    const getInitials = () => {
        if (username) {
            const parts = username.split(/[_\s-]/);
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return username.substring(0, 2).toUpperCase();
        }
        if (email) {
            return email.substring(0, 2).toUpperCase();
        }
        return '??';
    };

    // Generate consistent color from string hash
    const stringToColor = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        const hue = hash % 360;
        return `hsl(${hue}, 65%, 55%)`;
    };

    const backgroundColor = stringToColor(username || email || 'default');
    const initials = getInitials();

    // Size mappings
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-16 h-16 text-xl',
        xl: 'w-32 h-32 text-4xl'
    };

    return (
        <div
            className={`rounded-full flex items-center justify-center font-bold text-white select-none ${sizeClasses[size]}`}
            style={{ backgroundColor }}
            title={username || email}
        >
            {initials}
        </div>
    );
}
