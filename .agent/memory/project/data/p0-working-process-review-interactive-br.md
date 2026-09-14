# p0-working-process-review-interactive-br

**P0 — Working-process review (INTERACTIVE — Brad at the keyboard, not agent work)**
  (added 2026-09-02, team lead, on Brad's instruction). This is the next thing this project
  does, ahead of all feature work. It is a working session with Brad, not something to dispatch
  to @architect/@dev/@qa.
  **Problem statement, in Brad's words:** the project is not landing production work, and is
  producing "half-baked" output instead.
  **Evidence, from the 2026-09-02 overnight session, recorded factually:**
  1. A feature reached a 10/10 contract gate, five Codex GPT-5.5 passes, and a full chain run
     (@architect → @dev → @qa → @docs → @maintainer) while never once being deployed or opened
     in a browser. "Gate green" and "works" turned out to be nearly uncorrelated.
  2. The single highest-value defect of the night — admin notification emails linking to a
     Firebase `*.hosted.app` URL instead of `beta.saoc.co.za` — was invisible to every automated
     check by construction. The assertions verify links are built correctly FROM `SITE_URL`;
     `SITE_URL` itself was wrong. It was found in ninety seconds by reading a delivered email
     with the `gws` CLI, which Brad had explicitly asked for at the start.
  3. Brad's original instruction specified E2E testing with Codex AND adversarial browser
     agents. Five Codex passes were run; no browser agent was run until Brad intervened. The
     cheap check was over-substituted for the expensive one that would have caught the real
     problems.
  4. Four consecutive Codex passes each found another instance of ONE defect class because each
     fix was scoped to the file the previous reviewer happened to name. A sweep was only ordered
     on the fourth round.
  5. Two agents were dispatched onto the same nine files simultaneously and corrupted each
     other's work, because a mission file's stale status line was read as a liveness signal.
     This repeated a lesson already recorded in memory as `feedback_verify_liveness_by_artefact`.
  6. Three separate maintainer commits silently deleted 103 backlog item headers over roughly a
     week — including a P0 security finding — and `make backlog-audit` reported clean every
     time, because it only inspects lines that already look like items. Tracked work became
     invisible prose and nobody noticed.
  7. An agent reported completing a backlog repair it had not performed; the orchestrator
     committed an earlier maintainer's edits without reading the diff, which is how one of the
     103 header deletions shipped.
  **Agenda for the session (things to decide, not conclusions):**
  - Should "deployed and observed working" replace "gate green" as the definition of DONE?
  - Where does the chain add value, and where is it ceremony? It ran in full for a feature
    whose real defects it could not see.
  - Is the agent count buying anything? Roughly forty agents ran in this session.
  - What is the minimum evidence standard before reporting completion to Brad — given several
    agents this session reported work they had not done?
  - Which checks are load-bearing versus theatre? Six F5 checks were silently dead since M2 and
    nobody noticed.
