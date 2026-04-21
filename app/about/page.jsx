'use client';

import Image from 'next/image';
import Link from 'next/link';
import ThemeToggle from '../_components/ThemeToggle';
import { useState, useEffect, useRef } from 'react';

// Animated counter hook
function useCountUp(target, duration = 2000, startOnView = true) {
    const [count, setCount] = useState(0);
    const [hasStarted, setHasStarted] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!startOnView) {
            setHasStarted(true);
            return;
        }
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasStarted) {
                    setHasStarted(true);
                }
            },
            { threshold: 0.3 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [hasStarted, startOnView]);

    useEffect(() => {
        if (!hasStarted) return;
        let start = 0;
        const increment = target / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                setCount(target);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, 16);
        return () => clearInterval(timer);
    }, [hasStarted, target, duration]);

    return { count, ref };
}

// Fade-in on scroll component
function FadeInSection({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setIsVisible(true);
            },
            { threshold: 0.15 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`transition-all duration-700 ${className}`}
            style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
                transitionDelay: `${delay}ms`,
            }}
        >
            {children}
        </div>
    );
}

export default function AboutPage() {
    const stat1 = useCountUp(70, 2000);
    const stat2 = useCountUp(10, 1500);
    const stat3 = useCountUp(20, 1800);

    const steps = [
        {
            num: '01',
            title: 'Upload Your Notes',
            desc: 'Drop any PDF — lecture slides, handouts, textbook chapters. That\'s all you need to start.',
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
            ),
        },
        {
            num: '02',
            title: 'AI Creates Your Quiz',
            desc: 'Google\'s most advanced AI reads your entire document and generates 20 smart questions — in seconds.',
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
            ),
        },
        {
            num: '03',
            title: 'Study & Get Graded',
            desc: 'Answer questions at your own pace. The system tracks both your accuracy and how fast you respond.',
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
        {
            num: '04',
            title: 'Smart Reminders',
            desc: 'RemindED schedules your next review at the perfect moment — right before you\'d forget. Every plan is unique to you.',
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
            ),
        },
    ];

    const features = [
        {
            title: 'AI-Powered Questions',
            desc: 'No more spending hours making flashcards. Our AI reads your material and creates quiz questions in seconds — not minutes.',
        },
        {
            title: 'Speed-Aware Grading',
            desc: 'We don\'t just check right or wrong. A fast, confident answer and a slow, hesitant guess are graded differently — for smarter scheduling.',
        },
        {
            title: 'Personalized Scheduling',
            desc: 'Every student gets a unique review calendar based on their actual performance. The system adapts to YOUR brain, not the other way around.',
        },
        {
            title: 'Works Everywhere',
            desc: 'Phone, tablet, laptop — any device with a browser. No downloads, no installations. Just open and study.',
        },
        {
            title: 'Beautiful Study Calendar',
            desc: 'See your entire review plan at a glance. Know exactly what\'s coming up, for which course, on which day.',
        },
    ];

    return (
        <div className="min-h-screen brand-background overflow-hidden">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-neutral-50/80 dark:bg-neutral-900/80 border-b border-neutral-200/50 dark:border-neutral-700/50">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 group">
                        <Image src="/logo.png" alt="RemindED" width={36} height={36} className="group-hover:scale-110 transition-transform duration-300" />
                        <span className="font-poppins font-bold text-lg text-brand-gradient">
                            RemindED
                        </span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <Link
                            href="/"
                            className="px-5 py-2 rounded-full text-sm font-inter font-semibold text-white bg-brand-gradient hover:brightness-110 transition-all duration-300 shadow-lg shadow-[#2C1D78]/25 hover:shadow-[#2C1D78]/35 hover:scale-105"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
                {/* Animated background gradient */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#2C1D78]/20 via-[#9A87C6]/15 to-[#499BAC]/20 blur-3xl animate-pulse" />
                    <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[#499BAC]/15 via-[#9A87C6]/12 to-[#2C1D78]/18 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>

                <div className="relative max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm font-inter font-medium mb-8 border border-indigo-200/50 dark:border-indigo-700/50">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        Powered by Google Gemini AI
                    </div>

                    <h1 className="font-poppins font-bold text-4xl md:text-6xl lg:text-7xl leading-tight brand-primary mb-6">
                        Study smarter.{' '}
                        <span className="text-brand-gradient">
                            Remember longer.
                        </span>
                    </h1>

                    <p className="font-inter text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        RemindED reads your study materials, creates smart quizzes with AI, and tells you exactly when to review — so you never forget what you learn.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/"
                            className="px-8 py-3.5 rounded-xl text-base font-inter font-semibold text-white bg-brand-gradient hover:brightness-110 transition-all duration-300 shadow-xl shadow-[#2C1D78]/30 hover:shadow-[#2C1D78]/45 hover:scale-105 hover:-translate-y-0.5"
                        >
                            Start Studying for Free →
                        </Link>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 px-6 border-y border-neutral-200/50 dark:border-neutral-700/30 bg-gradient-to-b from-transparent via-[#9A87C6]/12 dark:via-[#2C1D78]/15 to-transparent">
                <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div ref={stat1.ref}>
                        <div className="font-poppins font-bold text-5xl md:text-6xl text-brand-gradient">
                            {stat1.count}%
                        </div>
                        <p className="mt-2 text-sm font-inter text-gray-500 dark:text-gray-400">
                            of learning is forgotten within 24 hours without review
                        </p>
                    </div>
                    <div ref={stat2.ref}>
                        <div className="font-poppins font-bold text-5xl md:text-6xl text-brand-gradient">
                            {stat2.count}s
                        </div>
                        <p className="mt-2 text-sm font-inter text-gray-500 dark:text-gray-400">
                            to generate a complete quiz from any PDF
                        </p>
                    </div>
                    <div ref={stat3.ref}>
                        <div className="font-poppins font-bold text-5xl md:text-6xl text-brand-gradient">
                            {stat3.count}
                        </div>
                        <p className="mt-2 text-sm font-inter text-gray-500 dark:text-gray-400">
                            smart questions per upload, at different thinking levels
                        </p>
                    </div>
                </div>
            </section>

            {/* The Problem Section */}
            <section className="py-20 md:py-28 px-6">
                <div className="max-w-4xl mx-auto">
                    <FadeInSection>
                        <div className="text-center mb-16">
                            <h2 className="font-poppins font-bold text-3xl md:text-4xl brand-primary mb-4">
                                The problem with studying today
                            </h2>
                            <p className="font-inter text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto">
                                You read your notes. You feel ready. Then the exam comes, and your mind goes blank. Sound familiar?
                            </p>
                        </div>
                    </FadeInSection>

                    <div className="grid md:grid-cols-3 gap-6">
                        <FadeInSection delay={100}>
                            <div className="p-6 rounded-2xl bg-red-50/80 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
                                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-4">
                                    <Image src="/rate_down.png" alt="Forgetting" width={28} height={28} />
                                </div>
                                <h3 className="font-poppins font-semibold text-lg brand-primary mb-2">You Forget Fast</h3>
                                <p className="font-inter text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                    Research shows you lose up to 70% of what you learn within a day if you don't review it at the right time.
                                </p>
                            </div>
                        </FadeInSection>

                        <FadeInSection delay={200}>
                            <div className="p-6 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-4">
                                    <Image src="/cram.png" alt="Cramming" width={28} height={28} />
                                </div>
                                <h3 className="font-poppins font-semibold text-lg brand-primary mb-2">Cramming Doesn't Work</h3>
                                <p className="font-inter text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                    Pulling all-nighters before exams creates short-term memory — not actual learning. It fades within days.
                                </p>
                            </div>
                        </FadeInSection>

                        <FadeInSection delay={300}>
                            <div className="p-6 rounded-2xl bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/30">
                                <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center mb-4">
                                    <Image src="/poor_exam.png" alt="Poor results" width={28} height={28} />
                                </div>
                                <h3 className="font-poppins font-semibold text-lg brand-primary mb-2">No Study Plan</h3>
                                <p className="font-inter text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                    Most students don't know what to review, when to review it, or how to prioritize their limited time.
                                </p>
                            </div>
                        </FadeInSection>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="py-20 md:py-28 px-6 bg-gradient-to-b from-[#9A87C6]/8 dark:from-[#2C1D78]/12 to-transparent">
                <div className="max-w-5xl mx-auto">
                    <FadeInSection>
                        <div className="text-center mb-16">
                            <h2 className="font-poppins font-bold text-3xl md:text-4xl brand-primary mb-4">
                                How RemindED works
                            </h2>
                            <p className="font-inter text-gray-500 dark:text-gray-400 text-lg max-w-xl mx-auto">
                                Four simple steps. No complicated setup. Just upload and start studying.
                            </p>
                        </div>
                    </FadeInSection>

                    <div className="grid md:grid-cols-2 gap-8">
                        {steps.map((step, i) => (
                            <FadeInSection key={step.num} delay={i * 150}>
                                <div className="group relative p-8 rounded-2xl bg-white/60 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/40 backdrop-blur-sm hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-500 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1">
                                    {/* Step number */}
                                    <span className="absolute top-6 right-6 font-poppins font-bold text-5xl text-indigo-100 dark:text-indigo-900/50 select-none group-hover:text-indigo-200 dark:group-hover:text-indigo-800/50 transition-colors">
                                        {step.num}
                                    </span>

                                    <div className="w-14 h-14 rounded-2xl bg-brand-gradient-br flex items-center justify-center text-white mb-5 shadow-lg shadow-[#2C1D78]/25 group-hover:scale-110 transition-transform duration-300">
                                        {step.icon}
                                    </div>

                                    <h3 className="font-poppins font-semibold text-xl brand-primary mb-3">
                                        {step.title}
                                    </h3>
                                    <p className="font-inter text-gray-600 dark:text-gray-400 leading-relaxed">
                                        {step.desc}
                                    </p>
                                </div>
                            </FadeInSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* Science Behind It Section */}
            <section className="py-20 md:py-28 px-6">
                <div className="max-w-4xl mx-auto">
                    <FadeInSection>
                        <div className="relative p-8 md:p-12 rounded-3xl bg-brand-gradient-br text-white overflow-hidden">
                            {/* Decorative elements */}
                            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-1/3 -translate-x-1/3" />

                            <div className="relative">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white/90 text-sm font-inter font-medium mb-6 border border-white/10">
                                    🧬 The Science
                                </div>

                                <h2 className="font-poppins font-bold text-2xl md:text-3xl mb-4">
                                    Powered by spaced repetition — the most proven study method in cognitive science
                                </h2>

                                <p className="font-inter text-white/80 text-base md:text-lg leading-relaxed mb-6">
                                    Spaced repetition works by reviewing information at increasing intervals. Instead of reviewing everything every day, you review each topic right before you're about to forget it — locking it into long-term memory.
                                </p>

                                <div className="grid sm:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                                        <div className="font-poppins font-bold text-2xl mb-1">Day 1</div>
                                        <p className="font-inter text-sm text-white/70">First review after learning</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                                        <div className="font-poppins font-bold text-2xl mb-1">Day 6</div>
                                        <p className="font-inter text-sm text-white/70">Second review if correct</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                                        <div className="font-poppins font-bold text-2xl mb-1">Day 15+</div>
                                        <p className="font-inter text-sm text-white/70">Intervals keep growing</p>
                                    </div>
                                </div>

                                <p className="font-inter text-white/60 text-sm mt-6">
                                    RemindED uses the SM-2 algorithm — the same method used by researchers worldwide — enhanced with speed-aware grading for even better accuracy.
                                </p>
                            </div>
                        </div>
                    </FadeInSection>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 md:py-28 px-6">
                <div className="max-w-5xl mx-auto">
                    <FadeInSection>
                        <div className="text-center mb-16">
                            <h2 className="font-poppins font-bold text-3xl md:text-4xl brand-primary mb-4">
                                Everything you need to study better
                            </h2>
                            <p className="font-inter text-gray-500 dark:text-gray-400 text-lg max-w-xl mx-auto">
                                Built with the latest technology. Designed with students in mind.
                            </p>
                        </div>
                    </FadeInSection>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((feature, i) => (
                            <FadeInSection key={feature.title} delay={i * 100}>
                                <div className="group p-6 rounded-2xl bg-white/60 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/40 backdrop-blur-sm hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-500 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 h-full">
                                    <div className="w-10 h-10 rounded-xl bg-brand-gradient-br flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    </div>
                                    <h3 className="font-poppins font-semibold text-lg brand-primary mb-2">
                                        {feature.title}
                                    </h3>
                                    <p className="font-inter text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                        {feature.desc}
                                    </p>
                                </div>
                            </FadeInSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* Comparison Section */}
            <section className="py-20 md:py-28 px-6 bg-gradient-to-b from-transparent via-neutral-100/50 dark:via-neutral-800/20 to-transparent">
                <div className="max-w-4xl mx-auto">
                    <FadeInSection>
                        <div className="text-center mb-12">
                            <h2 className="font-poppins font-bold text-3xl md:text-4xl brand-primary mb-4">
                                Traditional study vs RemindED
                            </h2>
                        </div>
                    </FadeInSection>

                    <FadeInSection delay={200}>
                        <div className="overflow-x-auto rounded-2xl border border-neutral-200/60 dark:border-neutral-700/40">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-neutral-100/80 dark:bg-neutral-800/60">
                                        <th className="p-4 text-left font-poppins font-semibold brand-primary text-sm"></th>
                                        <th className="p-4 text-center font-poppins font-semibold text-gray-400 text-sm">Traditional</th>
                                        <th className="p-4 text-center font-poppins font-semibold text-sm text-brand-gradient">RemindED</th>
                                    </tr>
                                </thead>
                                <tbody className="font-inter text-sm">
                                    {[
                                        ['Making review material', '1–3 hours', '~10 seconds'],
                                        ['Knowing what to review', 'Guesswork', 'AI decides for you'],
                                        ['Knowing when to review', 'Cramming before exams', 'Scheduled automatically'],
                                        ['Tracking your progress', 'None', 'Full dashboard & stats'],
                                        ['Study plan', 'Generic for everyone', 'Personalized to you'],
                                    ].map(([label, trad, reminded], i) => (
                                        <tr key={i} className="border-t border-neutral-200/40 dark:border-neutral-700/30">
                                            <td className="p-4 font-medium brand-primary">{label}</td>
                                            <td className="p-4 text-center text-gray-400">{trad}</td>
                                            <td className="p-4 text-center font-semibold text-indigo-600 dark:text-indigo-400">{reminded}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </FadeInSection>
                </div>
            </section>

            {/* Built With Section */}
            <section className="py-20 md:py-28 px-6">
                <div className="max-w-4xl mx-auto">
                    <FadeInSection>
                        <div className="text-center mb-12">
                            <h2 className="font-poppins font-bold text-3xl md:text-4xl brand-primary mb-4">
                                Built on trusted technology
                            </h2>
                            <p className="font-inter text-gray-500 dark:text-gray-400 text-lg max-w-xl mx-auto">
                                We use the same platforms trusted by Netflix, Facebook, and Google.
                            </p>
                        </div>
                    </FadeInSection>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { name: 'Google Gemini', role: 'AI Engine' },
                            { name: 'Next.js', role: 'Web Framework' },
                            { name: 'Supabase', role: 'Auth & Storage' },
                            { name: 'Turso', role: 'Database' },
                        ].map((tech, i) => (
                            <FadeInSection key={tech.name} delay={i * 100}>
                                <div className="p-5 rounded-2xl bg-white/60 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/40 text-center hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300 hover:-translate-y-1">
                                    <div className="w-12 h-12 mx-auto rounded-xl bg-brand-gradient-br flex items-center justify-center text-white mb-3 shadow-lg text-sm font-bold font-poppins">
                                        {tech.name.charAt(0)}
                                    </div>
                                    <div className="font-poppins font-semibold text-sm brand-primary">{tech.name}</div>
                                    <div className="font-inter text-xs text-gray-500 dark:text-gray-400 mt-1">{tech.role}</div>
                                </div>
                            </FadeInSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 md:py-28 px-6">
                <FadeInSection>
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="font-poppins font-bold text-3xl md:text-5xl brand-primary mb-6">
                            Ready to{' '}
                            <span className="text-brand-gradient">
                                remember more?
                            </span>
                        </h2>
                        <p className="font-inter text-lg text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto">
                            Join students who are studying smarter — not harder. Upload your first PDF and start in seconds.
                        </p>
                        <Link
                            href="/"
                            className="inline-flex px-10 py-4 rounded-xl text-lg font-inter font-semibold text-white bg-brand-gradient hover:brightness-110 transition-all duration-300 shadow-xl shadow-[#2C1D78]/30 hover:shadow-[#2C1D78]/45 hover:scale-105 hover:-translate-y-0.5"
                        >
                            Start Studying for Free →
                        </Link>
                        <p className="mt-4 font-inter text-sm text-gray-400">
                            No credit card required · Sign in with Google · Works on any device
                        </p>
                    </div>
                </FadeInSection>
            </section>

            {/* Footer */}
            <footer className="py-10 px-6 border-t border-neutral-200/50 dark:border-neutral-700/30">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Image src="/logo.png" alt="RemindED" width={24} height={24} />
                        <span className="font-poppins font-semibold text-sm brand-primary">RemindED</span>
                    </div>
                    <p className="font-inter text-sm text-gray-400">
                        © {new Date().getFullYear()} RemindED. Study smarter, remember longer.
                    </p>
                </div>
            </footer>
        </div>
    );
}
