import React, { useState, useRef } from 'react';
import { ShieldCheck, Eye, EyeOff, Lock, AlertTriangle, ShieldAlert } from 'lucide-react';
import parse from 'html-react-parser';
const PII_CONFIG = {
    EMAIL: { color: 'from-blue-500/30 to-blue-600/10 border-blue-500/40 text-blue-300', icon: '📧', label: 'Email Address' },
    SSN: { color: 'from-red-500/30 to-red-600/10 border-red-500/40 text-red-300', icon: '🆔', label: 'Social Security Number' },
    PHONE: { color: 'from-purple-500/30 to-purple-600/10 border-purple-500/40 text-purple-300', icon: '📱', label: 'Phone Number' },
    ADDRESS: { color: 'from-orange-500/30 to-orange-600/10 border-orange-500/40 text-orange-300', icon: '📍', label: 'Physical Address' },
    COMPANY: { color: 'from-emerald-500/30 to-emerald-600/10 border-emerald-500/40 text-emerald-300', icon: '🏢', label: 'Corporate Entity' },
    PERSON: { color: 'from-cyan-500/30 to-cyan-600/10 border-cyan-500/40 text-cyan-300', icon: '👤', label: 'Person Name' },
    LOCATION: { color: 'from-amber-500/30 to-amber-600/10 border-amber-500/40 text-amber-300', icon: '📍', label: 'Location' },
    CREDIT_CARD: { color: 'from-rose-500/30 to-rose-600/10 border-rose-500/40 text-rose-300', icon: '💳', label: 'Credit Card' },
    BANK_ACCOUNT: { color: 'from-rose-500/30 to-rose-600/10 border-rose-500/40 text-rose-300', icon: '🏦', label: 'Bank Account' },
    IBAN: { color: 'from-rose-500/30 to-rose-600/10 border-rose-500/40 text-rose-300', icon: '🏦', label: 'IBAN Code' },
    CRYPTO: { color: 'from-yellow-500/30 to-yellow-600/10 border-yellow-500/40 text-yellow-300', icon: '₿', label: 'Crypto Wallet' },
    IP_ADDRESS: { color: 'from-sky-500/30 to-sky-600/10 border-sky-500/40 text-sky-300', icon: '🌐', label: 'IP Address' },
    PASSPORT: { color: 'from-indigo-500/30 to-indigo-600/10 border-indigo-500/40 text-indigo-300', icon: '🛂', label: 'Passport Number' },
    DRIVER_LICENSE: { color: 'from-indigo-500/30 to-indigo-600/10 border-indigo-500/40 text-indigo-300', icon: '🪪', label: 'Driver License' },
    ITIN: { color: 'from-indigo-500/30 to-indigo-600/10 border-indigo-500/40 text-indigo-300', icon: '🆔', label: 'Individual Taxpayer ID' },
    MEDICAL_LICENSE: { color: 'from-teal-500/30 to-teal-600/10 border-teal-500/40 text-teal-300', icon: '⚕️', label: 'Medical License' },
    REDACTED: { color: 'from-gray-500/30 to-gray-600/10 border-gray-500/40 text-gray-300', icon: '🛡️', label: 'Sensitive Data' },
};

/**
 * Explanations for why data is redacted, personalized by role and data type.
 */
function getRedactionRationale(type, role) {
    const normalizedRole = typeof role === 'string' ? role.toLowerCase() : '';
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'super_admin';
    const isSpecialist = normalizedRole === 'faculty' || normalizedRole === 'researcher';

    if (isAdmin) {
        return {
            title: "Data Masked by Default",
            body: `As an administrator, you have clearance to view this ${PII_CONFIG[type]?.label || 'data'}. It is masked by default to prevent shoulder-surfing and accidental exposure during screen sharing.`,
            action: "Click the badge to reveal the actual value."
        };
    }

    if (type === 'SSN') {
        return {
            title: "Critical PII Removed",
            body: "Social Security Numbers are designated as Level 1 Highly Sensitive Data. The RAG system automatically purges this from all LLM context windows to comply with federal regulations.",
            action: "No standard user accounts possess clearance for this data type."
        };
    }

    return {
        title: "Privacy Policy Enforced",
        body: `This ${PII_CONFIG[type]?.label || 'information'} was redacted in-flight before reaching the AI model to comply with the organization's Zero-Trust Data Policy.`,
        action: `Your current role (${role || 'user'}) lacks the required clearance level to view this field.`
    };
}


