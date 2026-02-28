import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Lock } from 'lucide-react';

// ── Style config per PII type ──────────────────────────────────────────────
const PII_CONFIG = {
    EMAIL: { color: 'from-blue-500/30 to-blue-600/10 border-blue-500/40 text-blue-300' },
    SSN: { color: 'from-red-500/30 to-red-600/10 border-red-500/40 text-red-300' },
    PHONE: { color: 'from-purple-500/30 to-purple-600/10 border-purple-500/40 text-purple-300' },
    ADDRESS: { color: 'from-orange-500/30 to-orange-600/10 border-orange-500/40 text-orange-300' },
    COMPANY: { color: 'from-emerald-500/30 to-emerald-600/10 border-emerald-500/40 text-emerald-300' },
    REDACTED: { color: 'from-gray-500/30 to-gray-600/10 border-gray-500/40 text-gray-300' },
};

/**
 * Master pattern — order matters (most specific first):
 *  1. [TYPE:actual_value]   — new value-preserving format
 *  2. [TYPE_REDACTED]       — legacy backend token (e.g. [PHONE_REDACTED])
 *  3. [REDACTED_TYPE]       — reversed format  (e.g. [REDACTED_PHONE])
 *  4. [REDACTED]            — LLM self-redaction label
 */
const PII_PATTERN = /\[(?:EMAIL|SSN|PHONE|ADDRESS|COMPANY):[^\]]+\]|\[(?:EMAIL|SSN|PHONE|ADDRESS|COMPANY)_REDACTED\]|\[REDACTED_(?:EMAIL|SSN|PHONE|ADDRESS|COMPANY)\]|\[REDACTED\]/g;

function parsePIIToken(token) {
    // [TYPE:actual_value]
    const valued = token.match(/^\[([A-Z]+):([^\]]+)\]$/);
    if (valued) return { type: valued[1], value: valued[2] };

    // [TYPE_REDACTED]
    const legacy = token.match(/^\[([A-Z]+)_REDACTED\]$/);
    if (legacy) return { type: legacy[1], value: null };

    // [REDACTED_TYPE]  — reversed format from LLM/backend
    const reversed = token.match(/^\[REDACTED_([A-Z]+)\]$/);
    if (reversed) return { type: reversed[1], value: null };

    // [REDACTED]  — LLM wrote this; we don't know the type
    if (token === '[REDACTED]') return { type: 'REDACTED', value: null };

    return { type: 'REDACTED', value: null };
}


/**
 * Single blurred PII badge.
 * - admin / super_admin: clickable to reveal actual value.
 * - other roles: permanently blurred + locked icon.
 */
function PIIBadge({ token, canReveal }) {
    const [revealed, setRevealed] = useState(false);
    const { type, value } = parsePIIToken(token);
    const cfg = PII_CONFIG[type] || PII_CONFIG.REDACTED;
    const label = value ?? type;          // Show real value if available

    return (
        <span
            onClick={canReveal ? () => setRevealed(r => !r) : undefined}
            title={
                canReveal
                    ? (revealed ? 'Click to re-blur' : 'Click to reveal')
                    : 'Access restricted — insufficient clearance'
            }
            className={[
                'inline-flex items-center gap-1 mx-0.5 my-0.5',
                'px-2 py-0.5 rounded-md border backdrop-blur-sm',
                `bg-gradient-to-r ${cfg.color}`,
                'text-[11px] font-semibold tracking-wide',
                'shadow-[0_0_8px_rgba(0,0,0,0.4)]',
                'transition-all duration-300',
                canReveal ? 'cursor-pointer select-none' : 'cursor-not-allowed select-none',
            ].join(' ')}
            style={{
                filter: revealed ? 'none' : 'blur(4px)',
                WebkitFilter: revealed ? 'none' : 'blur(4px)',
            }}
        >
            {canReveal
                ? <ShieldCheck className="w-2.5 h-2.5 flex-shrink-0" />
                : <Lock className="w-2.5 h-2.5 flex-shrink-0" />
            }
            <span>{label}</span>
            {canReveal && (
                revealed
                    ? <EyeOff className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />
                    : <Eye className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />
            )}
        </span>
    );
}

/**
 * Drop-in replacement for any text that may contain PII tokens.
 * Usage: <PIIText text={aiResponse} userRole={user.role} />
 */
export default function PIIText({ text, userRole, className = '' }) {
    if (!text) return null;

    const canReveal = userRole === 'admin' || userRole === 'super_admin';

    // Build parts list by scanning for PII tokens
    const parts = [];
    let last = 0;
    const re = new RegExp(PII_PATTERN.source, 'g');
    let match;

    while ((match = re.exec(text)) !== null) {
        if (match.index > last) {
            parts.push({ plain: text.slice(last, match.index) });
        }
        parts.push({ token: match[0] });
        last = re.lastIndex;
    }
    if (last < text.length) parts.push({ plain: text.slice(last) });

    // ── Cleanup stray [ ] brackets that surround PII tokens ─────────────────
    // e.g. LLM writes [john@example.com] → backend produces [[EMAIL:john@...]]
    // → frontend sees plain "[" + badge + "]" → strip those lone bracket chars
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].token) {
            // Strip trailing [ from preceding plain part
            if (i > 0 && parts[i - 1].plain) {
                parts[i - 1].plain = parts[i - 1].plain.replace(/\[+\s*$/, '');
            }
            // Strip leading ] (with optional space) from following plain part
            if (i < parts.length - 1 && parts[i + 1].plain) {
                parts[i + 1].plain = parts[i + 1].plain.replace(/^\s*\]+/, '');
            }
        }
    }

    return (
        <span className={className}>
            {parts.map((part, i) =>
                part.token
                    ? <PIIBadge key={i} token={part.token} canReveal={canReveal} />
                    : <React.Fragment key={i}>{part.plain}</React.Fragment>
            )}
        </span>
    );
}
