# AI evals (testing LLM features)

LLM features can't be tested like deterministic code. The same input can produce different outputs across runs, and the "right" answer is often a fuzzy quality judgment, not a value match. Evals are the testing discipline that fits that shape.

The principle:

> An eval measures **how often** the system produces an acceptable output across a curated dataset. It is a **statistical** check, not a binary one.

## When you need evals

The moment any of these are true:

- A user-facing feature involves an LLM call.
- The output of an LLM determines a downstream action (tool call, route, classification).
- You're shipping a prompt, prompt template, agent, or RAG system.
- You expect to ever change the model, the prompt, or the retriever.

If you're shipping LLM behavior with no evals, the next model upgrade or prompt tweak will silently regress something — you'll find out from a customer.

## Two flavors of eval

**Capability evals** — "what can this system do well?" Pass rates start low (you're discovering capability boundaries). Drive iteration: make the prompt better, the retrieval better, the tool descriptions better.

**Regression evals** — "does this system still do what it used to?" Pass rates should stay near 100%. Run on every prompt/model/code change to catch silent backslides.

A capability eval **graduates** to a regression eval once the system reliably passes it. The regression suite grows over time.

## Build the dataset before the system

The single most common mistake: shipping the LLM feature, then trying to write evals.

Start with **20–50 real cases** drawn from:
- Real user requests (anonymized).
- Bug reports and support tickets.
- Failure modes you've hypothesized.
- Edge cases (empty input, very long input, ambiguous input, hostile input).

A good case is one **two reviewers would independently grade the same way**. If experts disagree on what "correct" means, the case is too vague to evaluate.

Keep the dataset balanced:
- Cases the system *should* handle (positive class).
- Cases the system *should refuse* or escalate (negative class).
- An imbalanced eval set leads to one-sided optimization (an agent that always says "yes" passes a yes-only dataset).

Version the dataset alongside the prompt. When you add a case, note why (which bug it captures, which capability it probes).

## Scoring: pick the cheapest method that works

Three options, in increasing cost and decreasing scalability:

### Programmatic graders

A function checks the output. Fast, deterministic, free.

Use when:
- The task has a checkable structured output (JSON shape, classification label, tool name + arguments).
- Substring/regex match is sufficient ("answer contains the order ID").
- You can encode the rule as code.

Examples:
- "Did the agent call the right tool?" → `output.tool_name === 'lookup_order'`
- "Did the JSON output validate against the schema?" → schema check
- "Is the answer one of these 3 labels?" → set membership

Programmatic graders are brittle to valid variations ("Hello!" vs "Hi!"). Use them where exact shape matters; otherwise use a judge.

### LLM-as-judge

A second model grades the output against a rubric. Cheap relative to humans, scales to thousands of cases.

When it works:
- The grading criterion is expressible in plain language ("does the answer cite the source?", "does the response refuse the unsafe request?").
- Pairwise comparison ("which of A and B better answers the question?") is more reliable than absolute scoring ("is this a 7 or 8?"). Pairwise correlates better with human judgment.

How to use it well:
- **Calibrate against humans.** Hand-grade 20–50 cases yourself; check the judge agrees. If agreement is < ~80%, the rubric or judge isn't trustworthy yet — refine the rubric or pick a stronger judge model.
- **Use a strong judge.** Don't grade Opus output with Haiku. The judge needs to be at least as capable as the judged.
- **Low temperature on the judge.** You want consistent grading, not creative grading.
- **Show the rubric explicitly.** "Score 1–5 on relevance" without a rubric drifts; "1 = doesn't answer the question, 3 = partially, 5 = fully addresses with cited evidence" is reproducible.
- **Watch for known judge biases**: position bias (prefers first answer), length bias (prefers longer), self-preference (LLM judges its own family more highly). Mitigate: randomize position, normalize length, use a judge from a different family.

### Human grading

Gold standard. Slow and expensive. Use when:
- Rubric is fuzzy enough that no LLM judge passes calibration.
- You need ground truth to build/calibrate a judge.
- The decision is high-stakes enough that an automated grade isn't trusted.

Always read transcripts of a sample, even when you primarily use auto-graders. **You won't know if your auto-graders work unless you read the transcripts.**

## What to grade

Grade the **output**, not the path:

- For an answering system: was the answer correct? Did it cite sources?
- For an agent with tools: did it accomplish the task? Did it avoid forbidden actions? Did it escalate when it should have?
- For a RAG system: did it retrieve relevant chunks? Did it ground its answer in the chunks?

Don't grade "did it use exactly these intermediate steps" unless the steps are themselves the product. Step-checking penalizes correct creative solutions and over-fits to one path.

## Metrics worth tracking

- **Pass rate** on the regression set. Should stay near 100%; alert on drops.
- **Pass rate** on the capability set. Track over time; drives roadmap.
- **Per-category breakdown.** Overall 92% can hide "fails 100% on the auth-question category."
- **Latency p50/p95.** Quality without latency is half a measurement.
- **Cost per task.** Tokens × price. A 10-point quality gain at 5x cost is a different decision than at 1.1x.
- **Refusal / abstention rate.** Especially for safety-relevant systems. Both "refuses too often" and "refuses too rarely" are failures.

## When to run evals

- **On every PR that touches the prompt, the model version, the retrieval pipeline, or any code in the LLM call path.** Block merge on regression-set failures.
- **On every model upgrade.** Always. New models change behavior in unexpected ways.
- **Nightly** on a larger random sample of production traffic (replayed against the new system, or scored separately).
- **Continuously in production** — sample real outputs and grade them. The eval set goes stale; production traffic doesn't.

## Traceability

Each eval result links back to:
- The exact prompt version.
- The model and version.
- The retrieval/tool config.
- The dataset version.
- The grader version (rubric or code).

Without traceability, "the eval score dropped" tells you nothing about *why*. With it, you can bisect.

## Anti-patterns

- **The eval set is the system's training/few-shot data.** You're measuring memorization, not capability. Keep eval data strictly out of any prompt or fine-tune.
- **One number to rule them all.** A single "quality score" hides the categories where you regressed. Always disaggregate.
- **The judge model is weaker than the model under test.** Grades are noise.
- **The dataset never changes.** Real failure modes evolve with the product. Add cases from production failures monthly.
- **Eval runs are slow / expensive enough to skip.** If you skip them, they don't exist. Cache aggressively, batch where possible, sample for speed during iteration and run full suite on merge.
- **Scoring open-ended generation with absolute scores.** Use pairwise comparisons or specific checkable criteria; absolute "is this a 7?" judgments are noisy.
- **Treating evals as one-time validation.** Evals are a continuous practice, not a release-time checkbox.
