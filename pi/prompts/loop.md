---
description: Iterate on a task until acceptance criteria are met (TDD-style loop)
argument-hint: "<task or acceptance criteria>"
---
You are running an iterative loop on the following task. Do NOT stop after one attempt — keep iterating until every acceptance criterion below is satisfied or you genuinely cannot make progress.

<TASK>
$ARGUMENTS
</TASK>

## Loop protocol

For each iteration:

1. **Restate** the current acceptance criteria as a checklist.
2. **Plan** the smallest change that moves at least one unchecked item toward done.
3. **Apply** the change. If code is involved, write/update the test FIRST, then the implementation.
4. **Verify** by running the relevant tests, linter, type-checker, or manual smoke check. Show the actual output.
5. **Reflect** in 1–3 lines: what passed, what failed, what's next.
6. If anything is still failing or unchecked, GO TO 2. Do not summarize and stop.

## Stop conditions

Only stop when one of these is true, and say which one:

- ✅ All acceptance criteria pass and verification output is clean.
- 🛑 You hit an external blocker (missing credentials, ambiguous requirement, broken upstream dependency). State exactly what you need from the user.
- 🔁 You've made the same kind of fix 3 times in a row without progress. Stop and ask for direction.

Begin iteration 1 now.