/**
 * Master pattern — matches PII tokens in order from most to least specific:
 * 1. [TYPE:idx_N]          — Standard Presidio indexed format
 * 2. [TYPE:value]          — Legacy valued format (any text inside brackets)
 * 3. [TYPE_REDACTED]       — Legacy explicit redacted format
 * 4. [REDACTED]            — Generic redacted
 * Also strips post-badge remnants like ]:idx_N] that the LLM sometimes appends.
 */
const PII_PATTERN = /\[([A-Z_]+):idx_(\d+)\]|\[([A-Z_]+):[^\]]+\]|\[([A-Z_]+)_REDACTED\]|\[REDACTED\]/g;

function parsePIIToken(token) {
    // New indexed format: [PERSON:idx_0]
    const indexed = token.match(/^\[([A-Z_]+):idx_(\d+)\]$/);
    if (indexed) return { type: indexed[1], index: parseInt(indexed[2]), fullToken: token, value: null };

    // Legacy valued format: [EMAIL:actual@email.com]
    const valued = token.match(/^\[([A-Z_]+):([^\]]+)\]$/);
    if (valued) return { type: valued[1], index: null, fullToken: token, value: valued[2] };

    // Legacy type_REDACTED format
    const legacy = token.match(/^\[([A-Z_]+)_REDACTED\]$/);
    if (legacy) return { type: legacy[1], index: null, fullToken: token, value: null };

    if (token === '[REDACTED]') return { type: 'REDACTED', index: null, fullToken: token, value: null };

    return { type: 'REDACTED', index: null, fullToken: token, value: null };
}

/**
 * Rich Tooltip Component
 */
