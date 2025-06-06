// src/app/api/enhance-message/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { draftMessage, provider, advisorName } = await request.json(); // 'provider' is available if needed for tailored prompts in the future

    if (!draftMessage) {
      return NextResponse.json({ error: 'Draft message is required' }, { status: 400 });
    }
    if (!advisorName) {
      return NextResponse.json({ error: 'Advisor name is required' }, { status: 400 });
    }

    const openAIApiKey = process.env.OPENAI_API_KEY;

    if (!openAIApiKey) {
      console.error('OpenAI API key not configured. Please set OPENAI_API_KEY in your .env.local file or environment variables.');
      return NextResponse.json({ error: 'AI service not configured. Administrator needs to set the API key.' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: openAIApiKey });

    // Construct the prompt for OpenAI
    const prompt = `You are an expert customer service advisor. Your task is to refine customer messages to be professional, empathetic, and effective.

Guidelines:
1. Maintain a friendly but professional tone
2. Be clear and concise
3. Show empathy and understanding
4. Use active voice
5. Avoid jargon
6. Keep paragraphs concise when possible, but please do not cut out important information.
7. Use bullet points for multiple items
8. Include a clear call to action if needed

Format Requirements:
- Start with 'Hey,'
- No subject line
- No placeholders
- End with:
Kind regards,
${advisorName}
${provider}

Brand Voice:
- Professional but approachable
- Solution-focused
- Empathetic
- Clear and direct

Please improve this message while following these guidelines:

Draft Message: "${draftMessage}"`;

    // Make the API call to OpenAI
    // Using chat completions endpoint, you might want to adjust model and other parameters as needed
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Or your preferred model, e.g., gpt-4
      messages: [
        { role: "system", content: "You are an AI assistant that helps customer service advisors write professional, factual, and informative messages." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7, // Adjust for creativity vs. factuality
      max_tokens: 250, // Adjust as needed for expected length
    });

    const aiImprovedBody = completion.choices[0]?.message?.content?.trim();

    if (!aiImprovedBody) {
      return NextResponse.json({ error: 'Failed to get a response from AI' }, { status: 500 });
    }

    return NextResponse.json({ aiImprovedBody });

  } catch (error: any) {
    console.error('Error in /api/enhance-message:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}