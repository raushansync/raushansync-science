const EXACT_ALLOWED_ORIGINS = new Set([
    'https://science.raushansync.com'
]);

const LOCAL_DEV_HOSTS = new Set([
    'localhost',
    '127.0.0.1'
]);

const MODEL_CANDIDATES = [
    'google/gemma-3-4b-it:free',
    'google/gemma-3-12b-it:free',
    'openai/gpt-oss-20b:free',
    'openrouter/free'
];

function isAllowedOrigin(origin) {
    if (typeof origin !== 'string') return false;
    if (EXACT_ALLOWED_ORIGINS.has(origin)) return true;

    try {
        const url = new URL(origin);
        return url.protocol === 'http:' && LOCAL_DEV_HOSTS.has(url.hostname);
    } catch (error) {
        return false;
    }
}

function buildCorsHeaders(origin) {
    const allowOrigin = isAllowedOrigin(origin) ? origin : 'https://science.raushansync.com';
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

function jsonResponse(data, status, origin) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...buildCorsHeaders(origin)
        }
    });
}

function cleanText(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
}

function inferLearnerLevel(context) {
    const combinedText = [
        cleanText(context?.quizTitle, ''),
        cleanText(context?.questionText, ''),
        cleanText(context?.pageUrl, '')
    ].join(' ');

    const classOrGradeMatch =
        combinedText.match(/\bclass\s*0?(\d{1,2})\b/i) ||
        combinedText.match(/\bgrade\s*0?(\d{1,2})\b/i) ||
        combinedText.match(/class0?(\d{1,2})/i);

    if (classOrGradeMatch) {
        const levelNumber = Number.parseInt(classOrGradeMatch[1], 10);
        if (Number.isInteger(levelNumber) && levelNumber > 0) {
            return 'Class ' + levelNumber;
        }
    }

    return 'middle-school';
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];

    return history
        .filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
        .slice(-10)
        .map(item => ({
            role: item.role,
            content: item.content.trim()
        }))
        .filter(item => item.content.length > 0);
}

function extractAssistantText(payload) {
    const content = payload?.choices?.[0]?.message?.content;

    if (typeof content === 'string') return content.trim();

    if (Array.isArray(content)) {
        return content
            .map(part => (typeof part?.text === 'string' ? part.text : ''))
            .join(' ')
            .trim();
    }

    return '';
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin');

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: buildCorsHeaders(origin)
            });
        }

        if (request.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405, origin);
        }

        if (origin && !isAllowedOrigin(origin)) {
            return jsonResponse({ error: 'Origin not allowed' }, 403, origin);
        }

        if (!env.OPENROUTER_API_KEY) {
            return jsonResponse({ error: 'Missing OPENROUTER_API_KEY in Worker environment' }, 500, origin);
        }

        let body;
        try {
            body = await request.json();
        } catch (error) {
            return jsonResponse({ error: 'Invalid JSON body' }, 400, origin);
        }

        const message = cleanText(body?.message, '');
        const context = body?.context && typeof body.context === 'object' ? body.context : {};
        const history = normalizeHistory(body?.history);
        const learnerLevel = inferLearnerLevel(context);

        if (!message) {
            return jsonResponse({ error: 'Message is required' }, 400, origin);
        }

        const tutorSystemPrompt = [
            'You are a supportive school science tutor.',
            'Target learner level: ' + learnerLevel + '.',
            'Adapt explanation depth, vocabulary, and examples to this learner level.',
            'Explain concepts clearly, step-by-step, using simple language.',
            'Keep the tone encouraging and never shame mistakes.',
            'Focus only on the provided quiz question context and related biology concept.',
            'If the student is wrong, explain why and how to reason correctly.',
            'Use short paragraphs and optional bullet points for clarity.',
            'Use Markdown for formatting: **bold**, *italic*, and - or 1. lists. Do not output raw HTML.',
            'Do not ask the student for clarification or additional details.',
            'Do not ask follow-up questions unless the student explicitly requests a quiz question.',
            'Infer missing details from the provided context and give the best direct answer in one response.',
            'If something is unclear, state one brief assumption and continue with the explanation.'
        ].join('\n');

        const contextPrompt = [
            'Quiz context:',
            'Topic: ' + cleanText(context.quizTitle, 'Unknown topic'),
            'Question: ' + cleanText(context.questionText, 'Not provided'),
            'Student answer: ' + cleanText(context.userAnswer, 'Not provided'),
            'Correct answer: ' + cleanText(context.correctAnswer, 'Not provided'),
            'Explanation: ' + cleanText(context.explanation, 'Not provided'),
            'Page URL: ' + cleanText(context.pageUrl, 'Not provided')
        ].join('\n');

        const messages = [
            { role: 'system', content: tutorSystemPrompt },
            { role: 'system', content: contextPrompt },
            ...history,
            { role: 'user', content: message }
        ];

        let lastErrorDetail = 'OpenRouter returned a non-success status.';

        for (const model of MODEL_CANDIDATES) {
            let upstreamResponse;
            try {
                upstreamResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://science.raushansync.com',
                        'X-Title': 'RaushanSYNC Science AI Tutor'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        temperature: 0.4,
                        max_tokens: 500
                    })
                });
            } catch (error) {
                lastErrorDetail = 'Failed to reach OpenRouter API';
                continue;
            }

            let upstreamData;
            try {
                upstreamData = await upstreamResponse.json();
            } catch (error) {
                upstreamData = {};
            }

            if (!upstreamResponse.ok) {
                lastErrorDetail =
                    upstreamData?.error?.message ||
                    upstreamData?.message ||
                    'OpenRouter returned a non-success status.';
                continue;
            }

            const reply = extractAssistantText(upstreamData);
            if (reply) {
                return jsonResponse({ reply: reply, model: model }, 200, origin);
            }

            lastErrorDetail = 'OpenRouter returned an empty response';
        }

        return jsonResponse({ error: 'OpenRouter request failed', detail: lastErrorDetail }, 502, origin);
    }
};
