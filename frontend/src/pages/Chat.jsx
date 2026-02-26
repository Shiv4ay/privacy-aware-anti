import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import { Send, Bot, User, Loader2, MessageSquare, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import PIIText from '../components/ui/PIIText';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [message]);

  // Context Awareness
  const location = useLocation();
  useEffect(() => {
    if (location.state?.context) {
      setMessage(`Tell me about ${location.state.context}...`);
      // Optional: Clean up state so refresh doesn't keep it? 
      // Actually keeping it is fine for now so user remembers context.
      // But clearing it from history replace is better UX usually, strictly simple requirement for now.
    }
  }, [location.state]);

  const send = async () => {
    if (!message.trim() || loading) return;

    const userMessage = { id: Date.now(), text: message, from: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    const currentMessage = message;
    setMessage('');
    setLoading(true);

    try {
      // Build conversation history from last 5 messages for continuity
      const conversationHistory = messages.slice(-5).map(m => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      // Call chat API with conversation history
      const res = await client.post('/chat', {
        query: currentMessage,
        conversation_history: conversationHistory
      });

      const aiMessage = {
        id: Date.now() + 1,
        text: res.data?.response || res.data?.message || 'No response received',
        from: 'ai',
        timestamp: new Date(),
        contextUsed: res.data?.context_used || false
      };

      setMessages(prev => [...prev, aiMessage]);
      toast.success('Response received!');
    } catch (err) {
      console.error('Chat error', err);

      const errorMsg = err?.response?.data?.message ||
        err?.response?.data?.error ||
        err.message ||
        'Failed to get response';

      toast.error(`Error: ${errorMsg}`);

      const errorMessage = {
        id: Date.now() + 1,
        text: `Sorry, I encountered an error: ${errorMsg}. Please try again.`,
        from: 'error',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen animated-gradient-bg flex items-center justify-center p-4">
        <div className="glass-panel-strong p-8 rounded-2xl max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-gray-400">Please log in to use the chat feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-black/20 relative overflow-hidden rounded-2xl border border-white/5">
      {/* 1. Header - Fixed Top */}
      <div className="flex-shrink-0 p-4 border-b border-white/10 bg-black/20 backdrop-blur-md z-20">
        <div className="flex items-center justify-center flex-col">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-premium-gold" />
            AI Chat Assistant
          </h1>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
            <Sparkles className="w-3 h-3 text-premium-gold" />
            Context-aware RAG
          </p>
        </div>
      </div>

      {/* 2. Messages Area - Flexible Middle (Scrolls) */}
      <div className="flex-1 overflow-y-auto min-h-0 relative custom-scrollbar p-4 scroll-smooth">
        <div className={`min-h-full flex flex-col ${messages.length === 0 ? 'justify-center' : 'justify-end'} space-y-4 max-w-4xl mx-auto w-full`}>

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 opacity-80">
              <div className="w-16 h-16 rounded-full bg-premium-gold/10 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-premium-gold animate-pulse" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">How can I help?</h2>
              <div className="flex gap-2 flex-wrap justify-center mt-4">
                <button onClick={() => setMessage("Student GPAs?")} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors border border-white/10">💯 GPAs</button>
                <button onClick={() => setMessage("Courses list?")} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 transition-colors border border-white/10">📚 Courses</button>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.from === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-lg ${m.from === 'user' ? 'bg-blue-600 text-white' : 'bg-premium-gold text-black'
                }`}>
                {m.from === 'user' ? 'U' : 'AI'}
              </div>
              <div className={`max-w-[85%] rounded-2xl p-3 shadow-md ${m.from === 'user'
                ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100'
                : 'bg-white/10 border border-white/10 text-gray-100'
                }`}>
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {m.from === 'ai' ? <PIIText text={m.text} userRole={user?.role} /> : m.text}
                </div>
                {m.contextUsed && m.from === 'ai' && (
                  <div className="mt-1 pt-1 border-t border-white/10 text-[10px] text-premium-gold opacity-80 flex items-center gap-1">
                    <Sparkles className="w-2 h-2" /> Context Used
                  </div>
                )}
                <div className="text-[10px] mt-1 opacity-40 text-right">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex flex-col gap-3 animate-fade-in opacity-80">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-premium-gold flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Bot className="w-4 h-4 text-black" />
                </div>
                <div className="bg-white/10 rounded-2xl p-3 border border-white/10 relative overflow-hidden">
                  <div className="flex gap-1 h-4 items-center">
                    <div className="w-1.5 h-1.5 bg-premium-gold rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-premium-gold rounded-full animate-bounce delay-75" />
                    <div className="w-1.5 h-1.5 bg-premium-gold rounded-full animate-bounce delay-150" />
                  </div>
                  {/* Subtle progress glow */}
                  <div className="absolute bottom-0 left-0 h-[1px] bg-premium-gold/50 animate-progress-glow" />
                </div>
              </div>
              <p className="text-[10px] text-premium-gold/60 pl-11 italic animate-fade-in">
                Analyzing large university dataset... this may take a moment.
              </p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 3. Input Area - Fixed Bottom */}
      <div className="flex-shrink-0 p-4 border-t border-white/10 bg-black/40 backdrop-blur-xl z-30">
        <div className="max-w-4xl mx-auto w-full relative flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-premium-gold/50 focus:bg-white/10 transition-all resize-none text-sm"
            rows={1}
            style={{ minHeight: '46px', maxHeight: '120px' }}
          />
          <button
            onClick={send}
            disabled={loading || !message.trim()}
            className="h-[46px] w-[46px] flex items-center justify-center rounded-xl bg-premium-gold text-black hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-600 mt-2">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}
