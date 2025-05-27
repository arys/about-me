import { NextRequest, NextResponse } from 'next/server';

// IMPORTANT: Store your OpenAI API Key securely!
// For production, use environment variables (e.g., process.env.OPENAI_API_KEY).
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY_HERE'; // It\'s better to use environment variables
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface RequestBody {
    image: string;
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
        const { image: base64ImageData } = await request.json() as RequestBody;

        if (!base64ImageData) {
            return NextResponse.json({ error: 'No image data provided.' }, { status: 400 });
        }

        if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
            console.error('OpenAI API Key not configured.');
            return NextResponse.json({ error: 'OpenAI API Key not configured on the server.' }, { status: 500 });
        }

        console.log('Received image data, calling OpenAI...');

        const payload = {
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Generate 5-7 concise keywords that describe the person or main subject in this image. Focus on descriptive terms. Return only the keywords as a comma-separated list, without any preamble or explanation." },
                        {
                            type: "image_url",
                            image_url: {
                                url: base64ImageData,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 60,
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
                const errorJson = JSON.parse(responseBody) as OpenAIData; // Type assertion
                errorMessage = errorJson.error?.message || errorMessage;
            } catch {
                errorMessage = responseBody || errorMessage;
            }
            return NextResponse.json({ error: `OpenAI API request failed: ${errorMessage}` }, { status: openaiResponse.status });
        }

        let data: OpenAIData;
        try {
            data = JSON.parse(responseBody) as OpenAIData; // Type assertion
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

        console.log('Sending keywords to frontend:', keywordsArray);
        return NextResponse.json({ keywords: keywordsArray });

    } catch (error: unknown) {
        let message = 'Internal Server Error';
        if (error instanceof Error) {
            message = error.message;
        }
        console.error('Error in /api/generate-keywords:', message);
        if (typeof error === 'object' && error !== null && 'stack' in error) {
             console.error((error as { stack: string }).stack); // Log stack if available
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
} 