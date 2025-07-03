import { NextRequest, NextResponse } from 'next/server';

// IMPORTANT: Store your OpenAI API Key securely!
// For production, use environment variables (e.g., process.env.OPENAI_API_KEY).
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY_HERE'; // It\'s better to use environment variables
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface RequestBody {
    image: string;
    keywords?: string[];
}

interface OpenAIError {
    message?: string;
}

interface OpenAIResponseChoice {
    message?: {
        content?: string;
    };
}

interface OpenAIData {
    choices?: OpenAIResponseChoice[];
    error?: OpenAIError;
}

export async function POST(request: NextRequest) {
    try {
        const { image: base64ImageData, keywords } = await request.json() as RequestBody;

        if (!base64ImageData) {
            return NextResponse.json({ error: 'No image data provided.' }, { status: 400 });
        }

        if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
            console.error('OpenAI API Key not configured.');
            return NextResponse.json({ error: 'OpenAI API Key not configured on the server.' }, { status: 500 });
        }

        console.log('Received image data and keywords:', keywords ? keywords.length : 0, 'keywords');

        let promptText: string;
        if (keywords && keywords.length > 0) {
            // Generate more specific keywords based on existing keywords
            promptText = `Based on this image and the existing keywords [${keywords.join(', ')}], generate 8-12 more specific and detailed keywords that dive deeper into the visual elements, emotions, actions, or specific details you can observe. Build upon the existing keywords to create a more nuanced description. Return only the keywords as a comma-separated list, without any preamble or explanation.`;
        } else {
            // Generate initial layer focused on colors and basic visual elements
            promptText = "Analyze this image and generate 8-12 keywords focusing primarily on colors, lighting, basic shapes, and fundamental visual elements you can observe. Include dominant colors, color tones, lighting conditions, and basic visual characteristics. Return only the keywords as a comma-separated list, without any preamble or explanation.";
        }

        const payload = {
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: promptText },
                        {
                            type: "image_url",
                            image_url: {
                                url: base64ImageData,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 80,
        };

        const openaiResponse = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        const responseBody = await openaiResponse.text();

        if (!openaiResponse.ok) {
            console.error('OpenAI API Error Status:', openaiResponse.status);
            console.error('OpenAI API Error Body:', responseBody);
            let errorMessage = 'OpenAI API request failed.';
            try {
                const errorJson = JSON.parse(responseBody) as OpenAIData;
                errorMessage = errorJson.error?.message || errorMessage;
            } catch {
                errorMessage = responseBody || errorMessage;
            }
            return NextResponse.json({ error: `OpenAI API request failed: ${errorMessage}` }, { status: openaiResponse.status });
        }

        let data: OpenAIData;
        try {
            data = JSON.parse(responseBody) as OpenAIData;
        } catch {
            console.error('Failed to parse OpenAI JSON response:', responseBody);
            return NextResponse.json({ error: 'Invalid JSON response from OpenAI.' }, { status: 500 });
        }
        
        console.log('OpenAI Response Data:', JSON.stringify(data, null, 2));

        const rawKeywords = data.choices?.[0]?.message?.content;
        if (!rawKeywords) {
            console.error("Could not extract keywords from OpenAI response structure:", data);
            return NextResponse.json({ error: 'Failed to extract keywords from OpenAI response content.' }, { status: 500 });
        }

        const keywordsArray = rawKeywords.split(',')
                                     .map(kw => kw.trim())
                                     .filter(kw => kw.length > 0);

        console.log('Sending layered keywords to frontend:', keywordsArray);
        return NextResponse.json({ keywords: keywordsArray });

    } catch (error: unknown) {
        let message = 'Internal Server Error';
        if (error instanceof Error) {
            message = error.message;
        }
        console.error('Error in /api/generate-keywords-layered:', message);
        if (typeof error === 'object' && error !== null && 'stack' in error) {
             console.error((error as { stack: string }).stack);
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
} 