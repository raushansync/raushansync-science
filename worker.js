const EXACT_ALLOWED_ORIGINS = new Set([
    'https://science.raushansync.com'
]);

const LOCAL_DEV_HOSTS = new Set([
    'localhost',
    '127.0.0.1'
]);

const GROQ_MODELS = {
    quality: 'llama-3.3-70b-versatile',
    fast: 'llama-3.1-8b-instant',
    longContext: 'qwen/qwen3-32b'
};

const DEFAULT_GROQ_MODEL = GROQ_MODELS.fast;
const FALLBACK_GROQ_MODEL = GROQ_MODELS.longContext;

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

function tryParseJson(text) {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    try {
        return JSON.parse(trimmed);
    } catch (error) {
        return null;
    }
}

function chooseGroqModel(requestedModel) {
    const selected = cleanText(requestedModel, '');

    if (!selected) return DEFAULT_GROQ_MODEL;

    if (selected === 'llama3-70b-8192') return GROQ_MODELS.quality;
    if (selected === 'llama3-8b-8192') return GROQ_MODELS.fast;
    if (selected === 'mixtral-8x7b-32768') return GROQ_MODELS.longContext;

    const allowedModels = new Set(Object.values(GROQ_MODELS));
    return allowedModels.has(selected) ? selected : DEFAULT_GROQ_MODEL;
}

async function requestGroqChatCompletion(env, model, messages) {
    const upstreamResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.4,
            max_completion_tokens: 500
        })
    });

    const rawUpstreamText = await upstreamResponse.text();
    return { upstreamResponse, rawUpstreamText };
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

        if (!env.GROQ_API_KEY) {
            return jsonResponse({ error: 'Missing GROQ_API_KEY in Worker environment' }, 500, origin);
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
        const requestedModel = chooseGroqModel(body?.model);

        if (!message) {
            return jsonResponse({ error: 'Message is required' }, 400, origin);
        }

        const tutorSystemPrompt = [
            'You are a supportive school science tutor.',
            'Target learner level: ' + learnerLevel + '.',
            'Adapt explanation depth, vocabulary, and examples to this learner level.',
            'Explain concepts clearly, step-by-step, using simple language.',
            'Keep the tone encouraging and never shame mistakes.',
            'Focus only on the provided quiz question context and related science concept.',
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

        const modelsToTry = [requestedModel];
        if (requestedModel === DEFAULT_GROQ_MODEL && FALLBACK_GROQ_MODEL !== DEFAULT_GROQ_MODEL) {
            modelsToTry.push(FALLBACK_GROQ_MODEL);
        }

        let lastErrorDetail = 'Groq returned a non-success status.';
        let lastUpstreamStatus = 502;
        let lastModel = requestedModel;

        for (let index = 0; index < modelsToTry.length; index += 1) {
            const model = modelsToTry[index];
            const canFallback = index === 0 && modelsToTry.length > 1;
            let upstreamResponse;

            try {
                const result = await requestGroqChatCompletion(env, model, messages);
                upstreamResponse = result.upstreamResponse;
                lastUpstreamStatus = upstreamResponse.status;
                lastModel = model;

                const rawUpstreamText = result.rawUpstreamText;

                if (!upstreamResponse.ok) {
                    const detail = rawUpstreamText.trim() || 'Groq returned a non-success status.';
                    lastErrorDetail = 'Groq API error: ' + detail;

                    console.error('[groq] request failed', {
                        model: model,
                        status: upstreamResponse.status,
                        body: detail.slice(0, 500)
                    });

                    if (canFallback && upstreamResponse.status === 429) {
                        console.warn('[groq] falling back after 429', {
                            fromModel: model,
                            toModel: FALLBACK_GROQ_MODEL
                        });
                        continue;
                    }

                    return jsonResponse({
                        error: 'Groq request failed',
                        detail: lastErrorDetail,
                        upstreamStatus: upstreamResponse.status,
                        model: model,
                        provider: 'Groq'
                    }, upstreamResponse.status, origin);
                }

                const data = tryParseJson(rawUpstreamText) || {};
                const reply = data?.choices?.[0]?.message?.content || 'No response';

                console.log('[groq] request succeeded', {
                    model: model,
                    status: upstreamResponse.status,
                    usedFallback: index > 0
                });

                return jsonResponse({
                    reply: reply,
                    model: model,
                    provider: 'Groq'
                }, 200, origin);
            } catch (error) {
                const detail = error instanceof Error ? error.message : 'Failed to reach Groq API';
                lastErrorDetail = detail;
                lastUpstreamStatus = 502;
                lastModel = model;

                console.error('[groq] network failure', {
                    model: model,
                    message: detail
                });

                return jsonResponse({
                    error: 'Groq request failed',
                    detail: detail,
                    upstreamStatus: 502,
                    model: model,
                    provider: 'Groq'
                }, 502, origin);
            }
        }

        return jsonResponse({
            error: 'Groq request failed',
            detail: lastErrorDetail,
            upstreamStatus: lastUpstreamStatus,
            model: lastModel,
            provider: 'Groq'
        }, lastUpstreamStatus, origin);
    }
};
