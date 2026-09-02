import { useState, useRef, useEffect, useCallback } from 'react'
import api from '../services/api'
import {
  MessageCircle, X, Send, User, TrendingUp,
  Users, Package, FileText,
  IndianRupee, BarChart3, Minus, ArrowUpRight, ArrowDownRight,
  Mic, MicOff, Trash2, Volume2, VolumeX,
} from 'lucide-react'

// ── RAG Knowledge Base ──────────────────────────────────────────────
let kb = null
let kbPromise = null

async function buildKB() {
  if (kb) return kb
  if (kbPromise) return kbPromise
  kbPromise = (async () => {
    const [sales, customers, invoices, products, alerts, kpis, forecast, segments, clv, activity] = await Promise.all([
      api.get('/sales/').catch(() => ({ data: [] })),
      api.get('/customers/').catch(() => ({ data: [] })),
      api.get('/invoices/').catch(() => ({ data: [] })),
      api.get('/inventory/products').catch(() => ({ data: [] })),
      api.get('/inventory/alerts').catch(() => ({ data: [] })),
      api.get('/analytics/kpis').catch(() => ({ data: {} })),
      api.get('/ai/forecast').catch(() => ({ data: {} })),
      api.get('/ai/segmentation').catch(() => ({ data: {} })),
      api.get('/ai/clv').catch(() => ({ data: {} })),
      api.get('/activity/stats').catch(() => ({ data: {} })),
    ])
    const S = sales.data || [], C = customers.data || [], I = invoices.data || [], P = products.data || []
    const totalRev = S.reduce((s, x) => s + (x.total_amount || 0), 0)
    const avgOrd = S.length ? totalRev / S.length : 0
    const pQty = {}, pRev = {}
    S.forEach(s => { if (s.product_id) { pQty[s.product_id] = (pQty[s.product_id] || 0) + (s.quantity || 1); pRev[s.product_id] = (pRev[s.product_id] || 0) + (s.total_amount || 0) } })
    const topP = Object.entries(pQty).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, q]) => ({ name: P.find(p => p.id === +id)?.name || `#${id}`, qty: q, rev: pRev[id] || 0 }))
    const cRev = {}, cOrd = {}
    S.forEach(s => { if (s.customer_id) { cRev[s.customer_id] = (cRev[s.customer_id] || 0) + (s.total_amount || 0); cOrd[s.customer_id] = (cOrd[s.customer_id] || 0) + 1 } })
    const topC = Object.entries(cRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, r]) => ({ name: C.find(c => c.id === +id)?.name || `#${id}`, rev: r, orders: cOrd[id] || 0 }))
    const paid = I.filter(i => i.status === 'paid'), pend = I.filter(i => i.status === 'pending'), over = I.filter(i => i.status === 'overdue')
    const lowStock = P.filter(p => (p.stock_quantity || 0) <= (p.reorder_threshold || 5))
    kb = { S, C, I, P, alerts: alerts.data || [], kpis: kpis.data || {}, forecast: forecast.data || {}, segments: segments.data || {}, clv: clv.data || {}, activity: activity.data || {}, totalRev, salesCount: S.length, avgOrd, topP, topC, paidN: paid.length, pendN: pend.length, overN: over.length, overAmt: over.reduce((s, i) => s + (i.amount || 0), 0), totalInvAmt: I.reduce((s, i) => s + (i.amount || 0), 0), lowStock, custN: C.length, prodN: P.length }
    return kb
  })()
  return kbPromise
}

const INR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const Trend = ({ value }) => {
  if (!value && value !== 0) return null
  const up = value > 0, down = value < 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : down ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
      {up ? <ArrowUpRight size={10} /> : down ? <ArrowDownRight size={10} /> : <Minus size={10} />}
      {up ? '+' : ''}{typeof value === 'number' ? value.toFixed(1) : value}%
    </span>
  )
}

