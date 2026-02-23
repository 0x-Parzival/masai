const { scoreCandidate, llmPromptTemplate, draftInterviewEmail } = require('../lib/scoring');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const payload = req.body || {};
    const { jobDescription, resumeText, candidateName, roleTitle, includeEmailDraft } = payload;

    if (!jobDescription || !resumeText) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'jobDescription and resumeText are required' }));
      return;
    }

    const result = scoreCandidate({ jobDescription, resumeText });
    const response = {
      ...result,
      llm_prompt_template: llmPromptTemplate(jobDescription, resumeText)
    };

    if (includeEmailDraft && result.recommended_action === 'Interview') {
      response.interview_email_draft = draftInterviewEmail(candidateName, roleTitle);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(response));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
  }
};
