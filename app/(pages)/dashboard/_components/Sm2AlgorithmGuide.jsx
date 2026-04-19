'use client';

export default function Sm2AlgorithmGuide() {
  return (
    <div className="brand-card overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-indigo-600 to-violet-500" />
      <div className="p-6 sm:p-8 space-y-10 max-w-4xl mx-auto">
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
            Spaced repetition
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 font-poppins">
            How SM-2 scheduling works here
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
            Your <strong>Study Calendar</strong> shows when questions are due. Each review updates an{' '}
            <strong>easiness factor (EF)</strong> and the <strong>interval</strong> (days until the next review)
            using an <strong>SM-2–style</strong> algorithm: quality from your answer and speed adjusts difficulty and
            spacing over time.
          </p>
        </header>

        {/* Parameter 1: Quality */}
        <section className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 mb-1">
              Parameter 1
            </p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Quality score (q)</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              After you answer, the app maps <strong>correctness</strong> and{' '}
              <strong>response time</strong> (seconds) to a quality score <strong>q</strong> from 0–5. That score
              drives both EF and the next interval.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QualityCard
              tone="green"
              title="5 — Strong"
              condition="Correct, ≤ 10 seconds"
              body="Highest quality. EF increases the most."
              efNote="EF +0.10 (from formula)"
            />
            <QualityCard
              tone="amber"
              title="4 — Solid"
              condition="Correct, &gt; 10 s and ≤ 20 s"
              body="Good recall with a short pause. EF changes modestly."
              efNote="EF +0.00 (from formula)"
            />
            <QualityCard
              tone="orange"
              title="3 — Hesitant"
              condition="Correct, &gt; 20 seconds"
              body="Slower recall. EF decreases — you’ll see the card sooner."
              efNote="EF −0.14 (from formula)"
            />
            <QualityCard
              tone="red"
              title="0 — Wrong"
              condition="Incorrect"
              body="Interval resets to 1 day and repetitions reset to 0. EF still updates using the formula with q = 0 (it usually decreases)."
              efNote="Interval → 1 day · reps → 0"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Scheduling uses the seconds above (measured in the quiz from when the question finishes rendering until you
            tap an answer). The on-screen timer reflects that same clock.
          </p>
        </section>

        {/* Parameter 2: EF */}
        <section className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 mb-1">
              Parameter 2
            </p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Easiness factor (EF)</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Every question starts with <strong>EF = 2.5</strong>. After <strong>every</strong> review, EF is updated
              with the formula below using your quality <strong>q</strong>. A <strong>higher EF</strong> means easier
              items — intervals grow faster after the first two successful steps. A <strong>lower EF</strong> means
              harder items. <strong>EF never drops below 1.3</strong>.
            </p>
          </div>

          <div className="rounded-xl border brand-border bg-gray-50 dark:bg-white/5 px-4 py-5 text-center space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Easiness factor update (every review)
            </p>
            <p className="font-mono text-sm sm:text-base text-gray-900 dark:text-gray-100 break-all">
              EF&apos; = EF + 0.1 − (5 − q) × (0.08 + (5 − q) × 0.02)
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              EF = current easiness · q = quality (0–5) · minimum EF = 1.3
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ExampleCard label="Quality 5" expr="2.5 + 0.1 − (0)×(0.08 + (5 − 0) × 0.02)" result="2.6" resultClass="text-green-700 dark:text-green-300" />
            <ExampleCard label="Quality 4" expr="2.5 + 0.1 − (1)×(0.08 + (1) x 0.02)" result="2.50" resultClass="text-amber-700 dark:text-amber-200" />
            <ExampleCard label="Quality 3" expr="2.5 + 0.1 − (2)×(0.08 + (2) x 0.02)" result="2.36" resultClass="text-orange-700 dark:text-orange-200" />
          </div>
        </section>

        {/* Parameter 3: Interval */}
        <section className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 mb-1">
              Parameter 3
            </p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Interval (days until next review)</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              The interval is how many days we add to today to get your next due date. The rules are:
            </p>
          </div>

          <ol className="rounded-xl border brand-border bg-gray-50 dark:bg-white/5 p-4 sm:p-5 space-y-3 text-sm text-gray-700 dark:text-gray-300 list-none">
            <RuleRow
              n={1}
              title="First correct answer (repetitions was 0)"
              detail="Interval = 1 day (review tomorrow)."
            />
            <RuleRow
              n={2}
              title="Second correct answer in a row (repetitions was 1)"
              detail="Interval = 6 days (fixed second step)."
            />
            <RuleRow
              n={3}
              title="Third+ correct answer (repetitions ≥ 2)"
              detail="Interval = round(previous interval × previous EF)."
            />
            <RuleRow
              n="!"
              title="Wrong answer (q &lt; 3)"
              detail="Repetitions reset to 0. Interval = 1 day — you start the ladder again."
            />
          </ol>

          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
              How intervals grow if you keep answering correctly (EF stays 2.5 for illustration)
            </h4>
            <div className="space-y-2">
              <GrowthRow label="1st review" value="1d" note="Fixed: 1 day" widthPct={8} />
              <GrowthRow label="2nd review" value="6d" note="Fixed: 6 days" widthPct={22} />
              <GrowthRow label="3rd review" value="15d" note="round(6 × 2.5)" widthPct={45} />
              <GrowthRow label="4th review" value="38d" note="round(15 × 2.5)" widthPct={72} />
              <GrowthRow label="5th review" value="95d" note="round(38 × 2.5)" widthPct={100} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              In real use, EF changes after each success, so these numbers will differ slightly from this idealized
              example.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function QualityCard({ tone, title, condition, body, efNote }) {
  const tones = {
    green: 'border-green-200 bg-green-50/80 dark:bg-green-500/10 dark:border-green-500/25',
    amber: 'border-amber-200 bg-amber-50/80 dark:bg-amber-500/10 dark:border-amber-500/25',
    orange: 'border-orange-200 bg-orange-50/80 dark:bg-orange-500/10 dark:border-orange-500/25',
    red: 'border-red-200 bg-red-50/80 dark:bg-red-500/10 dark:border-red-500/25',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <h4 className="font-bold text-gray-900 dark:text-gray-100">{title}</h4>
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-1">{condition}</p>
      <p className="text-sm text-gray-700 dark:text-gray-200 mt-2 leading-relaxed">{body}</p>
      <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mt-2">{efNote}</p>
    </div>
  );
}

function ExampleCard({ label, expr, result, resultClass }) {
  return (
    <div className="rounded-xl border brand-border bg-white dark:bg-gray-950 p-4 text-center">
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{label}</p>
      <p className="text-xs font-mono text-gray-600 dark:text-gray-300 mt-2 break-all">{expr}</p>
      <p className={`text-2xl font-black mt-2 ${resultClass}`}>{result}</p>
    </div>
  );
}

function RuleRow({ n, title, detail }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
        {n}
      </span>
      <div>
        <p className="font-semibold text-gray-900 dark:text-gray-100">{title}</p>
        <p className="text-gray-600 dark:text-gray-300 mt-0.5">{detail}</p>
      </div>
    </li>
  );
}

function GrowthRow({ label, value, note, widthPct }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0 text-xs font-semibold text-gray-600 dark:text-gray-400">{label}</div>
      <div className="flex-1 min-w-0">
        <div className="h-9 rounded-lg bg-gray-100 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full min-w-[2.75rem] max-w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-500 flex items-center justify-center px-1.5"
            style={{ width: `${widthPct}%` }}
          >
            <span className="text-xs font-bold text-white drop-shadow-sm whitespace-nowrap">{value}</span>
          </div>
        </div>
      </div>
      <div className="w-36 shrink-0 text-xs text-gray-500 dark:text-gray-400 text-right hidden sm:block">{note}</div>
    </div>
  );
}
