# Recruit-AI POC

A working proof-of-concept that screens resumes against a job description and returns a structured hiring recommendation.

## Run

```bash
cd /home/parzival/masai
npm start
```

Open: http://localhost:3000

## Deploy On Vercel

This repo is now Vercel-ready:
- Static pages are served from `public/`
- API runs as serverless functions in `api/`
- Config is in `vercel.json`

Endpoints after deploy:
- `GET /api/health`
- `POST /api/screen`

Pages after deploy:
- `/` (Recruit-AI app)
- `/sarah-persona` (Persona text page)

Deploy commands:

```bash
npm i -g vercel
vercel
vercel --prod
```

## n8n Resume Sort + Recommend

Import workflow:
- File: `/home/parzival/masai/n8n/recruit_ai_resume_sort_recommend.workflow.json`
- n8n menu: `Workflows -> Import from File`

Webhook contract (POST):

```json
{
  "roleTitle": "Senior Frontend Engineer",
  "jobDescription": "Need 5 years React TypeScript AWS communication collaboration",
  "candidates": [
    {
      "name": "Alex Kim",
      "resumeText": "Frontend developer with 6 years experience in React, TypeScript, AWS. Strong communication."
    },
    {
      "name": "Taylor Reed",
      "resumeText": "2 years building UI with JavaScript and CSS."
    }
  ]
}
```

Response:
- `ranked_candidates` sorted descending by `overall_score`
- `recommendation_buckets` grouped into `Interview`, `Hold`, `Reject`

---

## 1) Problem Deconstruction

### What is the real bottleneck?
- Sarah's bottleneck is not resume collection; it is decision throughput.
- She must convert unstructured resume content into consistent interview decisions across 200+ applicants per role.
- The expensive part is repeated cognitive comparison: candidate vs JD, over and over, under time pressure.

### Why existing ATS systems fail?
- Most ATS tools are storage and workflow systems, not decision engines.
- Scoring is usually keyword-only, brittle, or hidden behind black-box logic.
- They add admin overhead (tags, stages, filters) instead of reducing judgment load.
- SMB teams need fast triage and explainable rationale, not enterprise-heavy configuration.

### What part should AI handle vs automation?
- AI should handle: semantic matching, candidate summary, gap detection, and draft communication.
- Automation should handle: ingestion, parsing, orchestration, routing, and status updates.
- Human should handle: final interview decision, edge-case review, bias checks, and compensation decisions.

### What must NOT be overengineered?
- Do not build complex ranking ML models in v1.
- Do not build multi-agent orchestration first.
- Do not optimize for every resume format before proving value.
- Do not integrate full ATS + calendar + HRIS in week 1.
- Keep deterministic weighted scoring with transparent outputs.

---

## 2) System Architecture (Clear & Practical)

### Build target (5-7 days)
- Frontend: single-page web app for JD + resume input and results.
- Backend: one screening endpoint with deterministic scoring and optional interview email draft.
- Workflow-ready design: endpoint contracts match n8n steps for later productionization.

### Frontend (implemented)
- Simple web UI at `/home/parzival/masai/public/index.html`.
- Inputs:
  - Role title
  - Candidate name
  - JD text paste or `.txt/.md` upload
  - Resume text paste or `.txt/.md` upload
- Output dashboard:
  - Overall score + score breakdown
  - Summary, strengths, gaps
  - Recommendation: Interview / Hold / Reject
  - Optional interview email draft

### Backend agent (implemented)
- HTTP server at `/home/parzival/masai/server.js`.
- Endpoint: `POST /api/screen`.
- Agent flow mapping:
  1. Accept inputs (`jobDescription`, `resumeText`, metadata)
  2. Extract/normalize text (tokenization and cleanup)
  3. Apply structured scoring framework
  4. Return strict JSON
  5. Optionally generate interview email draft
  6. Expose an LLM prompt template for n8n/LLM handoff

### n8n workflow version (production path)
- Node 1: Webhook receives JD + resume file/text.
- Node 2: Resume parser (PDF extraction service or parser node).
- Node 3: LLM node with strict JSON schema prompt.
- Node 4: Function node validates and normalizes output.
- Node 5: HTTP response to frontend / ATS callback.
- Node 6 (optional): Gmail/Outlook draft + Google Calendar tentative slots.

### API structure

#### `POST /api/screen`
Request:

```json
{
  "roleTitle": "Senior Frontend Engineer",
  "candidateName": "Alex Kim",
  "jobDescription": "...",
  "resumeText": "...",
  "includeEmailDraft": true
}
```

Response:

```json
{
  "overall_score": 82,
  "skill_match": 35,
  "experience_score": 20,
  "tools_score": 15,
  "soft_skill_score": 12,
  "summary": "Candidate shows 35/40 JD skill alignment, 20/25 experience fit, and 15/20 tool stack match. Recommended action: Interview.",
  "strengths": ["react", "typescript", "aws"],
  "gaps": ["kubernetes", "tableau"],
  "recommended_action": "Interview",
  "interview_email_draft": "Subject: Interview Invitation - Senior Frontend Engineer...",
  "llm_prompt_template": "You are Recruit-AI..."
}
```

### Example prompt for scoring logic

```text
You are Recruit-AI, an objective recruiting evaluator.

Evaluate this candidate against the job description using these exact weights:
- Skills match: 40
- Experience relevance: 25
- Tools/Tech alignment: 20
- Soft skills inference: 15

Rules:
1) Return STRICT JSON only.
2) Use integers for all score fields.
3) overall_score must equal the sum of component scores.
4) recommended_action must be one of: Interview, Hold, Reject.
```

---

## 3) LLM Scoring Framework

Deterministic weighted evaluation:
- Skills match (40%): JD keyword coverage in resume.
- Experience relevance (25%): years/role relevance heuristics.
- Tools/Tech alignment (20%): required tools from JD matched in resume.
- Cultural/soft skills inference (15%): communication/collaboration/leadership cues.

Decision rules:
- `Interview` if overall >= 75
- `Hold` if overall is 50-74
- `Reject` if overall < 50

Output format (enforced):

```json
{
  "overall_score": 82,
  "skill_match": 35,
  "experience_score": 20,
  "tools_score": 15,
  "soft_skill_score": 12,
  "summary": "...",
  "strengths": [],
  "gaps": [],
  "recommended_action": "Interview"
}
```

---

## Delivery Scope for 5-7 Days

Day 1-2:
- Implement current POC (done): UI + API + weighted scoring + recommendation.

Day 3-4:
- Add PDF parsing (OCR fallback) in workflow layer.
- Add data persistence (SQLite/Postgres) for candidate history.

Day 5:
- Add calibration mode (per-role weight tuning).
- Add reviewer override and audit trail.

Day 6-7:
- Integrate n8n + email/calendar mock + basic ATS webhook.
- Record demo flow: JD upload -> resume upload -> score -> interview email draft.

## Notes
- This POC favors speed and explainability over model sophistication.
- It is intentionally deterministic for predictable recruiter trust.
- Bias/fairness checks and compliance constraints should be added before production use.
