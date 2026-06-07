"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Radio,
  BarChart3,
  Users,
  TrendingUp,
  Waves,
  Play,
  Sparkles,
  Activity,
  MessageSquare,
  ArrowRight,
  Menu,
  X,
  Eye,
  Signal,
  Zap,
  Target,
  LogOut,
} from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "users";
}

const LandingPage = () => {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user info on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");

        if (token && storedUser) {
          // Try to parse stored user first
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
          } catch (e) {
            console.error("Error parsing stored user:", e);
          }

          // Fetch fresh user data from API
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.data);
            localStorage.setItem("user", JSON.stringify(data.data));
          }
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/");
  };

  const getRoleBasedLink = () => {
    if (user?.role === "admin") {
      return "/dashboard";
    }
    return "/live-stream";
  };

  const getMyMeetingsLink = () => {
    if (user?.role === "users") {
      return "/my-meetings";
    }
    return "/dashboard";
  };

  const features = [
    {
      icon: <Activity className="w-8 h-8" />,
      title: "Live Stream Analytics",
      description:
        "Monitor real-time listener engagement and stream performance with advanced metrics and insights.",
      gradient: "from-purple-600 to-pink-600",
      bg: "from-purple-900/40 to-pink-900/40",
      border: "border-purple-500/30",
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Predictive Analytics",
      description:
        "AI-powered predictions help you understand audience behavior and optimize programming decisions.",
      gradient: "from-blue-600 to-cyan-600",
      bg: "from-blue-900/40 to-cyan-900/40",
      border: "border-blue-500/30",
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Engagement Tracking",
      description:
        "Track comments, likes, and shares with intelligent sentiment analysis powered by Google Gemini AI.",
      gradient: "from-pink-600 to-rose-600",
      bg: "from-pink-900/40 to-rose-900/40",
      border: "border-pink-500/30",
    },
    {
      icon: <Radio className="w-8 h-8" />,
      title: "Program Management",
      description:
        "Schedule, manage, and broadcast radio programs with comprehensive CRUD operations and scheduling.",
      gradient: "from-green-600 to-emerald-600",
      bg: "from-green-900/40 to-emerald-900/40",
      border: "border-green-500/30",
    },
  ];

  const stats = [
    {
      icon: <Users className="w-6 h-6" />,
      value: "10K+",
      label: "Active Listeners",
    },
    { icon: <Radio className="w-6 h-6" />, value: "500+", label: "Programs" },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      value: "98%",
      label: "Accuracy",
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      value: "24/7",
      label: "Live Support",
    },
  ];

  const benefits = [
    {
      icon: <Eye className="w-6 h-6" />,
      title: "Real-time Insights",
      description:
        "Get instant analytics on listener behavior and engagement patterns",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "AI-Powered",
      description:
        "Leverage Google Gemini AI for sentiment analysis and predictions",
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Data-Driven Decisions",
      description:
        "Make informed programming choices based on comprehensive analytics",
    },
    {
      icon: <Signal className="w-6 h-6" />,
      title: "Seamless Streaming",
      description:
        "Broadcast live with integrated streaming and listener tracking",
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-900">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-slate-950/95 backdrop-blur-xl border-b border-purple-500/20 shadow-2xl"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <div className="w-12 h-12 bg-linear-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50">
                  <Radio className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-950 animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">GBC Radio</h1>
              </div>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                href="#features"
                className="text-purple-200 hover:text-white transition-colors font-semibold"
              >
                Features
              </Link>
              <Link
                href="#analytics"
                className="text-purple-200 hover:text-white transition-colors font-semibold"
              >
                Analytics
              </Link>
              <Link
                href="/schedule"
                className="text-purple-200 hover:text-white transition-colors font-semibold"
              >
                Schedule Meeting
              </Link>
              <Link
                href="#about"
                className="text-purple-200 hover:text-white transition-colors font-semibold"
              >
                About
              </Link>

              {user ? (
                <div className="flex items-center gap-4">
                  <Link
                    href={getRoleBasedLink()}
                    className="px-4 py-2 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold transition-all duration-300 hover:scale-105 shadow-lg shadow-purple-500/50"
                  >
                    {user.role === "admin" ? "Dashboard" : "Live Stream"}
                  </Link>

                  <Link
                    href={getMyMeetingsLink()}
                    className="px-4 py-2 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold transition-all duration-300 hover:scale-105 shadow-lg shadow-purple-500/50"
                  >
                    {user.role === "users" ? "My meetings" : "Dashboard"}
                  </Link>

                  <div className="flex items-center gap-3 px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-xl">
                    <div className="w-9 h-9 bg-linear-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {user.firstName?.charAt(0).toUpperCase()}
                      {user.lastName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-white text-sm font-semibold">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-purple-300 text-xs">
                        {user.role === "admin" ? "Admin" : "Listener"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="p-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-red-300 hover:text-red-200 transition-all group"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push("/login")}
                  className="px-6 py-2.5 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold transition-all duration-300 hover:scale-105 shadow-lg shadow-purple-500/50"
                >
                  Login
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-purple-300 hover:text-white transition-colors"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden mt-4 py-4 border-t border-purple-500/20">
              <div className="flex flex-col gap-4">
                <a
                  href="#features"
                  className="text-purple-200 hover:text-white transition-colors font-semibold"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Features
                </a>
                <a
                  href="#analytics"
                  className="text-purple-200 hover:text-white transition-colors font-semibold"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Analytics
                </a>
                <a
                  href="#about"
                  className="text-purple-200 hover:text-white transition-colors font-semibold"
                  onClick={() => setIsMenuOpen(false)}
                >
                  About
                </a>

                {user ? (
                  <>
                    <div className="flex items-center gap-3 px-4 py-3 bg-purple-600/20 border border-purple-500/30 rounded-xl">
                      <div className="w-10 h-10 bg-linear-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                        {user.firstName.charAt(0).toUpperCase()}
                        {user.lastName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-semibold">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-purple-300 text-xs">
                          {user.role === "admin" ? "Admin" : "Listener"}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={getRoleBasedLink()}
                      className="px-6 py-3 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold text-center transition-all duration-300 shadow-lg"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {user.role === "admin"
                        ? "Go to Dashboard"
                        : "Go to Live Stream"}
                    </Link>

                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                      className="px-6 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-red-300 hover:text-red-200 font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-5 h-5" />
                      Logout
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      router.push("/login");
                      setIsMenuOpen(false);
                    }}
                    className="px-6 py-2.5 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-semibold transition-all duration-300 shadow-lg"
                  >
                    Login
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 px-6 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Text Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 text-sm font-semibold">
                  Broadcasting Analytics
                </span>
              </div>

              <h1 className="text-5xl md:text-7xl font-black leading-tight">
                <span className="text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400">
                  Transform Your
                </span>
                <br />
                <span className="text-white">Radio Broadcasting</span>
              </h1>

              <p className="text-xl text-purple-200 leading-relaxed max-w-xl">
                Harness the power of predictive analytics to understand your
                audience, optimize programming, and grow your listener base with
                real-time engagement tracking and AI-driven insights.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() =>
                    router.push(user ? getRoleBasedLink() : "/login")
                  }
                  className="group px-8 py-4 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-bold text-lg transition-all duration-300 hover:scale-105 shadow-2xl shadow-purple-500/50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {user
                    ? user.role === "admin"
                      ? "Go to Dashboard"
                      : "Start Listening"
                    : "Get Started"}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => router.push("/live-stream")}
                  className="px-8 py-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-white font-bold text-lg transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-5 h-5" />
                  Live Stream
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8">
                {stats.map((stat, index) => (
                  <div
                    key={index}
                    className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-4 text-center"
                  >
                    <div className="flex justify-center mb-2 text-purple-400">
                      {stat.icon}
                    </div>
                    <p className="text-2xl font-black text-white">
                      {stat.value}
                    </p>
                    <p className="text-xs text-purple-300 font-semibold">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side - DJ Image */}
            <div className="relative">
              <div className="relative z-10">
                <div className="aspect-square rounded-3xl overflow-hidden border-4 border-purple-500/30 shadow-2xl shadow-purple-500/50 bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl">
                  <img
                    src="/assets/hero.jpg"
                    alt="Radio DJ Broadcasting"
                    className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity duration-300"
                  />
                </div>

                {/* Floating Stats Cards */}
                <div className="absolute -top-6 -right-6 bg-linear-to-br from-green-900/90 to-emerald-900/90 backdrop-blur-xl border border-green-500/30 rounded-2xl p-4 shadow-2xl animate-float">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500/20 rounded-xl">
                      <Signal className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-green-300 text-sm font-semibold">
                        Live Now
                      </p>
                      <p className="text-2xl font-black text-white">1,247</p>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-6 -left-6 bg-linear-to-br from-blue-900/90 to-cyan-900/90 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-4 shadow-2xl animate-float delay-500">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/20 rounded-xl">
                      <TrendingUp className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-blue-300 text-sm font-semibold">
                        Engagement
                      </p>
                      <p className="text-2xl font-black text-white">+23%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Background Glow */}
              <div className="absolute inset-0 bg-linear-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl -z-10"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full mb-6">
              <Waves className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 text-sm font-semibold">
                Platform Features
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-black mb-4">
              <span className="text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400">
                Everything You Need
              </span>
              <br />
              <span className="text-white">In One Platform</span>
            </h2>
            <p className="text-xl text-purple-200 max-w-2xl mx-auto">
              Comprehensive tools for modern radio broadcasting with intelligent
              analytics and audience insights
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`group bg-linear-to-br ${feature.bg} backdrop-blur-xl border ${feature.border} rounded-3xl p-8 transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer`}
              >
                <div
                  className={`w-16 h-16 bg-linear-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 text-white shadow-lg group-hover:scale-110 transition-transform`}
                >
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-black text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-purple-200 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="analytics" className="py-24 px-6 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              <span className="text-white">Why Choose</span>
              <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400">
                GBC Radio Analytics
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="bg-linear-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-8 flex gap-6 hover:scale-105 transition-all duration-300"
              >
                <div className="shrink-0">
                  <div className="w-14 h-14 bg-linear-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    {benefit.icon}
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white mb-3">
                    {benefit.title}
                  </h3>
                  <p className="text-purple-200 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="about" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-linear-to-br from-purple-900/60 to-pink-900/60 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-12 text-center shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-black mb-6">
              <span className="text-white">Ready to Transform</span>
              <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-purple-400">
                Your Broadcasting?
              </span>
            </h2>
            <p className="text-xl text-purple-200 mb-8 max-w-2xl mx-auto">
              Join thousands of broadcasters using GBC Radio Analytics to make
              data-driven decisions and grow their audience.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() =>
                  router.push(user ? getRoleBasedLink() : "/login")
                }
                className="px-8 py-4 bg-linear-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-white font-bold text-lg transition-all duration-300 hover:scale-105 shadow-2xl shadow-purple-500/50"
              >
                {user ? "Go to Platform" : "Start Free Trial"}
              </button>
              <button
                onClick={() => router.push("/contact")}
                className="px-8 py-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-white font-bold text-lg transition-all duration-300 hover:scale-105"
              >
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-purple-500/20 py-12 px-6 bg-black/40">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-linear-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Radio className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">GBC Radio</h3>
                </div>
              </div>
              <p className="text-purple-200 mb-4 max-w-md">
                Empowering broadcasters with intelligent analytics and real-time
                insights to make data-driven decisions and grow their audience.
              </p>
              <div className="flex gap-4">
                <a
                  href="#"
                  className="w-10 h-10 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg flex items-center justify-center text-purple-300 hover:text-white transition-all"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg flex items-center justify-center text-purple-300 hover:text-white transition-all"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg flex items-center justify-center text-purple-300 hover:text-white transition-all"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-black mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#features"
                    className="text-purple-200 hover:text-white transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#analytics"
                    className="text-purple-200 hover:text-white transition-colors"
                  >
                    Analytics
                  </a>
                </li>
                <li>
                  <a
                    href="#about"
                    className="text-purple-200 hover:text-white transition-colors"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="/contact"
                    className="text-purple-200 hover:text-white transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-white font-black mb-4">Support</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="/help"
                    className="text-purple-200 hover:text-white transition-colors"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    href="/docs"
                    className="text-purple-200 hover:text-white transition-colors"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy"
                    className="text-purple-200 hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    className="text-purple-200 hover:text-white transition-colors"
                  >
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-8 text-center">
            <p className="text-purple-300">
              © 2025 GBC Radio Analytics Platform. All rights reserved.
            </p>
            <p className="text-purple-400 text-sm mt-2">
              Powered by AI • Built with ❤️ for Broadcasters
            </p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .delay-500 {
          animation-delay: 500ms;
        }

        .delay-1000 {
          animation-delay: 1000ms;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
