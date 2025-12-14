import React, { useState, useRef, useEffect } from 'react';
import client from '../api/index';
import { useAuth } from '../contexts/AuthContext';
import { Send, Bot, User, Loader2, MessageSquare, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const send = async () => {
    if (!message.trim() || loading) return;

    const userMessage = { id: Date.now(), text: message, from: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    const currentMessage = message;
    setMessage('');
    setLoading(true);

    try {
      // Direct call to /chat - axios client already has /api baseURL
      const res = await client.post('/chat', { query: currentMessage });

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
    <div className="h-screen animated-gradient-bg flex flex-col relative overflow-hidden">
      {/* Centered Chat Container */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6 relative z-10 h-full">
        {/* Header */}
        <div className="text-center mb-6 animate-fade-in flex-shrink-0">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-premium-gold/10 mb-3 shadow-lg">
            <MessageSquare className="w-8 h-8 text-premium-gold" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-premium-gold to-white">
            AI Chat Assistant
          </h1>
          <p className="text-gray-400 text-sm flex items-center justify-center gap-2">
            <Sparkles className="w-3 h-3 text-premium-gold" />
            Powered by RAG • Context-aware responses
            <Sparkles className="w-3 h-3 text-premium-gold" />
          </p>
        </div>

        {/* Main Chat Card */}
        <div className="flex-1 glass-panel-strong rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col min-h-0 relative z-20">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-gradient-to-b from-black/20 to-transparent relative z-20">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <div className="absolute inset-0 bg-premium-gold/20 blur-3xl rounded-full"></div>
                  <Bot className="w-20 h-20 text-premium-gold relative animate-pulse" />
                </div>
                <h2 className="text-xl font-bold text-white mt-6 mb-2">How can I help you today?</h2>
                <p className="text-gray-400 text-center max-w-md text-sm px-4">
                  Ask me anything about your documents. I'll search through your knowledge base to find the best answers.
                </p>
                <div className="mt-6 flex gap-2 flex-wrap justify-center px-4">
                  <button
                    onClick={() => setMessage("What is the average student GPA?")}
                    className="glass-panel px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-white/10 transition-all hover:scale-105 z-30"
                  >
                    💯 Student GPAs
                  </button>
                  <button
                    onClick={() => setMessage("Tell me about course enrollments")}
                    className="glass-panel px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-white/10 transition-all hover:scale-105 z-30"
                  >
                    📚 Courses
                  </button>
                  <button
                    onClick={() => setMessage("Show me attendance data")}
                    className="glass-panel px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-white/10 transition-all hover:scale-105 z-30"
                  >
                    📊 Attendance
                  </button>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.from === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg ${m.from === 'user'
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                  : m.from === 'error'
                    ? 'bg-gradient-to-br from-red-500 to-red-600'
                    : 'bg-gradient-to-br from-premium-gold to-yellow-500'
                  }`}>
                  {m.from === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-black" />}
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[80%] md:max-w-[70%] rounded-2xl p-4 shadow-lg ${m.from === 'user'
                  ? 'bg-gradient-to-br from-blue-600/40 to-blue-700/40 text-blue-50 border border-blue-400/30 rounded-tr-md backdrop-blur-sm'
                  : m.from === 'error'
                    ? 'bg-gradient-to-br from-red-500/20 to-red-600/20 text-red-100 border border-red-400/30 backdrop-blur-sm'
                    : 'bg-gradient-to-br from-white/10 to-white/5 text-gray-100 border border-white/20 rounded-tl-md backdrop-blur-sm'
                  }`}>
                  <div className="whitespace-pre-wrap break-words leading-relaxed text-sm">{m.text}</div>
                  {m.contextUsed && m.from === 'ai' && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-xs text-premium-gold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span className="font-medium">Based on your documents</span>
                    </div>
                  )}
                  <div className="text-xs mt-2 opacity-50 font-medium">
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-premium-gold to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Bot className="w-5 h-5 text-black" />
                </div>
                <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-2xl rounded-tl-md p-4 border border-white/20 flex items-center gap-3 backdrop-blur-sm shadow-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-premium-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-premium-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-premium-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-gray-300 text-sm font-medium">AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area - Professional Style */}
          <div className="flex-shrink-0 p-4 md:p-5 bg-gradient-to-t from-black/80 to-black/40 border-t border-white/10 backdrop-blur-xl relative z-30">
            <div className="flex gap-3 items-end relative z-40">
              {/* Textarea Input */}
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={loading ? "AI is responding..." : "Type your message..."}
                  disabled={loading}
                  rows={1}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-premium-gold focus:bg-white/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm shadow-inner text-sm resize-none overflow-hidden relative z-50 pointer-events-auto"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
              </div>

              {/* Send Button */}
              <button
                onClick={send}
                disabled={loading || !message.trim()}
                className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-r from-premium-gold to-yellow-500 text-black font-bold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-premium-gold/30 active:scale-95 shadow-md relative z-50 pointer-events-auto"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Helper Text */}
            <p className="text-center mt-3 text-xs text-gray-500">
              Press Enter to send • Shift+Enter for new line • First message may take 2-3 min
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
