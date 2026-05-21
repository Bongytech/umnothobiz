import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck, RefreshCw, Users } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-950 text-gray-300 flex flex-col">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-dark-950/80 backdrop-blur-md border-b border-white/5 z-50 flex justify-between items-center px-6 md:px-12">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-full bg-umnotho flex items-center justify-center text-dark-950 font-bold text-xl">U</div>
          <span className="text-xl font-display font-bold text-white tracking-tight">Umnotho</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/pricing')}
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Pricing
          </button>
          <button 
            onClick={() => navigate('/auth')}
            className="text-sm font-medium px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-white"
          >
            Log in
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-32 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-umnotho/10 text-umnotho text-xs font-semibold tracking-wide uppercase mb-8 border border-umnotho/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-umnotho opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-umnotho"></span>
            </span>
            The New Economy
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white leading-[1.1] mb-6">
            No money? <span className="text-transparent bg-clip-text bg-gradient-to-r from-umnotho to-umnotho-hover">No problem.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Join a community-powered marketplace where value is created through exchange, not currency. Get what you need, give what you can.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/auth')}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-umnotho text-dark-950 font-semibold text-lg hover:bg-umnotho-hover transition-all flex items-center justify-center gap-2 group"
            >
              Start Trading
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => navigate('/pricing')}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-transparent text-white font-semibold text-lg border border-white/20 hover:bg-white/5 transition-all"
            >
              View Plans
            </button>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-32 text-left"
        >
          <div className="p-8 rounded-3xl bg-dark-900 border border-white/5 hover:border-umnotho/30 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-umnotho/10 flex items-center justify-center mb-6">
              <RefreshCw className="w-6 h-6 text-umnotho" />
            </div>
            <h3 className="text-xl font-display font-semibold text-white mb-3">Seamless Bartering</h3>
            <p className="text-gray-400 leading-relaxed">
              Post items or services for exchange with ease. Start a trade with a bid and negotiate directly.
            </p>
          </div>
          <div className="p-8 rounded-3xl bg-dark-900 border border-white/5 hover:border-umnotho/30 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-umnotho/10 flex items-center justify-center mb-6">
              <ShieldCheck className="w-6 h-6 text-umnotho" />
            </div>
            <h3 className="text-xl font-display font-semibold text-white mb-3">Secure & Trusted</h3>
            <p className="text-gray-400 leading-relaxed">
              Verified accounts and a robust reputation system ensure you trade with confidence.
            </p>
          </div>
          <div className="p-8 rounded-3xl bg-dark-900 border border-white/5 hover:border-umnotho/30 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-umnotho/10 flex items-center justify-center mb-6">
              <Users className="w-6 h-6 text-umnotho" />
            </div>
            <h3 className="text-xl font-display font-semibold text-white mb-3">Community Powered</h3>
            <p className="text-gray-400 leading-relaxed">
              Connect with locals, build relationships, and empower your community through cashless trading.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default LandingPage;
