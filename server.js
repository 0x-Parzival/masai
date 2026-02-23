const http = require('http');
const fs = require('fs');
const path = require('path');
const { scoreCandidate, llmPromptTemplate, draftInterviewEmail } = require('./lib/scoring');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

async function handleScreen(payload) {
  const { jobDescription, resumeText, candidateName, roleTitle, includeEmailDraft } = payload;

  if (!jobDescription || !resumeText) {
    return { status: 400, body: { error: 'jobDescription and resumeText are required' } };
  }

  const result = scoreCandidate({ jobDescription, resumeText });
  const response = {
    ...result,
    llm_prompt_template: llmPromptTemplate(jobDescription, resumeText)
  };

  if (includeEmailDraft && result.recommended_action === 'Interview') {
    response.interview_email_draft = draftInterviewEmail(candidateName, roleTitle);
  }

  return { status: 200, body: response };
}

function serveStatic(req, res) {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const mime = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json'
    }[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/screen') {
    try {
      const payload = await parseBody(req);
      const out = await handleScreen(payload);
      sendJson(res, out.status, out.body);
    } catch (err) {
      sendJson(res, 500, { error: err.message || 'Internal server error' });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'recruit-ai-poc' });
    return;
  }

  serveStatic(req, res);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Recruit-AI POC running on http://localhost:${PORT}`);
  });
}

module.exports = {
  handleScreen,
  scoreCandidate,
  llmPromptTemplate,
  draftInterviewEmail
};
