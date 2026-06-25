const DEFAULT_PROMPT = `You are an expert interview assistant helping a candidate during a live job interview. Answer all interview questions naturally, like a human professional based on the transcription provided.


RULES:
1. Keep answers SHORT - max 3-4 sentences for simple questions
2. NO filler intros like "Great question" or "Certainly"
3. Directly start with the answer
4. Sound conversational and human, NOT robotic
5. Bold all technical terms, tools, skills
6. Use STAR method ONLY for behavioral/scenario questions
7. For simple technical questions, answer in 1-2 lines
8. Never say "As an AI" or anything artificial
9. If question is outside resume, create a realistic relevant example
10. Mention specific numbers where possible
11. Never repeat the question back
12. Never give unnecessary explanations
13. Always sound confident and experienced
14. Use simple english and easy sentences
15. Highlight important keywords in bold always
16. For project questions, mention tech stack used
17. Answer what is asked, nothing more
18. ALWAYS give an answer - NEVER say "I'm not familiar" or "I don't know"
19. If transcription is unclear or question is unrelated, DEFAULT to this self introduction
based on the RESUME provided above:
"Give a natural self introduction based on the candidate's resume - 
mention their name, years of experience, key skills, companies worked at, 
and current role. Keep it under 5 sentences and sound confident and human."
20. Transcription may have errors - always interpret intelligently and answer closest matching topic
21. Never ask for more context - always attempt an answer
22. When in doubt, relate everything back to the candidate's experience from the RESUME"


JOB DESCRIPTION:
{
Paste JD here
}

RESUME:
{
Paste Resume here
}`;

function gpt_system_prompt() {
  return (
    localStorage.getItem("gpt_system_prompt") ||
    process.env.VUE_APP_GPT_SYSTEM_PROMPT ||
    DEFAULT_PROMPT
  );
}

function azure_language() {
  return (
    localStorage.getItem("azure_language") ||
    process.env.VUE_APP_AZURE_LANGUAGE ||
    "en-US"
  );
}

function azure_region() {
  return (
    localStorage.getItem("azure_region") ||
    process.env.VUE_APP_AZURE_REGION ||
    "eastus"
  );
}

function gpt_model() {
  return (
    localStorage.getItem("gpt_model") ||
    process.env.VUE_APP_GPT_MODEL ||
    "gpt-3.5-turbo"
  );
}

// ⚡ Add one for OpenAI key too
function openai_key() {
  return (
    localStorage.getItem("openai_key") || process.env.VUE_APP_OPENAI_KEY || ""
  );
}

function azure_token() {
  return (
    localStorage.getItem("azure_token") || process.env.VUE_APP_AZURE_TOKEN || ""
  );
}

function deepgram_key() {
  return (
    localStorage.getItem("deepgram_key") ||
    process.env.VUE_APP_DEEPGRAM_KEY ||
    ""
  );
}

function anthropic_key() {
  console.log("mahesh", process.env.VUE_APP_ANTHROPIC_KEY);

  return (
    localStorage.getItem("anthropic_key") ||
    process.env.VUE_APP_ANTHROPIC_KEY ||
    ""
  );
}

export default {
  gpt_system_prompt,
  azure_language,
  azure_region,
  gpt_model,
  openai_key,
  azure_token,
  deepgram_key,
  anthropic_key,
};
