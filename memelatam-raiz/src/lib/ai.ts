/** ¿Parece un proyecto de agentes / IA? Heurística por palabras en el nombre, símbolo o descripción. */
const AI_RE = /(^|[^a-z])(ai|a\.i\.|agent|agents|agente|agentes|gpt|llm|bot|neural|autonomous|sentient|aixbt|virtuals?|terminal|copilot)([^a-z]|$)/i;

export const looksAi = (...texts: (string | null | undefined)[]): boolean => texts.some((t) => !!t && AI_RE.test(t));
