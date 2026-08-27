import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useScroll,
  useInView,
  AnimatePresence,
} from 'framer-motion';
import {
  TrendingUp,
  BarChart3,
  Users,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  ShieldAlert,
  Brain,
  Rocket,
  Award,
  Building2,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

/* ------------------------------------------------------------------ */
/* 3D Parallax Tilt Card — mouse-reactive rotation + dynamic shadow   */
/* ------------------------------------------------------------------ */
function TiltCard({ children, className, glowColor = 'rgba(99,102,241,0.35)' }) {
  const cardRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['14deg', '-14deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-14deg', '14deg']);
  const shadowX = useTransform(mouseXSpring, [-0.5, 0.5], [-18, 18]);
  const shadowY = useTransform(mouseYSpring, [-0.5, 0.5], [-18, 18]);
  const boxShadow = useTransform(
    [shadowX, shadowY],
    ([sx, sy]) => `${-sx}px ${-sy}px 40px -8px ${glowColor}`
  );

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / rect.width - 0.5);
    y.set(mouseY / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.03 }}
      style={{
        rotateY,
        rotateX,
        boxShadow,
        transformStyle: 'preserve-3d',
      }}
      className={`relative transition-shadow duration-200 ease-out cursor-pointer will-change-transform ${className}`}
    >
      <div style={{ transform: 'translateZ(40px)', transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Orbiting icon ring — used by the AI Core visual                    */
/* ------------------------------------------------------------------ */
function OrbitRing({ icons, radius, duration, reverse = false, size = 48 }) {
  return (
    <motion.div
      className="absolute inset-0"
      style={{ transformStyle: 'preserve-3d' }}
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
    >
      {icons.map((Icon, i) => {
        const angle = (360 / icons.length) * i;
        const rad = (angle * Math.PI) / 180;
        const ox = radius * Math.cos(rad);
        const oy = radius * Math.sin(rad);
        return (
          <div
            key={i}
            className="absolute top-1/2 left-1/2"
            style={{ transform: `translate(${ox}px, ${oy}px)`, marginLeft: -size / 2, marginTop: -size / 2 }}
          >
            <motion.div
              animate={{ rotate: reverse ? 360 : -360 }}
              transition={{ duration, repeat: Infinity, ease: 'linear' }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg shadow-indigo-200/60 dark:shadow-none border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400"
              style={{ width: size, height: size }}
            >
              <Icon className="w-5 h-5" />
            </motion.div>
          </div>
        );
      })}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* AI Core visual — pulsing center + two counter-rotating orbit rings */
/* ------------------------------------------------------------------ */
function AICoreVisual() {
  return (
    <div
      className="relative w-full max-w-md mx-auto aspect-square flex items-center justify-center"
      style={{ perspective: 1200 }}
    >
      {/* Concentric guide rings */}
      <div className="absolute inset-[8%] rounded-full border border-indigo-200/60 dark:border-indigo-800/40" />
      <div className="absolute inset-[26%] rounded-full border border-indigo-200/50 dark:border-indigo-800/30" />

      {/* Orbiting modules */}
      <OrbitRing icons={[BarChart3, Users, ShieldCheck, TrendingUp]} radius={130} duration={20} />
      <OrbitRing icons={[Sparkles, Zap]} radius={185} duration={30} reverse size={40} />

      {/* Pulsing AI core */}
      <motion.div
        animate={{
          scale: [1, 1.08, 1],
          boxShadow: [
            '0 0 40px 8px rgba(99,102,241,0.25)',
            '0 0 70px 20px rgba(99,102,241,0.45)',
            '0 0 40px 8px rgba(99,102,241,0.25)',
          ],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 dark:from-indigo-400 dark:to-violet-500 flex items-center justify-center text-white"
      >
        <Brain className="w-12 h-12" />
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Animated count-up number — triggers once when scrolled into view   */
/* ------------------------------------------------------------------ */
function CountUp({ value, suffix = '', duration = 1.8 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      setDisplay(Math.floor(progress * value));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isInView, value, duration]);

  return (
    <span ref={ref}>
      {display.toLocaleString('en-IN')}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive Product Demo Section                                   */
/* ------------------------------------------------------------------ */
function InteractivePreview() {
  const [activeTab, setActiveTab] = useState('forecasting');
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  const tabs = [
    { id: 'forecasting', label: 'Sales Analytics', icon: BarChart3 },
    { id: 'inventory', label: 'Smart Inventory', icon: TrendingUp },
    { id: 'churn', label: 'Customer Retention', icon: Users },
  ];

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-7xl mx-auto px-8 py-16"
    >
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
          Experience MarketMind AI in action
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mt-3 text-base transition-colors">
          Click through our core modules to preview real-time predictions and automated dashboard insights.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Interactive Mock Dashboard Window */}
      <motion.div
        style={{ transformStyle: 'preserve-3d', perspective: 1200 }}
        initial={{ opacity: 0, rotateX: 8, y: 30 }}
        animate={isInView ? { opacity: 1, rotateX: 0, y: 0 } : {}}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xl shadow-slate-200/60 dark:shadow-none overflow-hidden transition-colors"
      >
        {/* Mock Browser Header */}
        <div className="bg-slate-100/80 dark:bg-slate-900/80 px-6 py-4 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="ml-4 text-xs font-mono text-slate-500 dark:text-slate-400">app.marketmind.ai/{activeTab}</span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/60 transition-colors">
            Live Interactive Preview
          </span>
        </div>

        {/* Dynamic Tab Content */}
        <div className="p-8 min-h-[380px] bg-slate-50/50 dark:bg-slate-900/50 transition-colors">
          <AnimatePresence mode="wait">
            {activeTab === 'forecasting' && (
              <motion.div
                key="forecasting"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm transition-colors">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Predicted Monthly Sales</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">₹4,82,500</p>
                    <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 gap-0.5 mt-2">
                      <ArrowUpRight className="w-3.5 h-3.5" /> +14.2% vs last month
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm transition-colors">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Model Accuracy</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">96.8%</p>
                    <span className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 gap-1 mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5" /> XGBoost Trained
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm transition-colors">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Peak Sales Day</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">Saturdays</p>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 block">High weekend traffic predicted</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm transition-colors">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-4">6-Month Revenue Projection</h4>
                  <div className="flex items-end gap-4 h-32 pt-4">
                    {[40, 55, 65, 80, 70, 95].map((height, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ duration: 0.5, delay: i * 0.1 }}
                          className={`w-full rounded-t-xl ${i >= 4 ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-indigo-200 dark:bg-slate-700'}`}
                        />
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                          {['Apr', 'May', 'Jun', 'Jul', 'Aug (Pred)', 'Sep (Pred)'][i]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'inventory' && (
              <motion.div
                key="inventory"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">Low Stock Alert Triggered</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Product "Organic Green Tea" is projected to run out in 4 days.</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-amber-600 dark:bg-amber-500 hover:bg-amber-700 dark:hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all">
                    Reorder 50 Units
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-sm transition-colors">
                  <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-700/60 grid grid-cols-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">
                    <span>Product</span>
                    <span>Current Stock</span>
                    <span>Reorder Point</span>
                    <span>Status</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm">
                    <div className="px-6 py-3.5 grid grid-cols-4 items-center">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Espresso Roast Coffee</span>
                      <span className="text-slate-600 dark:text-slate-300">142 units</span>
                      <span className="text-slate-600 dark:text-slate-300">30 units</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Healthy</span>
                    </div>
                    <div className="px-6 py-3.5 grid grid-cols-4 items-center bg-amber-50/40 dark:bg-amber-950/20">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Organic Green Tea</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">8 units</span>
                      <span className="text-slate-600 dark:text-slate-300">25 units</span>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Reorder Soon</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'churn' && (
              <motion.div
                key="churn"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-4 transition-colors">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">At-Risk High Value Customers</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl flex items-center justify-between transition-colors">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Aarav Patel</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Last purchased: 42 days ago</p>
                      </div>
                      <span className="px-2.5 py-1 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 font-bold text-xs rounded-full">
                        84% Churn Risk
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col justify-between transition-colors">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Automated Retention Campaign</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Target churning VIPs with an automated 15% discount code via email.
                    </p>
                  </div>
                  <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-200 dark:shadow-none mt-4">
                    Send Re-engagement Promo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* "Why Choose Us" — cards flip in as they scroll into view           */
/* ------------------------------------------------------------------ */
function WhyChooseUs() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  const items = [
    {
      icon: Rocket,
      tone: 'indigo',
      title: 'Deploy in Minutes',
      desc: 'Upload a CSV of your sales history and get working forecasts the same day — no data team required.',
    },
    {
      icon: Award,
      tone: 'emerald',
      title: 'Built for Retail',
      desc: 'Every model — churn, segmentation, forecasting — is tuned specifically for small-business retail patterns.',
    },
    {
      icon: ShieldCheck,
      tone: 'amber',
      title: 'Secure by Default',
      desc: 'OTP-based authentication and encrypted storage keep your customer and sales data locked down.',
    },
  ];

  const toneClasses = {
    indigo: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/60',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/60',
    amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/60',
  };

  return (
    <section ref={sectionRef} className="max-w-7xl mx-auto px-8 py-16" style={{ perspective: 1400 }}>
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
          Why small businesses choose MarketMind AI
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mt-3 text-base transition-colors">
          No enterprise complexity, no long onboarding — just the insights that move revenue.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, rotateX: -60, y: 40 }}
              animate={isInView ? { opacity: 1, rotateX: 0, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformStyle: 'preserve-3d', transformOrigin: 'top center' }}
            >
              <TiltCard className="bg-white dark:bg-slate-800 p-7 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-lg shadow-slate-200/50 dark:shadow-none h-full">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border transition-colors ${toneClasses[item.tone]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg transition-colors">{item.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed transition-colors">{item.desc}</p>
              </TiltCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Animated stats strip                                                */
/* ------------------------------------------------------------------ */
function StatsSection() {
  const stats = [
    { icon: Building2, value: 2400, suffix: '+', label: 'Retail Stores Onboarded' },
    { icon: TrendingUp, value: 18, suffix: '%', label: 'Avg. Revenue Uplift' },
    { icon: Brain, value: 97, suffix: '%', label: 'Forecast Model Accuracy' },
    { icon: Users, value: 60, suffix: 'K+', label: 'Customers Tracked' },
  ];

  return (
    <section className="max-w-7xl mx-auto px-8 py-16">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <TiltCard
                className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-md shadow-slate-200/50 dark:shadow-none text-center h-full"
                glowColor="rgba(99,102,241,0.25)"
              >
                <div className="mx-auto w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 border border-indigo-100 dark:border-indigo-800/60">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">
                  {stat.label}
                </p>
              </TiltCard>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Closing CTA                                                         */
/* ------------------------------------------------------------------ */
function ClosingCTA() {
  return (
    <section className="max-w-7xl mx-auto px-8 py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 dark:from-indigo-600 dark:via-indigo-700 dark:to-violet-800 px-8 py-16 md:px-16 text-center"
      >
        {/* Floating decorative shapes */}
        <motion.div
          animate={{ y: [0, -18, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"
        />
        <motion.div
          animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-10 -right-10 w-56 h-56 bg-violet-300/20 rounded-full blur-2xl"
        />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold mb-6">
            <Sparkles className="w-4 h-4 text-amber-300" /> Start free, upgrade anytime
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight max-w-2xl mx-auto leading-tight">
            Ready to see what AI can do for your business?
          </h2>
          <p className="text-indigo-100 mt-4 max-w-xl mx-auto text-base">
            Join thousands of stores already forecasting demand, cutting stockouts, and retaining more customers with MarketMind AI.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="group px-8 py-4 bg-white text-indigo-700 font-bold rounded-full transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2 text-base"
            >
              Create Free Account
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full transition-all border border-white/20 hover:scale-105 active:scale-95 text-base"
            >
              Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Main Landing Page                                                   */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  // Scroll-linked parallax for the hero visual column
  const heroVisualY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const heroTextY = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // Mouse-parallax for the layered background glows behind the hero cards
  const rightGridRef = useRef(null);
  const parallaxX = useMotionValue(0);
  const parallaxY = useMotionValue(0);
  const parallaxSpringX = useSpring(parallaxX, { stiffness: 60, damping: 20 });
  const parallaxSpringY = useSpring(parallaxY, { stiffness: 60, damping: 20 });
  const blob1X = useTransform(parallaxSpringX, [-0.5, 0.5], [-30, 30]);
  const blob1Y = useTransform(parallaxSpringY, [-0.5, 0.5], [-30, 30]);
  const blob2X = useTransform(parallaxSpringX, [-0.5, 0.5], [25, -25]);
  const blob2Y = useTransform(parallaxSpringY, [-0.5, 0.5], [25, -25]);

  const handleHeroMouseMove = (e) => {
    if (!rightGridRef.current) return;
    const rect = rightGridRef.current.getBoundingClientRect();
    parallaxX.set((e.clientX - rect.left) / rect.width - 0.5);
    parallaxY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 35 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/20 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-300 overflow-x-hidden">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-8 py-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl relative z-50 transition-colors">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ rotateY: 180 }}
            transition={{ duration: 0.6 }}
            style={{ transformStyle: 'preserve-3d', perspective: 400 }}
            className="bg-indigo-600 dark:bg-indigo-500 text-white p-2.5 rounded-2xl shadow-md shadow-indigo-200 dark:shadow-none"
          >
            <TrendingUp className="w-6 h-6" />
          </motion.div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 transition-colors">MarketMind AI</span>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            to="/login"
            className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-full transition-all shadow-md shadow-indigo-200 dark:shadow-none hover:scale-105 active:scale-95"
          >
            Sign up
          </Link>
        </div>
      </nav>

      {/* Main Hero Section — fills viewport, AI Core stays below the fold */}
      <section ref={heroRef} className="min-h-[calc(100vh-76px)] flex items-center">
        <div className="max-w-7xl mx-auto px-8 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center relative">
                {/* Left Side Content */}
                <motion.div
                  className="space-y-8"
                  style={{ y: heroTextY, opacity: heroOpacity }}
                  initial="hidden"
                  animate="visible"
                  variants={staggerContainer}
                >
                  <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 rounded-full text-indigo-700 dark:text-indigo-300 text-sm font-medium shadow-sm transition-colors">
                    <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-bounce" /> AI-Powered Business Intelligence
                  </motion.div>

                  <motion.h1 variants={fadeInUp} className="text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-slate-100 leading-[1.12] tracking-tight transition-colors">
                    Grow your small business with{' '}
                    <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
                      smart AI insights
                    </span>
                  </motion.h1>

                  <motion.p variants={fadeInUp} className="text-lg text-slate-600 dark:text-slate-300 max-w-lg leading-relaxed transition-colors">
                    MarketMind AI predicts sales trends, manages inventory shortages, and helps you keep your best customers—all from one intuitive dashboard.
                  </motion.p>

                  <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-4 pt-2">
                    <Link
                      to="/register"
                      className="group px-8 py-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-full transition-all shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-105 active:scale-95 flex items-center gap-2 text-base"
                    >
                      Get Started Free
                      <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                    <Link
                      to="/login"
                      className="px-8 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-full transition-all border border-slate-200/80 dark:border-slate-700/80 hover:scale-105 active:scale-95 text-base"
                    >
                      I already have an account
                    </Link>
                  </motion.div>

                  <motion.div variants={fadeInUp} className="flex items-center gap-6 pt-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">
                    <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Fast Setup</span>
                    <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure OTP Auth</span>
                    <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Analytics Ready</span>
                  </motion.div>
                </motion.div>

                {/* Right Side Interactive Cards */}
                <motion.div
                  ref={rightGridRef}
                  onMouseMove={handleHeroMouseMove}
                  className="grid grid-cols-2 gap-4 relative overflow-visible"
                  style={{ y: heroVisualY, perspective: 1400 }}
                  initial="hidden"
                  animate="visible"
                  variants={staggerContainer}
                >
                  {/* Mouse-parallax background glows (layered depth) */}
                  <motion.div
                    style={{ x: blob1X, y: blob1Y }}
                    className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-200/40 dark:bg-indigo-600/15 rounded-full blur-[90px] -z-10 animate-pulse transition-colors"
                  />
                  <motion.div
                    style={{ x: blob2X, y: blob2Y }}
                    className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-200/40 dark:bg-violet-600/15 rounded-full blur-[90px] -z-10 animate-pulse transition-colors"
                  />

                  <div className="space-y-5">
                    <motion.div variants={fadeInUp}>
                      <TiltCard className="bg-white/90 dark:bg-slate-800/90 p-7 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl shadow-slate-200/50 dark:shadow-none hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors">
                        <div className="bg-indigo-50 dark:bg-indigo-950/60 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 border border-indigo-100 dark:border-indigo-800/60 transition-colors">
                          <BarChart3 className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg transition-colors">Sales Forecasting</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed transition-colors">
                          Predict demand accurately using Machine Learning models trained on historical data.
                        </p>
                      </TiltCard>
                    </motion.div>

                    <motion.div variants={fadeInUp}>
                      <TiltCard
                        glowColor="rgba(16,185,129,0.3)"
                        className="bg-white/90 dark:bg-slate-800/90 p-7 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl shadow-slate-200/50 dark:shadow-none hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors"
                      >
                        <div className="bg-emerald-50 dark:bg-emerald-950/60 w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 border border-emerald-100 dark:border-emerald-800/60 transition-colors">
                          <TrendingUp className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg transition-colors">Smart Inventory</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed transition-colors">
                          Automated low-stock detection and reorder volume recommendations.
                        </p>
                      </TiltCard>
                    </motion.div>
                  </div>

                  <div className="space-y-5 pt-8">
                    <motion.div variants={fadeInUp}>
                      <TiltCard
                        glowColor="rgba(245,158,11,0.3)"
                        className="bg-white/90 dark:bg-slate-800/90 p-7 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl shadow-slate-200/50 dark:shadow-none hover:border-amber-300 dark:hover:border-amber-500 transition-colors"
                      >
                        <div className="bg-amber-50 dark:bg-amber-950/60 w-12 h-12 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 border border-amber-100 dark:border-amber-800/60 transition-colors">
                          <Users className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg transition-colors">Customer Churn</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed transition-colors">
                          Spot churn risks early and target high-value VIP customers effectively.
                        </p>
                      </TiltCard>
                    </motion.div>

                    {/* Floating Live AI Pulse Badge */}
                    <motion.div
                      variants={fadeInUp}
                      animate={{ y: [0, -8, 0] }}
                      transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                      className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-500 dark:to-violet-500 text-white p-6 rounded-3xl shadow-xl shadow-indigo-200 dark:shadow-none border border-indigo-400/30"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
                        <span className="font-bold text-sm">Real-time Insights</span>
                      </div>
                      <p className="text-xs text-indigo-100 leading-relaxed font-medium">
                        Automatic detection of revenue anomalies and seasonal demand shifts.
                      </p>
                    </motion.div>
                  </div>
                </motion.div>
        </div>
      </section>

      {/* AI Core orbit visual — now below the fold, only visible on scroll */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-7xl mx-auto px-8 py-16"
      >
          <div className="text-center max-w-2xl mx-auto mb-4">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
              One AI core, every insight connected
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-3 text-base transition-colors">
              Sales, inventory, churn, and segmentation models all run off the same continuously learning core.
            </p>
          </div>
          <AICoreVisual />
      </motion.section>

      {/* Product Interactive Demo Section */}
      <InteractivePreview />

      {/* Why Choose Us — flip-in feature cards */}
      <WhyChooseUs />

      {/* Animated stats */}
      <StatsSection />

      {/* Closing CTA */}
      <ClosingCTA />

      {/* Footer */}
      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 mt-8">
        <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 dark:bg-indigo-500 text-white p-1.5 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">MarketMind AI</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} MarketMind AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}