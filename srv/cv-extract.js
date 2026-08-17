const Anthropic = require('@anthropic-ai/sdk');
const { properties } = require('@sap/cds/lib/compile/load');

const client = new Anthropic(); // read api key

const CV_SCHEMA = {
    type: 'object',
    properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string' },
        experience: { type: 'integer' },
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
    required: ['firstName', 'lastName', 'email', 'experience', 'skills'],
    additionalProperties: false
};


const SYSTEM = `You read a candidate's CV and extract their profile and skills for an HR skills database.

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
- name: the skill as the CV writes it.
- lastUsed: the last month the CV shows the skill in use, as YYYY-MM-01.
  Use null when the CV gives no date for that skill.
- evidence: the phrase or role you based the rating on, under 200 characters.
- experience: total years of professional work, rounded down.
- Extract only what the CV actually claims. Never invent skills, dates, or contact details.`;

async function extractCvProfile({ contentBase64, catalog }) {
  const catalogText = catalog.map((s) => `${s.ID}\t${s.name}`).join('\n');

  const response = await client.beta.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: `${SYSTEM}\n\nSkill catalog (ID<TAB>name):\n${catalogText}`,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: CV_SCHEMA }
    },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: contentBase64 }
        },
        { type: 'text', text: 'Extract the profile and skills from this CV.' }
      ]
    }]
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to process this document.');
  }

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Claude returned no text content.');

  return JSON.parse(text);
}

module.exports = { extractCvProfile };