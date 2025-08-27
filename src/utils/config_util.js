function gpt_system_prompt() {
  return (
    localStorage.getItem("gpt_system_prompt") ||
    process.env.VUE_APP_GPT_SYSTEM_PROMPT ||
    ""
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

export default {
  gpt_system_prompt,
  azure_language,
  azure_region,
  gpt_model,
  openai_key,
  azure_token,
};
