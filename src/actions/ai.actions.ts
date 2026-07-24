'use server';

// Uses Google's Gemini API (free tier) to turn a plain-English meal description
// into structured nutrition data. Get a free key at https://aistudio.google.com/apikey
// and set it as GEMINI_API_KEY in your .env.local file.

export type ParsedMeal = {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingSize: string;
};

const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function parseMealDescription(description: string): Promise<ParsedMeal> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error(
            'GEMINI_API_KEY is not set. Add it to your .env.local file (get a free key at https://aistudio.google.com/apikey).'
        );
    }

    if (!description || description.trim().length < 3) {
        throw new Error('Please describe what you ate in a bit more detail.');
    }

    const prompt = `You are a nutrition estimation assistant. A user will describe a meal in plain English.
Estimate its nutritional content as best you can using standard USDA-style portion assumptions when the
user doesn't give exact amounts.

Meal description: "${description}"

Respond with ONLY a raw JSON object (no markdown fences, no commentary) in exactly this shape:
{
  "name": "short descriptive name for the meal",
  "calories": <number, kcal>,
  "protein": <number, grams>,
  "carbs": <number, grams>,
  "fat": <number, grams>,
  "servingSize": "short string describing the estimated portion, e.g. '1 bowl (~350g)'"
}`;

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
        throw new Error('Gemini returned an empty response. Try rephrasing your meal description.');
    }

    // Defensive cleanup in case the model wraps the JSON in markdown fences anyway.
    const cleaned = rawText.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();

    let parsed: ParsedMeal;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        throw new Error('Could not parse the AI response. Please try again.');
    }

    return {
        name: String(parsed.name ?? description).slice(0, 100),
        calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
        protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
        carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
        fat: Math.max(0, Math.round(Number(parsed.fat) || 0)),
        servingSize: String(parsed.servingSize ?? '1 serving').slice(0, 50),
    };
}
