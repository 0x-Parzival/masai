const STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'are', 'you',
  'your', 'our', 'will', 'can', 'not', 'all', 'any', 'who', 'what', 'when', 'where',
  'how', 'their', 'they', 'them', 'into', 'onto', 'about', 'over', 'under', 'within',
  'a', 'an', 'to', 'of', 'in', 'on', 'is', 'as', 'at', 'be', 'by', 'or', 'if', 'it',
  'we', 'us', 'i', 'me', 'my', 'he', 'she', 'his', 'her', 'do', 'did', 'done', 'was',
  'were', 'been', 'than', 'then', 'also', 'per', 'via', 'etc', 'using',
  'need', 'needs', 'required', 'preferred', 'must', 'nice', 'plus', 'role', 'years', 'year'
]);

const TOOL_KEYWORDS = [
  'javascript', 'typescript', 'python', 'java', 'go', 'react', 'next.js', 'node.js',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'sql', 'postgresql', 'mysql', 'mongodb',
  'git', 'jira', 'figma', 'salesforce', 'hubspot', 'tableau', 'excel', 'powerbi'
];

const SOFT_SKILL_KEYWORDS = [
  'communication', 'collaboration', 'leadership', 'ownership', 'stakeholder',
  'problem solving', 'adaptability', 'mentoring', 'team player', 'cross-functional'
];

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+.#\-\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.+#-]+|[.+#-]+$/g, ''))
    .filter(Boolean)
    .filter((t) => t.length > 2)
    .filter((t) => !STOP_WORDS.has(t));
}

function unique(arr) {
  return [...new Set(arr)];
}

function keywordCoverage(jdTokens, resumeTokens) {
  const jdSet = new Set(jdTokens);
  const resumeSet = new Set(resumeTokens);
  if (jdSet.size === 0) return 0;
  let hit = 0;
  jdSet.forEach((token) => {
    if (resumeSet.has(token)) hit += 1;
  });
  return hit / jdSet.size;
}

function extractYears(text) {
  const matches = (text || '').match(/(\d{1,2})\+?\s*(years|yrs)/gi) || [];
  const nums = matches
    .map((m) => parseInt(m.match(/\d{1,2}/)?.[0] || '0', 10))
    .filter(Boolean);
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

function toolAlignmentScore(jdText, resumeText) {
  const jd = jdText.toLowerCase();
  const resume = resumeText.toLowerCase();

  const jdTools = TOOL_KEYWORDS.filter((k) => jd.includes(k));
  if (jdTools.length === 0) return { score: 10, missing: [] };

  const matched = jdTools.filter((k) => resume.includes(k));
  const ratio = matched.length / jdTools.length;
  const points = Math.round(ratio * 20);
  const missing = jdTools.filter((k) => !resume.includes(k));
  return { score: points, missing };
}

function softSkillScore(jdText, resumeText) {
  const jd = jdText.toLowerCase();
  const resume = resumeText.toLowerCase();

  const jdSoft = SOFT_SKILL_KEYWORDS.filter((k) => jd.includes(k));
  const matched = jdSoft.filter((k) => resume.includes(k));

  if (jdSoft.length === 0) {
    const inferred = SOFT_SKILL_KEYWORDS.filter((k) => resume.includes(k)).length;
    return Math.min(15, Math.max(6, inferred * 2));
  }

  return Math.round((matched.length / jdSoft.length) * 15);
}

function experienceScore(jdText, resumeText) {
  const jdYears = extractYears(jdText);
  const resumeYears = extractYears(resumeText);

  if (!jdYears && !resumeYears) return 15;
  if (jdYears && !resumeYears) return 10;
  if (!jdYears && resumeYears) return 18;

  if (resumeYears >= jdYears) return 25;
  const ratio = resumeYears / jdYears;
  return Math.max(8, Math.round(ratio * 25));
}

function scoreCandidate({ jobDescription, resumeText }) {
  const jdTokens = unique(tokenize(jobDescription));
  const resumeTokens = unique(tokenize(resumeText));

  const coverage = keywordCoverage(jdTokens, resumeTokens);
  const skillMatch = Math.round(coverage * 40);

  const expScore = experienceScore(jobDescription, resumeText);
  const toolScoreInfo = toolAlignmentScore(jobDescription, resumeText);
  const toolsScore = toolScoreInfo.score;
  const softSkill = softSkillScore(jobDescription, resumeText);

  const overall = Math.max(0, Math.min(100, skillMatch + expScore + toolsScore + softSkill));

  let recommendedAction = 'Hold';
  if (overall >= 75) recommendedAction = 'Interview';
  else if (overall < 50) recommendedAction = 'Reject';

  const jdImportant = jdTokens.slice(0, 15);
  const strengths = jdImportant.filter((k) => resumeTokens.includes(k)).slice(0, 5);
  const gaps = jdImportant
    .filter((k) => !resumeTokens.includes(k))
    .slice(0, 5)
    .concat(toolScoreInfo.missing.slice(0, 3))
    .slice(0, 5);

  const summary = `Candidate shows ${skillMatch}/40 JD skill alignment, ${expScore}/25 experience fit, and ${toolsScore}/20 tool stack match. Recommended action: ${recommendedAction}.`;

  return {
    overall_score: overall,
    skill_match: skillMatch,
    experience_score: expScore,
    tools_score: toolsScore,
    soft_skill_score: softSkill,
    summary,
    strengths,
    gaps,
    recommended_action: recommendedAction
  };
}

function draftInterviewEmail(candidateName, roleTitle) {
  const safeName = candidateName && candidateName.trim() ? candidateName.trim() : 'Candidate';
  const safeRole = roleTitle && roleTitle.trim() ? roleTitle.trim() : 'the role';
  return `Subject: Interview Invitation - ${safeRole}\n\nHi ${safeName},\n\nThanks for your application. We'd like to invite you to a 30-minute interview for ${safeRole}.\n\nPlease reply with your availability for the next 3 business days, and we will confirm a slot.\n\nBest,\nSarah\nTalent Acquisition`;
}

function llmPromptTemplate(jobDescription, resumeText) {
  return `You are Recruit-AI, an objective recruiting evaluator.\n\nEvaluate this candidate against the job description using these exact weights:\n- Skills match: 40\n- Experience relevance: 25\n- Tools/Tech alignment: 20\n- Soft skills inference: 15\n\nRules:\n1) Return STRICT JSON only.\n2) Use integers for all score fields.\n3) overall_score must equal the sum of component scores.\n4) recommended_action must be one of: Interview, Hold, Reject.\n\nJob Description:\n${jobDescription}\n\nResume:\n${resumeText}\n\nJSON schema:\n{\n  "overall_score": 0,\n  "skill_match": 0,\n  "experience_score": 0,\n  "tools_score": 0,\n  "soft_skill_score": 0,\n  "summary": "",\n  "strengths": [""],\n  "gaps": [""],\n  "recommended_action": "Interview"\n}`;
}

module.exports = {
  scoreCandidate,
  llmPromptTemplate,
  draftInterviewEmail
};