// ── Voice: preload voices globally ──
let _voicesReady = false
let _voices = []
function ensureVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  _voices = window.speechSynthesis.getVoices() || []
  if (_voices.length) _voicesReady = true
  window.speechSynthesis.onvoiceschanged = () => {
    _voices = window.speechSynthesis.getVoices() || []
    if (_voices.length) _voicesReady = true
  }
}
ensureVoices()

// ── Natural Language Response Builder ──
function buildResponse(query) {
  if (!kb) return [{ text: 'Just a sec, still loading your data...' }]
  const q = query.toLowerCase()

  // Greetings
  if (q.match(/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|sup|yo)/)) {
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    const lowStockWarn = kb.lowStock.length > 0 ? ` Also, just a heads up — you've got ${kb.lowStock.length} items running low on stock.` : ''
    return [{ text: `${greeting}! 👋 I just checked your numbers. You've made ${INR(kb.totalRev)} from ${kb.salesCount} sales so far, with ${kb.custN} customers buying from your ${kb.prodN} products.${lowStockWarn} What can I help you with?` }]
  }

  // Revenue
  if (q.match(/revenue|total.*sale|earning|income|money|how much|turnover|business.*doing/)) {
    const g = kb.forecast?.growth_pct
    const trend = g !== undefined ? (g > 0 ? `That's actually up ${Math.abs(g).toFixed(1)}% from last period — nice!` : `That's down ${Math.abs(g).toFixed(1)}% from last period, so there's room to improve.`) : ''
    return [{ text: `Your total revenue is ${INR(kb.totalRev)} from ${kb.salesCount} sales across ${kb.prodN} products. Your average customer spends about ${INR(kb.avgOrd)} per order. ${trend} Want me to break down who's buying the most?` }]
  }

  // Customers
  if (q.match(/customer|client|buyer|who.*bought|spend|audience/)) {
    const avgSpend = kb.custN ? INR(kb.totalRev / kb.custN) : 'N/A'
    const top3 = kb.topC.slice(0, 3).map((c, i) => `${i + 1}. ${c.name} — ${INR(c.rev)} from ${c.orders} orders`).join('\n')
    return [{ text: `You've got ${kb.custN} customers in total. Here are your top 3 spenders:\n${top3}\n\nOn average each customer spends about ${avgSpend}. Want to know who's at risk of leaving?` }]
  }

  // Products
  if (q.match(/product|best.?sell|top.?product|what.*sell|most.*sold/)) {
    const top = kb.topP[0]
    const topList = kb.topP.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} — ${p.qty} units, ${INR(p.rev)}`).join('\n')
    return [{ text: `Here are your top selling products:\n${topList}\n\n${top?.name || 'N/A'} is your number one with ${top?.qty || 0} units sold. Want me to check which ones are running low on stock?` }]
  }

  // Inventory
  if (q.match(/stock|inventory|low|out.?of|reorder/)) {
    if (kb.lowStock.length === 0) {
      return [{ text: `Good news — all ${kb.prodN} products are well stocked! None are below the reorder threshold. Your inventory is in great shape. Want me to check anything else?` }]
    }
    const items = kb.lowStock.map(p => `• ${p.name} — only ${p.stock_quantity || 0} left`).join('\n')
    return [{ text: `You've got ${kb.lowStock.length} items running low:\n${items}\n\nI'd recommend reordering these soon before they run out. Want me to check which suppliers to contact?` }]
  }

  // Invoices
  if (q.match(/invoice|bill|overdue|paid|pending/)) {
    const overAmt = INR(kb.overAmt)
    if (kb.overN === 0) {
      return [{ text: `All ${kb.paidN} of your invoices are paid! ${kb.pendN > 0 ? `You still have ${kb.pendN} pending though.` : 'No pending payments either — nice work!'}` }]
    }
    return [{ text: `You've got ${kb.overN} overdue invoices totaling ${overAmt}. ${kb.paidN} are paid and ${kb.pendN} are still pending. I'd suggest following up on those overdue ones soon — they could hurt your cash flow if left too long.` }]
  }

  // Anomalies
  if (q.match(/anomal|suspicious|unusual|fraud|alert|weird/)) {
    const high = kb.alerts.filter(a => a.severity === 'high')
    if (kb.alerts.length === 0) {
      return [{ text: "Everything looks normal! No unusual activity detected in your data. Your sales patterns are consistent and there's nothing suspicious going on." }]
    }
    return [{ text: `I found ${kb.alerts.length} unusual patterns in your data. ${high.length > 0 ? `${high.length} of them are high priority — could be pricing errors, duplicate transactions, or something suspicious. You should check the Anomaly Alerts page to investigate.` : 'Nothing critical, but worth a quick look.'} Want me to explain what each one means?` }]
  }

  // Team
  if (q.match(/team|employee|staff|member|who.*work/)) {
    return [{ text: "I can see you've got a team set up, but I don't have the full roster details loaded right now. Head over to the Team page to see everyone's roles and contact info. Is there something specific about your team I can help with?" }]
  }

  // Segments
  if (q.match(/segment|cluster|group|categor.*customer/)) {
    return [{ text: "Your customers get automatically grouped into segments based on how often they buy and how much they spend. There's usually Loyal, VIP, Regular, and At-Risk groups. Check the Segmentation page to see where each customer falls — it's really useful for targeted marketing!" }]
  }

  // Churn
  if (q.match(/churn|risk|leav|lost|stop.*buy/)) {
    return [{ text: "I use machine learning to predict which customers might stop buying from you. It looks at their purchase frequency, recency, and spending patterns. If someone hasn't bought in a while, they're flagged as at-risk. Check the Churn Risk page to see who needs attention — maybe send them a special offer?" }]
  }

  // Forecast
  if (q.match(/forecast|predict|trend|future|next.*month/)) {
    const g = kb.forecast?.growth_pct
    if (g !== undefined) {
      return [{ text: `Based on your historical data, I'm predicting revenue will ${g > 0 ? 'grow' : 'decline'} by about ${Math.abs(g).toFixed(1)}% in the coming period. ${g > 0 ? "That's a positive trend — keep doing what you're doing!" : "I'd recommend looking at what changed and trying to reverse this."} Want me to dig deeper into the forecast?` }]
    }
    return [{ text: "I'm still crunching the numbers on your forecast. Give me a moment and try again — or check the Forecasting page for the full analysis with charts." }]
  }

  // CLV
  if (q.match(/clv|lifetime|value.*customer|long.?term/)) {
    const avg = INR(kb.clv?.summary?.avg_clv || 0)
    const high = kb.clv?.summary?.high_value || 0
    const risk = kb.clv?.summary?.at_risk || 0
    return [{ text: `Your average customer is worth ${avg} over their lifetime. You've got ${high} high-value customers who are really profitable, but ${risk} customers haven't bought in a while and might be slipping away. Focusing on keeping those high-value ones happy is probably your best bet.` }]
  }

  // Activity
  if (q.match(/activity|log|what.*happen|recent|today/)) {
    const today = kb.activity?.total_today || 0
    const week = kb.activity?.total_week || 0
    const users = kb.activity?.active_users || 0
    return [{ text: today > 0 ? `Today so far there have been ${today} actions across the system, ${week} this week, with ${users} team members active. Pretty quiet day!` : `Nothing recorded today yet. This week had ${week} actions with ${users} active team members.` }]
  }

  // Best / worst
  if (q.match(/best|worst|good|bad|perform/)) {
    const top = kb.topP[0]
    const topCust = kb.topC[0]
    return [{ text: `Your best product is ${top?.name || 'N/A'} (${INR(top?.rev || 0)} revenue) and your best customer is ${topCust?.name || 'N/A'} (${INR(topCust?.rev || 0)} spent). ${kb.overN > 0 ? `On the downside, you have ${kb.overN} overdue invoices worth ${INR(kb.overAmt)}.` : 'Everything else looks solid!'}` }]
  }

  // Why / how
  if (q.match(/why|how|explain|what.*mean|understand/)) {
    return [{ text: "Sure, happy to explain! I analyze your sales, inventory, invoices, and customer data using machine learning. I can spot trends, predict future performance, detect unusual patterns, and group your customers by behavior. Just ask me about any specific area and I'll break it down for you." }]
  }

  // Thanks
  if (q.match(/thank|thanks|thx|cheers|appreciate/)) {
    return [{ text: "You're welcome! I'm here whenever you need me. Just ask about anything — revenue, customers, products, invoices, anomalies, or forecasts. Happy to help! 😊" }]
  }

  // Help
  if (q.match(/help|what can|how.*use|command|menu/)) {
    return [{ text: "I can help you with lots of things! Here are some ideas:\n\n• \"How's my revenue?\" — see your sales numbers\n• \"Any low stock?\" — check inventory alerts\n• \"Who are my top customers?\" — customer insights\n• \"Any anomalies?\" — spot unusual patterns\n• \"What's the forecast?\" — future predictions\n• \"Any overdue invoices?\" — payment status\n\nJust ask me anything about your business and I'll give you a clear answer!" }]
  }

  // Fallback — natural summary
  return [{ text: `Let me give you a quick snapshot: You've made ${INR(kb.totalRev)} from ${kb.salesCount} sales with ${kb.custN} customers. Your top seller is ${kb.topP[0]?.name || 'N/A'}. ${kb.overN > 0 ? `You have ${kb.overN} overdue invoices to chase.` : 'All invoices are in good shape.'} ${kb.lowStock.length > 0 ? `${kb.lowStock.length} items need restocking.` : 'Stock levels look healthy.'} What specifically would you like to know more about?` }]
}

