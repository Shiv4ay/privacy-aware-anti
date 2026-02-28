import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import {
  Send, Bot, Loader2, Sparkles, AlertCircle,
  Copy, RefreshCw, Check, Shield, ChevronDown,
  GraduationCap, BookOpen, Users, BarChart2, Cpu,
  Plus, Mic, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import PIIText from '../components/ui/PIIText';

// ── Suggestion chips ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: GraduationCap, label: 'Student GPAs', prompt: 'What are the GPAs of top performing students?' },
  { icon: BookOpen, label: 'Courses List', prompt: 'List all available courses and their departments.' },
  { icon: Users, label: 'Faculty Info', prompt: 'Give me details about the faculty members.' },
  { icon: BarChart2, label: 'Placement Stats', prompt: 'What are the campus placement statistics?' },
  { icon: Cpu, label: 'AI Privacy Demo', prompt: 'How does PII redaction work in this system?' },
];

// ── Copy button with transient check mark ───────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/10 transition-all"
      title="Copy message">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Typing indicator ────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      {/* AI avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-premium-gold to-yellow-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-premium-gold/20">
        <Cpu className="w-4 h-4 text-black" />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white/[0.06] border border-white/[0.08] flex items-center gap-3">
          <div className="flex gap-1 items-center">
            <span className="w-2 h-2 rounded-full bg-premium-gold animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-premium-gold animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-premium-gold animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-gray-400 italic">PrivacyRAG is analyzing…</span>
        </div>
      </div>
    </div>
  );
}

// ── Single message bubble ────────────────────────────────────────────────────
function MessageBubble({ msg, user, onRegenerate }) {
  const isUser = msg.from === 'user';
  const isError = msg.from === 'error';
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // User avatar — initials from name, or profile image if available
  const userInitial = (user?.name || user?.email || 'U')[0].toUpperCase();
  const userAvatar = user?.picture || user?.avatar_url || null;

  return (
    <div className={`group flex items-end gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

      {/* Avatar */}
      {isUser ? (
        <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden border-2 border-blue-500/40 shadow-lg">
          {userAvatar ? (
            <img src={userAvatar} alt="You" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white text-xs font-black">{userInitial}</span>
            </div>
          )}
        </div>
      ) : (
        <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center shadow-lg ${isError ? 'bg-red-500/20 border border-red-500/30' : 'bg-gradient-to-br from-premium-gold to-yellow-600 shadow-premium-gold/20'
          }`}>
          {isError ? <AlertCircle className="w-4 h-4 text-red-400" /> : <Cpu className="w-4 h-4 text-black" />}
        </div>
      )}

      {/* Bubble */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[78%] gap-1`}>
        {/* Name tag */}
        <span className="text-[10px] font-bold uppercase tracking-widest px-1 text-gray-600">
          {isUser ? (user?.name || user?.email?.split('@')[0] || 'You') : isError ? 'System' : 'PrivacyRAG AI'}
        </span>

        {/* Message content */}
        <div className={`relative rounded-2xl px-4 py-3 shadow-lg ${isUser
          ? 'bg-gradient-to-br from-blue-600/30 to-indigo-600/20 border border-blue-500/25 rounded-br-sm text-white'
          : isError
            ? 'bg-red-500/10 border border-red-500/20 rounded-bl-sm text-red-300'
            : 'bg-white/[0.06] border border-white/[0.08] rounded-bl-sm text-gray-100'
          }`}>
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {msg.from === 'ai'
              ? <PIIText text={msg.text} userRole={user?.role} />
              : msg.text
            }
          </div>

          {/* Context / PII badge */}
          {msg.contextUsed && !isUser && (
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-premium-gold" />
              <span className="text-[10px] text-premium-gold font-semibold">RAG Context Applied</span>
              <span className="ml-auto flex gap-1">
                <Shield className="w-3 h-3 text-green-400" />
                <span className="text-[10px] text-green-400">PII Protected</span>
              </span>
            </div>
          )}

          {/* Timestamp */}
          <div className={`text-[10px] mt-1.5 opacity-40 ${isUser ? 'text-right' : 'text-left'}`}>{time}</div>
        </div>

        {/* Hover actions */}
        <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isUser ? 'flex-row-reverse' : ''}`}>
          <CopyButton text={msg.text} />
          {!isUser && !isError && onRegenerate && (
            <button onClick={() => onRegenerate(msg.id)}
              className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/10 transition-all"
              title="Regenerate response">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Chat component ──────────────────────────────────────────────────────
export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const location = useLocation();

  const scrollToBottom = useCallback((force = false) => {
    if (force || atBottom)
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [atBottom]);

  useEffect(() => { scrollToBottom(true); }, [messages]);

  // Detect scroll position
  const handleScroll = () => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setAtBottom(near);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  }, [message]);

  // Pre-fill from navigation state
  useEffect(() => {
    if (location.state?.context)
      setMessage(`Tell me about ${location.state.context}...`);
  }, [location.state]);

  const sendMessage = useCallback(async (overrideText) => {
    const text = (overrideText || message).trim();
    if (!text || loading) return;

    const userMsg = { id: Date.now(), text, from: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideText) setMessage('');
    setLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      const res = await client.post('/chat', {
        query: text,
        conversation_history: history
      });

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: res.data?.response || res.data?.message || 'No response received.',
        from: 'ai',
        timestamp: new Date(),
        contextUsed: res.data?.context_used || false
      }]);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Connection error';
      toast.error(`Error: ${msg}`);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: `Sorry, I encountered an error: ${msg}. Please try again.`,
        from: 'error',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  }, [message, messages, loading]);

  // Regenerate: re-send the user message that prompted a given AI reply
  const handleRegenerate = useCallback((aiMsgId) => {
    const idx = messages.findIndex(m => m.id === aiMsgId);
    if (idx < 1) return;
    const prevUser = messages[idx - 1];
    if (prevUser?.from === 'user') {
      setMessages(prev => prev.slice(0, idx)); // remove AI reply
      sendMessage(prevUser.text);
    }
  }, [messages, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Speech Recognition ────────────────────────────────────────────────────
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Your browser does not support voice input.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setMessage(transcript);
    };

    recognition.onerror = (event) => {
      console.error(event.error);
      setIsListening(false);
      toast.error("Microphone error. Please try again.");
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  // ── File Upload Dummy Handler (Visual Only) ───────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      toast.success(`Selected file: ${file.name}`);
      // In a real app, you would upload this file to the backend or context here
    }
    // reset
    e.target.value = null;
  };

  if (!user) return (
    <div className="min-h-screen animated-gradient-bg flex items-center justify-center p-4">
      <div className="glass-panel-strong p-8 rounded-2xl max-w-md text-center">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
        <p className="text-gray-400">Please log in to use the chat feature.</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-black/20 relative overflow-hidden rounded-2xl border border-white/5">

      {/* ── 1. Header ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/[0.08] bg-black/30 backdrop-blur-md z-20">
        <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-3">
            {/* AI logo circle */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-premium-gold to-yellow-600 flex items-center justify-center shadow-lg shadow-premium-gold/30">
                <Cpu className="w-5 h-5 text-black" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-black shadow-[0_0_6px_#4ade80]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">PrivacyRAG Assistant</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[11px] text-green-400 font-semibold">Online · RAG + PII Protection Active</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-premium-gold/10 border border-premium-gold/20 text-[11px] text-premium-gold font-bold">
              <Shield className="w-3 h-3" /> Privacy Enforced
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Messages area ───────────────────────────────────── */}
      <div
        ref={messagesAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 custom-scrollbar scroll-smooth"
      >
        <div className="max-w-4xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-6 animate-fade-in">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-premium-gold/20 to-premium-gold/5 border border-premium-gold/20 flex items-center justify-center">
                  <Cpu className="w-10 h-10 text-premium-gold" />
                </div>
                <div className="absolute inset-0 rounded-full bg-premium-gold/10 animate-ping opacity-30" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-1">How can I help you today?</h2>
                <p className="text-sm text-gray-500">Ask anything about your university data. All queries are privacy-protected.</p>
              </div>

              {/* Suggestion chips */}
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
                  <button
                    key={label}
                    onClick={() => sendMessage(prompt)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] hover:border-premium-gold/30 transition-all text-sm text-gray-300 hover:text-white group"
                  >
                    <Icon className="w-3.5 h-3.5 text-premium-gold group-hover:scale-110 transition-transform" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              user={user}
              onRegenerate={handleRegenerate}
            />
          ))}

          {/* Typing indicator */}
          {loading && <TypingIndicator />}

          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {/* Scroll-to-bottom button */}
      {!atBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-24 right-6 z-30 p-2 rounded-full bg-premium-gold text-black shadow-lg shadow-premium-gold/30 hover:bg-yellow-400 transition-all animate-bounce"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {/* ── 3. Input bar — ChatGPT style ─────────────── */}
      <div className="flex-shrink-0 bg-gradient-to-t from-black/60 to-transparent backdrop-blur-xl z-30 px-4 pb-5 pt-3">
        <div className="max-w-4xl mx-auto w-full">
          {/* Floating pill */}
          <div className="flex items-end gap-3 bg-[#2f2f2f] rounded-[2rem] px-4 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.6)]">

            {/* Left side Plus icon -> Triggers File Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-white transition-colors mb-0.5"
              title="Attach file"
            >
              <Plus className="w-5 h-5" strokeWidth={2} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.txt,.csv,.doc,.docx"
            />

            {/* Textarea — no scrollbar, no native resize, no focus ring */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : "Ask anything"}
              rows={1}
              className="flex-1 bg-transparent text-gray-200 placeholder-gray-400 resize-none text-base leading-relaxed py-1"
              style={{
                minHeight: '26px',
                maxHeight: '160px',
                overflowY: 'auto',
                outline: 'none',
                boxShadow: 'none',
                border: 'none',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitAppearance: 'none'
              }}
            />

            {/* Right side stuff */}
            <div className="flex items-center gap-1 self-end min-h-[32px] mb-0.5">
              {message.trim() ? (
                <button
                  onClick={() => sendMessage()}
                  disabled={loading}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                >
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin text-black" />
                    : <Send className="w-4 h-4 -ml-0.5" />
                  }
                </button>
              ) : (
                <>
                  <button
                    onClick={toggleListening}
                    title="Voice Input"
                    className={`p-1.5 transition-colors rounded-full ${isListening
                        ? 'text-red-500 bg-red-500/10 animate-pulse'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <button className="h-8 w-8 bg-black/40 rounded-full text-gray-400 hover:text-white transition-colors flex items-center justify-center ml-1">
                    <Activity className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="text-center text-[11px] text-gray-500 mt-3 font-medium">
            PrivacyRAG can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>
  );
}

