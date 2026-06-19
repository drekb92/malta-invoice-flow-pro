import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, MessageSquare, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What's my total outstanding balance?",
  "Which invoices are overdue?",
  "Who are my top customers this month?",
  "Draft a payment reminder for overdue invoices",
];

export default function AiChatPanel() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, minimized]);

  if (!user) return null;

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const newHistory: Message[] = [...messages, { role: "user", content }];
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await supabase.functions.invoke("ai-chat", {
        body: {
          message: content,
          history: messages.slice(-10),
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const reply = res.data?.reply || "Sorry, I couldn't get a response.";
      setMessages([...newHistory, { role: "assistant", content: reply }]);
    } catch {
      setMessages([
        ...newHistory,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setMinimized(false); }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-3 shadow-lg hover:bg-primary/90 transition-all"
        >
          <Bot className="h-5 w-5" />
          <span className="text-sm font-medium">AI Assistant</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 w-[380px] bg-background border rounded-2xl shadow-2xl flex flex-col transition-all duration-200",
            minimized ? "h-14" : "h-[560px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="font-semibold text-sm">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setMinimized(!minimized)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => { setOpen(false); setMessages([]); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 px-3 py-3">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="bg-primary/10 rounded-full p-1.5 shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2 text-sm text-foreground max-w-[280px]">
                        Hi! I can help you understand your invoices, customers, and outstanding payments. What would you like to know?
                      </div>
                    </div>
                    <div className="pl-9 space-y-1.5">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => sendMessage(s)}
                          className="block w-full text-left text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn("flex items-start gap-2 mb-3", msg.role === "user" && "flex-row-reverse")}
                  >
                    {msg.role === "assistant" && (
                      <div className="bg-primary/10 rounded-full p-1.5 shrink-0 mt-0.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm max-w-[280px] whitespace-pre-wrap leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-start gap-2 mb-3">
                    <div className="bg-primary/10 rounded-full p-1.5 shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </ScrollArea>

              {/* Input */}
              <div className="px-3 pb-3 pt-2 border-t shrink-0">
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ask about your invoices..."
                    className="resize-none min-h-[38px] max-h-[120px] text-sm"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="h-9 w-9 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                  Powered by Claude AI · Your data stays private
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