const SUGGESTIONS = [
  { label: 'Revenue overview', icon: IndianRupee },
  { label: 'Top customers', icon: Users },
  { label: 'Best selling products', icon: TrendingUp },
  { label: 'Overdue invoices', icon: FileText },
  { label: 'Inventory status', icon: Package },
  { label: 'Customer segments', icon: BarChart3 },
]

// ── Bot Avatar (clean, simple) ──
function BotAvatar({ size = 'md' }) {
  const cls = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-6 h-6' : 'w-7 h-7'
  const ico = size === 'lg' ? 20 : size === 'sm' ? 12 : 14
  return (
    <div className={`${cls} bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm`}
      title="MarketMind AI">
      <MessageCircle size={ico} className="text-white" />
    </div>
  )
}

const CHAT_HISTORY_KEY = 'marketmind_chat_history'
const MAX_HISTORY = 50

export default function ChatBot() {
  const loadSavedMessages = () => {
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_KEY)
      if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) return parsed }
    } catch { /* ignore */ }
    return []
  }

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(loadSavedMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [voiceSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition))
  const recognitionRef = useRef(null)
  const endRef = useRef(null)
  const inpRef = useRef(null)

  // Persist
  useEffect(() => {
    if (messages.length > 0) {
      const serializable = messages.slice(-MAX_HISTORY).map(m => {
        const clean = { role: m.role, type: m.type, text: m.text }
        if (m.card) { clean.card = { title: m.card.title, color: m.card.color, highlight: m.card.highlight, body: m.card.body, trend: m.card.trend, emoji: m.card.emoji }; if (m.card.stats) clean.card.stats = m.card.stats.map(s => ({ label: s.label, value: s.value, color: s.color })) }
        if (m.followups) clean.followups = m.followups.filter(f => typeof f === 'string')
        return clean
      })
      try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(serializable)) } catch { /* quota */ }
    }
  }, [messages])

  const clearChat = useCallback(() => { setMessages([{ role: 'bot', type: 'welcome' }]); localStorage.removeItem(CHAT_HISTORY_KEY) }, [])

  const scroll = useCallback(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [])
  useEffect(() => { scroll() }, [messages, scroll])
  useEffect(() => { if (open) { inpRef.current?.focus(); if (!ready) buildKB().then(() => setReady(true)) } }, [open, ready])

  const send = useCallback(async (text) => {
    const q = text || input; if (!q.trim() || loading) return
    setInput(''); setMessages(p => [...p, { role: 'user', text: q }]); setLoading(true)
    try {
      if (!kb && ready) { await buildKB() }
      else if (!kb) { await new Promise(r => setTimeout(r, 500)); await buildKB() }
      await new Promise(r => setTimeout(r, 300 + Math.random() * 200))
      const resps = buildResponse(q)
      setMessages(p => [...p, ...resps.map(r => ({ role: 'bot', ...r }))])
    } catch { setMessages(p => [...p, { role: 'bot', text: "Sorry, something went wrong on my end. Could you try asking that again?" }]) }
    finally { setLoading(false) }
  }, [input, loading, ready])

  // Voice
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = false; r.interimResults = true; r.lang = 'en-US'
    r.onresult = (e) => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; setInput(t); if (e.results[e.results.length - 1].isFinished) { setRecording(false); setTimeout(() => setInput(prev => { if (prev.trim()) send(prev); return prev }), 150) } }
    r.onerror = () => setRecording(false); r.onend = () => setRecording(false)
    recognitionRef.current = r
  }, [send])

  const toggleRecording = useCallback(() => { if (!recognitionRef.current) return; if (recording) { recognitionRef.current.stop(); setRecording(false) } else { setInput(''); recognitionRef.current.start(); setRecording(true) } }, [recording])

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95" title="AI Assistant">
          <MessageCircle size={24} />
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[560px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col overflow-hidden" style={{ animation: 'chatSlideUp 0.3s ease-out' }}>
          <style>{`@keyframes chatSlideUp{from{opacity:0;transform:translateY(20px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

          {/* Header */}
          <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <BotAvatar size="md" />
              <div>
                <p className="text-sm font-semibold tracking-tight">MarketMind AI</p>
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                  <p className="text-[10px] text-white/70">{ready ? 'Online' : 'Connecting...'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && <button onClick={clearChat} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="Clear chat"><Trash2 size={14} /></button>}
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X size={16} /></button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((msg, i) => <Msg key={i} msg={msg} onSend={send} />)}
            {loading && (
              <div className="flex gap-2 justify-start">
                <BotAvatar size="sm" />
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[10px] text-slate-400">thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 2 && ready && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s.label)} className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 transition-all duration-150">
                  <s.icon size={9} />{s.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 shrink-0">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl px-3.5 py-2 focus-within:ring-2 focus-within:ring-indigo-500/20">
              <input ref={inpRef} type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={recording ? 'Listening...' : ready ? 'Ask me anything...' : 'Loading...'}
                className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none" disabled={loading || !ready} />
              {voiceSupported && (
                <button onClick={toggleRecording} disabled={loading || !ready}
                  className={`relative p-1.5 rounded-xl transition-all duration-200 active:scale-95 ${recording ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                  title={recording ? 'Stop recording' : 'Speak your question'}>
                  {recording ? <MicOff size={13} /> : <Mic size={13} />}
                  {recording && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />}
                </button>
              )}
              <button onClick={() => send()} disabled={!input.trim() || loading || !ready}
                className="p-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all duration-150 active:scale-95">
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Message Renderer ──
function Msg({ msg, onSend }) {
  const [speaking, setSpeaking] = useState(false)
  const autoSpokenRef = useRef(false)

  const speakNow = useCallback((text) => {
    const synth = window.speechSynthesis
    if (!synth || !text.trim()) return
    synth.cancel()
    if (synth.paused) synth.resume()
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 1; utter.pitch = 1; utter.volume = 1; utter.lang = 'en-US'
    if (!_voicesReady) _voices = synth.getVoices() || []
    const v = _voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
      || _voices.find(v => v.lang.startsWith('en-US'))
      || _voices.find(v => v.lang.startsWith('en')) || null
    if (v) utter.voice = v
    setSpeaking(true)
    synth.speak(utter)
    const timer = setInterval(() => { if (!synth.speaking) { setSpeaking(false); clearInterval(timer) } }, 300)
    utter.onend = () => { setSpeaking(false); clearInterval(timer) }
    utter.onerror = () => { setSpeaking(false); clearInterval(timer) }
    setTimeout(() => { synth.cancel(); setSpeaking(false); clearInterval(timer) }, 20000)
  }, [])

  // Auto-speak bot responses
  useEffect(() => {
    if (msg.role === 'bot' && !autoSpokenRef.current) {
      autoSpokenRef.current = true
      const text = msg.text || (msg.card ? `${msg.card.title}. ${msg.card.highlight || ''}. ${msg.card.body || ''}` : '')
      if (text.trim()) {
        const t = setTimeout(() => speakNow(text), 400)
        return () => clearTimeout(t)
      }
    }
  }, [msg, speakNow])

  useEffect(() => { return () => { if (speaking) window.speechSynthesis?.cancel() } }, [speaking])

  const handleSpeak = useCallback(() => {
    if (speaking) { window.speechSynthesis?.cancel(); setSpeaking(false); return }
    const text = msg.text || (msg.card ? `${msg.card.title}. ${msg.card.highlight || ''}. ${msg.card.body || ''}` : '')
    if (text.trim()) speakNow(text)
  }, [msg, speaking, speakNow])

  if (msg.role === 'user') {
    return (
      <div className="flex gap-2 justify-end">
        <div className="bg-indigo-600 text-white rounded-2xl rounded-br-md px-3.5 py-2 max-w-[80%] shadow-sm">
          <p className="text-sm">{msg.text}</p>
        </div>
        <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <User size={12} className="text-white" />
        </div>
      </div>
    )
  }

  if (msg.type === 'welcome') {
    return (
      <div className="flex gap-2 justify-start">
        <BotAvatar size="sm" />
        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">Hey! I'm your <span className="font-semibold text-indigo-600 dark:text-indigo-400">MarketMind AI assistant</span>. Ask me about revenue, customers, products, invoices — anything about your business!</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-xs">💡</span>
            <p className="text-[10px] text-slate-400">Try: "How's my revenue?" or "Any low stock items?"</p>
          </div>
        </div>
      </div>
    )
  }

  // Text-only bot message
  if (msg.text && !msg.card) {
    return (
      <div className="flex gap-2 justify-start">
        <BotAvatar size="sm" />
        <div className="max-w-[85%] space-y-1.5">
          <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-2.5">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{msg.text}</p>
          </div>
          <button onClick={handleSpeak}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${speaking ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}
            title={speaking ? 'Stop' : 'Read aloud'}>
            {speaking ? <><VolumeX size={11} /><span>Stop</span></> : <><Volume2 size={11} /><span>Listen</span></>}
          </button>
        </div>
      </div>
    )
  }

  const c = msg.card || {}

  return (
    <div className="flex gap-2 justify-start">
      <BotAvatar size="sm" />
      <div className="max-w-[85%] space-y-1.5">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-sm">
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${c.color || '#6366f1'}, ${c.color || '#6366f1'}88)` }} />
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {c.emoji && <span className="text-lg">{c.emoji}</span>}
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{c.title}</span>
              </div>
              <button onClick={handleSpeak}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${speaking ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 animate-pulse' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                title={speaking ? 'Stop speaking' : 'Read aloud'}>
                {speaking ? <><VolumeX size={11} /><span>Stop</span></> : <><Volume2 size={11} /><span>Listen</span></>}
              </button>
            </div>
            {c.highlight && <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{c.highlight}</p>}
            {c.trend !== undefined && <div className="mb-2"><Trend value={c.trend} /></div>}
            {c.stats && c.stats.length > 0 && (
              <div className="flex gap-2 mb-2">
                {c.stats.filter(Boolean).map((s, i) => (
                  <div key={i} className="flex-1 rounded-xl px-2 py-2 text-center" style={{ backgroundColor: (s.color || '#6366f1') + '10' }}>
                    <p className="text-[9px] text-slate-400 uppercase font-medium">{s.label}</p>
                    <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
            {c.body && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">{c.body}</p>}
          </div>
        </div>
        {msg.followups && (
          <div className="flex flex-wrap gap-1">
            {msg.followups.map((f, i) => (
              <button key={i} onClick={() => onSend(f)}
                className="px-2.5 py-1 text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-900/50">
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
