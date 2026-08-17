const Anthropic = require('@anthropic-ai/sdk');

// Reads ANTHROPIC_API_KEY from the environment (.env / CF user-provided service).
const client = new Anthropic();

// Skill extraction is a short, well-specified reading task, so it runs on the
// cheapest current model. Claude 3 Haiku and 3.5 Haiku are both retired.
const MODEL = 'claude-haiku-4-5';

const SKILLS_SCHEMA = {
  type: 'object',
  properties: {
    skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skillID: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          name: { type: 'string' },
          rating: { type: 'integer', enum: [1, 2, 3, 4, 5] },
          lastUsed: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
          evidence: { type: 'string' }
        },
        required: ['skillID', 'name', 'rating', 'lastUsed', 'evidence'],
        additionalProperties: false
      }
    }
  },
  required: ['skills'],
  additionalProperties: false
};

const SYSTEM = `You read a CV and extract only the professional skills it demonstrates, for the author's own skills profile in an HR database.

Rating scale, applied from evidence in the CV:
1 = listed or mentioned only
2 = used under supervision, in coursework, or in a personal project
3 = used independently on real work
4 = used on complex, long-running, or large-scale work
5 = led, taught, or is cited as the expert

Rules:
- skillID: match against the catalog below. Use the exact ID when the CV names the
  same technology under any alias or version ("Node", "Node.js 20" -> Node.js).
  Use null when nothing in the catalog matches; do not force a near-match.
- name: the skill as the CV writes it, in its conventional casing.
- lastUsed: the last month the CV shows the skill in use, as YYYY-MM-01.
  Use null when the CV gives no date for that skill.
- evidence: the phrase or role you based the rating on, under 200 characters.
- Extract technical and professional skills only: languages, frameworks, tools,
  platforms, methodologies, spoken languages. Skip job titles, employers, degrees,
  and generic traits such as "team player" or "hard working".
- List each skill once. Extract only what the CV actually claims; never invent a
  skill, a rating, or a date that the CV does not support.`;

// Anthropic accepts PDFs as document blocks; plain text is sent as text.
// Word documents would need server-side conversion first, so they are rejected
// with a message the user can act on rather than a parse failure.
function buildDocumentContent(fileName, contentBase64) {
  const ext = String(fileName || '').split('.').pop().toLowerCase();

  if (ext === 'pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: contentBase64 }
    };
  }

  if (ext === 'txt' || ext === 'md') {
    const text = Buffer.from(contentBase64, 'base64').toString('utf8');
    if (!text.trim()) throw new Error('The file is empty.');
    return { type: 'text', text: `CV:\n\n${text}` };
  }

  throw new Error(`Unsupported file type ".${ext}". Please upload the CV as PDF or TXT.`);
}

async function extractCvSkills({ fileName, contentBase64, catalog }) {
  const catalogText = (catalog || []).map((s) => `${s.ID}\t${s.name}`).join('\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: `${SYSTEM}\n\nSkill catalog (ID<TAB>name):\n${catalogText}`,
    output_config: {
      format: { type: 'json_schema', schema: SKILLS_SCHEMA }
    },
    messages: [{
      role: 'user',
      content: [
        buildDocumentContent(fileName, contentBase64),
        { type: 'text', text: 'Extract the skills from this CV.' }
      ]
    }]
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to process this document.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('The CV produced more skills than fit in one response. Try a shorter CV.');
  }

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Claude returned no text content.');

  const parsed = JSON.parse(text);
  return parsed.skills || [];
}

module.exports = { extractCvSkills };
