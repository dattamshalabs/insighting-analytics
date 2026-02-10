"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let success: boolean;
      if (isRegister) {
        success = await register(email, password);
        if (!success) {
          setError("Registration failed. Email may already be in use.");
        }
      } else {
        success = await login(email, password);
        if (!success) {
          setError("Invalid email or password");
        }
      }

      if (success) {
        router.push("/");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="absolute top-[-30%] left-[-15%] w-[700px] h-[700px] rounded-full bg-brand-600/8 blur-[150px] animate-float" />
      <div className="absolute bottom-[-30%] right-[-15%] w-[600px] h-[600px] rounded-full bg-purple-600/6 blur-[150px] animate-float" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-brand-500/4 blur-[100px] animate-float" style={{ animationDelay: "3s" }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`glass-card p-8 w-full max-w-sm relative z-10 ${error ? "animate-shake" : ""}`}
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center mb-4 shadow-glow">
            <SparklesIcon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">
            Insighting
          </h1>
          <p className="text-sm text-zinc-600 mt-1">AI Analytics Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-glass w-full"
              placeholder="Enter your email"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-glass w-full"
              placeholder="Enter password"
              required
              minLength={8}
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-xs text-center"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isRegister ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            {isRegister ? "Already have an account? Sign in" : "Need an account? Register"}
          </button>
        </div>

        {/* Demo credentials hint */}
        <div className="mt-6 p-3 bg-surface-200/50 rounded-lg border border-white/[0.04]">
          <p className="text-[10px] text-zinc-500 text-center mb-2">Demo Credentials</p>
          <div className="text-[10px] text-zinc-600 space-y-1">
            <p><span className="text-zinc-500">User:</span> demo@insighting.ai / demo2024!</p>
            <p><span className="text-zinc-500">Admin:</span> admin@insighting.ai / admin2024!</p>
          </div>
        </div>

        <p className="text-[10px] text-zinc-700 text-center mt-4">
          Powered by Ollama
        </p>
      </motion.div>
    </div>
  );
}
