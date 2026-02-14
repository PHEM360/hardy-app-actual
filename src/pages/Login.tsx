import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, PawPrint, Sparkles, Anchor, Tractor, Dog, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

const SPLASH_ICONS = [
  { emoji: "🐕", delay: 0, x: "15%", y: "20%" },
  { emoji: "🚜", delay: 0.2, x: "75%", y: "15%" },
  { emoji: "⛵", delay: 0.4, x: "60%", y: "55%" },
  { emoji: "🐾", delay: 0.1, x: "25%", y: "65%" },
  { emoji: "🌾", delay: 0.3, x: "80%", y: "70%" },
  { emoji: "🐶", delay: 0.5, x: "40%", y: "30%" },
  { emoji: "🏡", delay: 0.15, x: "10%", y: "45%" },
  { emoji: "🚤", delay: 0.35, x: "85%", y: "40%" },
  { emoji: "🐑", delay: 0.25, x: "50%", y: "80%" },
  { emoji: "🌻", delay: 0.45, x: "30%", y: "85%" },
];

const FLOATING_ICONS = ["🐾", "🏡", "🐕", "🐶", "⛵", "🚜", "🌾", "🐑", "🚤", "🌻"];

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { forbidden } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Keep the splash duration in one place so we can compute stagger when
  // the splash finishes. Delays in the file are based on the original
  // splash timings; when `showSplash` becomes false we subtract the
  // splash duration so animations still stagger slightly but appear
  // immediately instead of leaving a blank screen.
  const SPLASH_DURATION = 3; // seconds

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const message = err?.message || "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative">
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-hero"
          >
            {/* Animated background icons */}
            {SPLASH_ICONS.map((item, i) => (
              <motion.div
                key={i}
                className="absolute text-4xl sm:text-5xl"
                style={{ left: item.x, top: item.y }}
                initial={{ opacity: 0, scale: 0, rotate: -180 }}
                animate={{
                  opacity: [0, 0.6, 0.6, 0],
                  scale: [0, 1.2, 1, 0.8],
                  rotate: [0, 10, -10, 0],
                  y: [0, -20, -10, 0],
                }}
                transition={{
                  duration: 2.5,
                  delay: item.delay,
                  ease: "easeInOut",
                }}
              >
                {item.emoji}
              </motion.div>
            ))}

            {/* Central logo animation */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: [0, 1.3, 1], rotate: [0, 10, 0] }}
              transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.3 }}
              className="relative z-10"
            >
              <div className="w-24 h-24 rounded-3xl bg-primary-foreground/20 backdrop-blur-md border border-primary-foreground/30 flex items-center justify-center shadow-elevated">
                <PawPrint className="w-12 h-12 text-primary-foreground" />
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="text-4xl font-bold font-display text-primary-foreground mt-6"
            >
              Hardy Hub
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="flex items-center gap-2 mt-3"
            >
              <Dog className="w-4 h-4 text-primary-foreground/60" />
              <p className="text-primary-foreground/70 text-sm">Your family, all in one place</p>
              <Anchor className="w-4 h-4 text-primary-foreground/60" />
            </motion.div>

            {/* Loading dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
              className="flex gap-1.5 mt-8"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary-foreground/50"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main login page */}
      <div className="min-h-screen flex flex-col bg-gradient-hero">
        {/* Floating background icons */}
        {FLOATING_ICONS.map((icon, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl sm:text-3xl opacity-10 pointer-events-none select-none"
            initial={{
              x: `${10 + Math.random() * 80}%`,
              y: `${Math.random() * 100}%`,
              scale: 0,
              rotate: Math.random() * 360,
            }}
            animate={{
              scale: [0, 1, 1, 0],
              y: [`${50 + Math.random() * 40}%`, `${Math.random() * 30}%`],
              rotate: [0, 360],
              opacity: [0, 0.15, 0.15, 0],
            }}
            transition={{
              duration: 8 + Math.random() * 6,
              delay: 3 + i * 0.5,
              repeat: Infinity,
              repeatDelay: Math.random() * 4,
              ease: "easeInOut",
            }}
          >
            {icon}
          </motion.div>
        ))}

        {/* Top section with logo */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.5 }}
            animate={{ opacity: showSplash ? 0 : 1, y: showSplash ? -30 : 0, scale: showSplash ? 0.5 : 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: showSplash ? 3.2 : 3.2 - SPLASH_DURATION }}
            className="text-center"
          >
            <motion.div
              initial={{ rotate: -10 }}
              animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
              transition={{ delay: showSplash ? 3.8 : 3.8 - SPLASH_DURATION, duration: 0.8, ease: "easeInOut" }}
              className="w-20 h-20 rounded-2xl bg-primary-foreground/15 backdrop-blur-sm border border-primary-foreground/20 flex items-center justify-center mx-auto mb-4 shadow-elevated"
            >
              <PawPrint className="w-9 h-9 text-primary-foreground" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: showSplash ? 0 : 1, y: showSplash ? 10 : 0 }}
              transition={{ delay: showSplash ? 3.5 : 3.5 - SPLASH_DURATION, duration: 0.5 }}
              className="text-3xl font-bold font-display text-primary-foreground"
            >
              Hardy Hub
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showSplash ? 0 : 1 }}
              transition={{ delay: showSplash ? 3.7 : 3.7 - SPLASH_DURATION }}
              className="flex items-center justify-center gap-1.5 mt-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary-foreground/60" />
              <p className="text-primary-foreground/70 text-sm">
                Your family, all in one place
              </p>
              <Sparkles className="w-3.5 h-3.5 text-primary-foreground/60" />
            </motion.div>
          </motion.div>
        </div>

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: showSplash ? 0 : 1, y: showSplash ? 80 : 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay: showSplash ? 3.4 : 3.4 - SPLASH_DURATION }}
          className="bg-card rounded-t-3xl px-6 pt-8 pb-10 shadow-elevated safe-bottom relative z-10 max-w-lg mx-auto w-full"
        >
            <motion.h2
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: showSplash ? 3.7 : 3.7 - SPLASH_DURATION }}
              className="text-lg font-semibold font-display text-card-foreground mb-6"
            >
            Welcome home 👋
          </motion.h2>

            {(forbidden || error) && (
              <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3">
                <p className="text-xs text-destructive font-medium">
                  {forbidden
                    ? "This account isn't allowed to access Hardy Hub. Please sign in with an approved email."
                    : error}
                </p>
              </div>
            )}

          <form onSubmit={handleLogin} className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: showSplash ? 3.8 : 3.8 - SPLASH_DURATION }}
              className="space-y-2"
            >
              <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@hardyhub.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-muted/50 border-border"
                required
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: showSplash ? 3.9 : 3.9 - SPLASH_DURATION }}
              className="space-y-2"
            >
              <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl bg-muted/50 border-border pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: showSplash ? 4.0 : 4.0 - SPLASH_DURATION }}
            >
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl text-sm font-semibold bg-gradient-primary hover:opacity-90 transition-opacity"
              >
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                  />
                ) : (
                  "Let me in! 🚀"
                )}
              </Button>
            </motion.div>
          </form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: showSplash ? 4.2 : 4.2 - SPLASH_DURATION }}
            className="text-center text-xs text-muted-foreground mt-6"
          >
            Private family platform · invite only 🔒
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;