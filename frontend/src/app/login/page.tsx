"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate a brief delay for UX
    await new Promise((r) => setTimeout(r, 300));
    if (login(username, password)) {
      router.push("/");
    } else {
      setError(true);
      setLoading(false);
      setTimeout(() => setError(false), 600);
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
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-glass w-full"
              placeholder="Enter username"
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
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-xs text-center"
            >
              Invalid credentials
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="text-[10px] text-zinc-700 text-center mt-6">
          Powered by Ollama
        </p>
      </motion.div>
    </div>
  );
}
