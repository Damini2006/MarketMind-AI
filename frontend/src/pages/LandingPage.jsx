import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
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
  ShieldAlert 
} from 'lucide-react';

// 3D Parallax Tilt Card Component
function TiltCard({ children, className }) {
  const cardRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
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
      style={{
        rotateY,
        rotateX,
        transformStyle: "preserve-3d",
      }}
      className={`relative transition-all duration-200 ease-out cursor-pointer ${className}`}
    >
      <div style={{ transform: "translateZ(30px)" }}>
        {children}
      </div>
    </motion.div>
  );
}

// Interactive Product Demo Section
function InteractivePreview() {
  const [activeTab, setActiveTab] = useState('forecasting');

  const tabs = [
    { id: 'forecasting', label: 'Sales Analytics', icon: BarChart3 },
    { id: 'inventory', label: 'Smart Inventory', icon: TrendingUp },
    { id: 'churn', label: 'Customer Retention', icon: Users },
  ];

  return (
    <section className="max-w-7xl mx-auto px-8 py-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Experience MarketMind AI in action
        </h2>
        <p className="text-slate-600 mt-3 text-base">
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
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Interactive Mock Dashboard Window */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl shadow-slate-200/60 overflow-hidden">
        {/* Mock Browser Header */}
        <div className="bg-slate-100/80 px-6 py-4 border-b border-slate-200/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="ml-4 text-xs font-mono text-slate-500">app.marketmind.ai/{activeTab}</span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
            Live Interactive Preview
          </span>
        </div>

        {/* Dynamic Tab Content */}
        <div className="p-8 min-h-[380px] bg-slate-50/50">
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
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Predicted Monthly Sales</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">₹4,82,500</p>
                    <span className="inline-flex items-center text-xs font-semibold text-emerald-600 gap-0.5 mt-2">
                      <ArrowUpRight className="w-3.5 h-3.5" /> +14.2% vs last month
                    </span>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Model Accuracy</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">96.8%</p>
                    <span className="inline-flex items-center text-xs font-semibold text-indigo-600 gap-1 mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5" /> XGBoost Trained
                    </span>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Peak Sales Day</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">Saturdays</p>
                    <span className="text-xs text-slate-500 mt-2 block">High weekend traffic predicted</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                  <h4 className="font-bold text-slate-900 text-sm mb-4">6-Month Revenue Projection</h4>
                  <div className="flex items-end gap-4 h-32 pt-4">
                    {[40, 55, 65, 80, 70, 95].map((height, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ duration: 0.5, delay: i * 0.1 }}
                          className={`w-full rounded-t-xl ${i >= 4 ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                        />
                        <span className="text-[10px] font-semibold text-slate-400">
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
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-bold text-slate-900 text-sm">Low Stock Alert Triggered</p>
                      <p className="text-xs text-slate-600">Product "Organic Green Tea" is projected to run out in 4 days.</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm">
                    Reorder 50 Units
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/60 grid grid-cols-4 text-xs font-bold text-slate-500 uppercase">
                    <span>Product</span>
                    <span>Current Stock</span>
                    <span>Reorder Point</span>
                    <span>Status</span>
                  </div>
                  <div className="divide-y divide-slate-100 text-sm">
                    <div className="px-6 py-3.5 grid grid-cols-4 items-center">
                      <span className="font-semibold text-slate-900">Espresso Roast Coffee</span>
                      <span>142 units</span>
                      <span>30 units</span>
                      <span className="text-xs font-bold text-emerald-600">Healthy</span>
                    </div>
                    <div className="px-6 py-3.5 grid grid-cols-4 items-center bg-amber-50/40">
                      <span className="font-semibold text-slate-900">Organic Green Tea</span>
                      <span className="text-amber-600 font-bold">8 units</span>
                      <span>25 units</span>
                      <span className="text-xs font-bold text-amber-600">Reorder Soon</span>
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
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm">At-Risk High Value Customers</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">Aarav Patel</p>
                        <p className="text-xs text-slate-500">Last purchased: 42 days ago</p>
                      </div>
                      <span className="px-2.5 py-1 bg-red-100 text-red-700 font-bold text-xs rounded-full">
                        84% Churn Risk
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Automated Retention Campaign</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Target churning VIPs with an automated 15% discount code via email.
                    </p>
                  </div>
                  <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-200 mt-4">
                    Send Re-engagement Promo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const fadeInUp = {
    hidden: { opacity: 0, y: 35 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/20 to-white text-slate-900 font-sans overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-8 py-5 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2.5 rounded-2xl shadow-md shadow-indigo-200">
            <TrendingUp className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">MarketMind AI</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="px-5 py-2.5 text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-full transition-all shadow-md shadow-indigo-200 hover:scale-105 active:scale-95"
          >
            Sign up
          </Link>
        </div>
      </nav>

      {/* Main Hero Section */}
      <main className="max-w-7xl mx-auto px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Side Content */}
          <motion.div
            className="space-y-8"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-sm font-medium shadow-sm">
              <Zap className="w-4 h-4 text-indigo-600 animate-bounce" /> AI-Powered Business Intelligence
            </motion.div>

            <motion.h1 variants={fadeInUp} className="text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.12] tracking-tight">
              Grow your small business with <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">smart AI insights</span>
            </motion.h1>

            <motion.p variants={fadeInUp} className="text-lg text-slate-600 max-w-lg leading-relaxed">
              MarketMind AI predicts sales trends, manages inventory shortages, and helps you keep your best customers—all from one intuitive dashboard.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/register"
                className="group px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full transition-all shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95 flex items-center gap-2 text-base"
              >
                Get Started Free 
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-full transition-all border border-slate-200/80 hover:scale-105 active:scale-95 text-base"
              >
                I already have an account
              </Link>
            </motion.div>

            <motion.div variants={fadeInUp} className="flex items-center gap-6 pt-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Fast Setup</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure OTP Auth</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Analytics Ready</span>
            </motion.div>
          </motion.div>

          {/* Right Side Interactive Light Cards */}
          <motion.div
            className="grid grid-cols-2 gap-5 relative perspective-1000"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Subtle Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-200/40 rounded-full blur-[90px] -z-10 animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-200/40 rounded-full blur-[90px] -z-10 animate-pulse" />

            <div className="space-y-5">
              <motion.div variants={fadeInUp}>
                <TiltCard className="bg-white/90 p-7 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 hover:border-indigo-300 hover:shadow-indigo-100 transition-all">
                  <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 border border-indigo-100">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-xl">Sales Forecasting</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Predict demand accurately using Machine Learning models trained on historical data.
                  </p>
                </TiltCard>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <TiltCard className="bg-white/90 p-7 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 hover:border-emerald-300 hover:shadow-emerald-100 transition-all">
                  <div className="bg-emerald-50 w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-600 mb-4 border border-emerald-100">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-xl">Smart Inventory</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Automated low-stock detection and reorder volume recommendations.
                  </p>
                </TiltCard>
              </motion.div>
            </div>

            <div className="space-y-5 pt-10">
              <motion.div variants={fadeInUp}>
                <TiltCard className="bg-white/90 p-7 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 hover:border-amber-300 hover:shadow-amber-100 transition-all">
                  <div className="bg-amber-50 w-12 h-12 rounded-2xl flex items-center justify-center text-amber-600 mb-4 border border-amber-100">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-xl">Customer Churn</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Spot churn risks early and target high-value VIP customers effectively.
                  </p>
                </TiltCard>
              </motion.div>

              {/* Floating Live AI Pulse Badge */}
              <motion.div
                variants={fadeInUp}
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-6 rounded-3xl shadow-xl shadow-indigo-200 border border-indigo-400/30"
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

        {/* Product Interactive Demo Section */}
        <InteractivePreview />
      </main>
    </div>
  );
}