function ExplainerTooltip({ type, role, isVisible }) {
    if (!isVisible) return null;

    const normalizedRole = typeof role === 'string' ? role.toLowerCase() : '';
    const rationale = getRedactionRationale(type, normalizedRole);
    const cfg = PII_CONFIG[type] || PII_CONFIG.REDACTED;
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'super_admin';

    return (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 animate-fade-in pointer-events-none">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
                {/* Tooltip Header */}
                <div className={`px-4 py-2 border-b border-white/5 flex items-center gap-2 bg-gradient-to-r ${cfg.color.replace('text-', 'from-').replace(/from-[a-z]+-\d+\/\d+/, '')} opacity-90`}>
                    {isAdmin ? <ShieldCheck className="w-4 h-4 text-white" /> : <ShieldAlert className="w-4 h-4 text-white" />}
                    <span className="text-xs font-bold text-white uppercase tracking-wider">{rationale.title}</span>
                </div>

                {/* Tooltip Body */}
                <div className="p-4 space-y-3">
                    <p className="text-xs text-gray-300 leading-relaxed">
                        <span className="mr-1.5">{cfg.icon}</span>
                        {rationale.body}
                    </p>
                    <div className="flex items-start gap-2 pt-3 border-t border-white/5">
                        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isAdmin ? 'text-blue-400' : 'text-amber-400'}`} />
                        <p className={`text-[10px] font-semibold ${isAdmin ? 'text-blue-400' : 'text-amber-400/90'}`}>
                            {rationale.action}
                        </p>
                    </div>
                </div>
            </div>
            {/* Arrow */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1a1a1a] border-b border-r border-white/10 rotate-45" />
        </div>
    );
}


/**
 * Single blurred PII badge with Hover Tooltip and Click-to-Reveal.
 * 
 * Props:
 * - token: the raw PII token string, e.g. "[PERSON:idx_0]"
 * - userRole: the current user's role string
 * - piiMap: optional object mapping tokens to original values (only provided for admin/super_admin)
 */
function PIIBadge({ token, userRole, piiMap }) {
    const [revealed, setRevealed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const hoverTimeout = useRef(null);

    const { type, index, fullToken } = parsePIIToken(token);
    const cfg = PII_CONFIG[type] || PII_CONFIG.REDACTED;

    const normalizedRole = typeof userRole === 'string' ? userRole.toLowerCase() : '';
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'super_admin';

    // ── Smart piiMap lookup ──────────────────────────────────────────────────
    // Try multiple strategies to find the real value:
    // 1. Exact token key match: piiMap["[PERSON:idx_0]"]
    // 2. Reconstructed key if index available
    // 3. Any value for the same type when index differs
    let originalValue = null;
    if (piiMap && typeof piiMap === 'object') {
        // Strategy 1: exact key
        originalValue = piiMap[fullToken] ?? null;
        // Strategy 2: try building key from parsed type+index (handles minor format diffs)
        if (!originalValue && index !== null) {
            const reconstructed = `[${type}:idx_${index}]`;
            originalValue = piiMap[reconstructed] ?? null;
        }
        // Strategy 3: first value for the same type
        if (!originalValue) {
            const typePrefix = `[${type}:idx_`;
            for (const [k, v] of Object.entries(piiMap)) {
                if (k.startsWith(typePrefix)) {
                    originalValue = v;
                    break;
                }
            }
        }
    }

    // Admin can always click — either to see the real value (if piiMap has it) or at
    // minimum to "unlock" the blur and see the type label.
    const canReveal = isAdmin;

    const displayLabel = revealed && originalValue ? originalValue : cfg.label;

    const handleMouseEnter = () => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        hoverTimeout.current = setTimeout(() => { setIsHovered(false); }, 150);
    };

    const handleClick = () => {
        if (!canReveal) return;
        setRevealed(r => !r);
        setIsHovered(false);
    };

    return (
        <span className="relative inline-block mx-0.5 my-0.5" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <ExplainerTooltip type={type} role={userRole} isVisible={isHovered && !revealed} />

            <span
                onClick={canReveal ? handleClick : undefined}
                className={[
                    'inline-flex items-center gap-1.5',
                    'px-2.5 py-0.5 rounded-md border backdrop-blur-sm',
                    `bg-gradient-to-r ${cfg.color}`,
                    'text-[11px] font-semibold tracking-wide',
                    'shadow-[0_0_8px_rgba(0,0,0,0.4)]',
                    'transition-all duration-300',
                    canReveal
                        ? 'cursor-pointer select-none hover:shadow-[0_0_12px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-95'
                        : 'cursor-not-allowed select-none opacity-80',
                ].join(' ')}
            >
                {/* Icon: ShieldCheck (green) for admins who can reveal, Lock for others */}
                {canReveal
                    ? revealed
                        ? <EyeOff className="w-3 h-3 flex-shrink-0 text-green-400" />
                        : <ShieldCheck className="w-3 h-3 flex-shrink-0 text-green-400" />
                    : <Lock className="w-3 h-3 flex-shrink-0" />
                }

                <span style={{
                    filter: revealed ? 'none' : 'blur(4px)',
                    WebkitFilter: revealed ? 'none' : 'blur(4px)',
                    transition: 'filter 0.3s ease'
                }}>
                    {displayLabel}
                </span>

                {canReveal && !revealed && (
                    <Eye className="w-3 h-3 flex-shrink-0 opacity-70 ml-0.5 text-green-400" />
                )}
            </span>
        </span>
    );
}

/**
 * Drop-in replacement for any text that may contain PII tokens.
 * 
 * Props:
 * - text: the message text potentially containing [TYPE:idx_N] tokens
 * - userRole: the current user's role
 * - piiMap: optional object mapping tokens to original values (admin/super_admin only)
 */
export default function PIIText({ text, userRole, piiMap, className = '' }) {
    if (!text) return null;

    const options = {
        replace: (domNode) => {
            if (domNode.type === 'text' && domNode.data) {
                const parts = [];
                let last = 0;
                // Important: re-instantiate RegExp inside loop to avoid state leak
                const re = new RegExp(PII_PATTERN.source, 'g');

                // If no tokens in this text node, let it parse normally
                if (!re.test(domNode.data)) return;

                re.lastIndex = 0; // reset
                let match;

                while ((match = re.exec(domNode.data)) !== null) {
                    if (match.index > last) {
                        parts.push({ plain: domNode.data.slice(last, match.index) });
                    }
                    parts.push({ token: match[0] });
                    last = re.lastIndex;
                }
                if (last < domNode.data.length) parts.push({ plain: domNode.data.slice(last) });

                // Clean up stray brackets around tokens
                for (let i = 0; i < parts.length; i++) {
                    if (parts[i].token) {
                        if (i > 0 && parts[i - 1].plain) {
                            parts[i - 1].plain = parts[i - 1].plain.replace(/\[+\s*$/, '');
                        }
                        if (i < parts.length - 1 && parts[i + 1].plain) {
                            parts[i + 1].plain = parts[i + 1].plain.replace(/^\s*\]+/, '');
                        }
                    }
                }

                if (parts.length === 1 && parts[0].plain) return;

                return (
                    <React.Fragment>
                        {parts.map((p, i) =>
                            p.token ? (
                                <PIIBadge key={i} token={p.token} userRole={userRole} piiMap={piiMap} />
                            ) : (
                                <React.Fragment key={i}>{p.plain}</React.Fragment>
                            )
                        )}
                    </React.Fragment>
                );
            }
        }
    };

    return (
        <div className={`chat-html ${className}`}>
            {parse(text, options)}
        </div>
    );
}
