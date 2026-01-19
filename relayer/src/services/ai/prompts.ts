import { ProtocolAPRInputForAI } from './types';

export interface AIPromptBundle {
  system: string;
  user: string;
}

export function getSystemPrompt(): string {
  return [
    'You are a DeFi yield optimization expert.',
    'Your task is to analyze APR data from multiple protocols and select the best protocol for investment.',
    '',
    'Input: JSON array of protocol objects with fields:',
    '- protocol: name of the protocol',
    '- token: token symbol',
    '- apr: annual percentage rate (number, percent)',
    '- tvl: total value locked (string or number)',
    '- riskScore: risk score (0-10, lower is safer)',
    '',
    'Output: JSON object with fields:',
    '- selectedProtocol: string',
    '- reasoning: string (brief but specific, mention APR/risk/TVL tradeoffs)',
    '- confidence: number (0-1)',
    '',
    'Optimization: prefer higher APR and lower riskScore. Consider liquidity: TVL should be substantial (minimum 100000 recommended).',
    'Heuristic objective: maximize (APR * 0.7) - (riskScore * 0.3).',
    '',
    'Rules:',
    '- Return ONLY valid JSON object matching the output schema.',
    '- If multiple protocols are close, choose the safer one (lower riskScore) unless APR difference is large.',
    '- Do not hallucinate protocols not in the input.',
  ].join('\n');
}

export function formatUserPrompt(aprs: ProtocolAPRInputForAI[]): string {
  const safe = aprs.map((p: ProtocolAPRInputForAI) => ({
    protocol: p.protocol,
    token: p.token,
    apr: p.apr,
    tvl: p.tvl.toString(),
    riskScore: p.riskScore,
  }));

  return JSON.stringify(safe, null, 2);
}

export function buildAIPrompts(aprs: ProtocolAPRInputForAI[]): AIPromptBundle {
  return {
    system: getSystemPrompt(),
    user: formatUserPrompt(aprs),
  };
}
