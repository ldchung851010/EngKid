export interface ServerConfig {
  deepseekApiKey: string;
  deepseekModel: string;
  glmApiKey: string;
  ttsVoice: string;
  ttsCacheDir: string;
  exampleCacheDir: string;
  corsOrigin: string;
  nodeEnv: string;
}

let config: ServerConfig = {
  deepseekApiKey: '',
  deepseekModel: 'deepseek-v4-flash',
  glmApiKey: '',
  ttsVoice: 'Kiki',
  ttsCacheDir: '',
  exampleCacheDir: '',
  corsOrigin: '',
  nodeEnv: '',
};

export function initConfig(c: Partial<ServerConfig>): void {
  config = { ...config, ...c };
}

export function getConfig(): ServerConfig {
  return config;
}
