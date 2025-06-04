// src/app/api/ask-business-question/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { businessQuestion } = await request.json();

    if (!businessQuestion) {
      return NextResponse.json({ error: 'Business question is required' }, { status: 400 });
    }

    const openAIApiKey = process.env.OPENAI_API_KEY;

    if (!openAIApiKey) {
      console.error('OpenAI API key not configured. Please set OPENAI_API_KEY in your .env.local file.');
      return NextResponse.json({ error: 'AI service not configured. Administrator needs to set the API key.' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: openAIApiKey });

    // --- IMPORTANT: For Q&A, you'll get the best results by using a fine-tuned model ---
    // --- or by providing extensive context if using a general model.         ---
    const modelForQA = "gpt-3.5-turbo"; // TODO: Replace with your fine-tuned model ID or a more powerful model like gpt-4 if needed.
    
    const systemPrompt = "You are an AI assistant trained on our company's internal business processes and policies. Provide concise and accurate answers based on the knowledge you have been trained on. If the question is outside of your training data or too ambiguous, say that you don't have the information.";

    const completion = await openai.chat.completions.create({
      model: modelForQA,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: businessQuestion }
      ],
      temperature: 0.3, // Lower temperature for more factual, less creative answers
      max_tokens: 250, // Adjust as needed for answer length
    });

    const answer = completion.choices[0]?.message?.content?.trim();

    if (!answer) {
      return NextResponse.json({ error: 'Failed to get an answer from AI' }, { status: 500 });
    }

    return NextResponse.json({ answer });

  } catch (error: any) {
    console.error('[API ASK-BUSINESS-QUESTION ERROR]', error);
    let errorMessage = 'Failed to get an answer due to an unexpected error.';
     if (error.code === 'insufficient_quota') {
        errorMessage = 'AI service quota exceeded. Please check your OpenAI plan.';
    } else if (error.status === 401) {
        errorMessage = 'Invalid OpenAI API key. Please check your configuration.';
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
