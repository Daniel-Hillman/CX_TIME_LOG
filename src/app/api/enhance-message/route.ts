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
    const prompt = `Refine the following customer support message to be highly professional, empathetic, clear, and concise, while maintaining the original intent. Format and return the message as follows:\n- Start with 'Hey,' (not 'Dear [Customer's Name],').\n- Do NOT include any subject line.\n- Do NOT use any placeholders such as [Customer's Name], [Your Name], [Company Name], [Your Position], etc.\n- End the message with the following sign-off, on separate lines:\nKind regards,\n${advisorName}\n${provider}\n- Do NOT include any other signature block, email, or position.\n- The message should be ready to copy and send straight away, with no extra editing required.\n\nDraft Message: "${draftMessage}"`;

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