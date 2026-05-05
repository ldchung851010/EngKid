import type { FastifyRequest } from 'fastify';

export type QuotaResource = 'ai' | 'tts' | 'asr';

export interface QuotaConfig {
  dailyLimit: number;
  ipHourlyLimit: number;
}

export interface QuotaCheck {
  ok: boolean;
  statusCode?: number;
  error?: string;
  retryAfterSeconds?: number;
  dailyRemaining: number;
  ipHourlyRemaining: number;
}

interface CounterBucket {
  key: string;
  count: number;
  expiresAt: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const counters = new Map<string, CounterBucket>();

const configs: Record<QuotaResource, QuotaConfig> = {
  ai: {
    dailyLimit: readPositiveInt('AI_DAILY_LIMIT', 5000),
    ipHourlyLimit: readPositiveInt('AI_IP_HOURLY_LIMIT', 300),
  },
  tts: {
    dailyLimit: readPositiveInt('TTS_DAILY_LIMIT', 10000),
    ipHourlyLimit: readPositiveInt('TTS_IP_HOURLY_LIMIT', 600),
  },
  asr: {
    dailyLimit: readPositiveInt('ASR_DAILY_LIMIT', 5000),
    ipHourlyLimit: readPositiveInt('ASR_IP_HOURLY_LIMIT', 300),
  },
};

export function consumeQuota(resource: QuotaResource, request: FastifyRequest, amount = 1): QuotaCheck {
  const status = getQuotaStatus(resource, request);
  if (amount <= 0) return status;

  if (status.dailyRemaining < amount) {
    return {
      ...status,
      ok: false,
      statusCode: 429,
      error: `${resource.toUpperCase()} daily quota exceeded`,
      retryAfterSeconds: secondsUntilNextUtcDay(),
    };
  }

  if (status.ipHourlyRemaining < amount) {
    return {
      ...status,
      ok: false,
      statusCode: 429,
      error: `${resource.toUpperCase()} hourly quota exceeded for this IP`,
      retryAfterSeconds: secondsUntilNextHour(),
    };
  }

  getBucket(dailyKey(resource), DAY_MS).count += amount;
  getBucket(hourlyKey(resource, getClientIp(request)), HOUR_MS).count += amount;
  return getQuotaStatus(resource, request);
}

export function getQuotaStatus(resource: QuotaResource, request: FastifyRequest): QuotaCheck {
  const config = configs[resource];
  const daily = getBucket(dailyKey(resource), DAY_MS);
  const hourly = getBucket(hourlyKey(resource, getClientIp(request)), HOUR_MS);
  return {
    ok: true,
    dailyRemaining: Math.max(0, config.dailyLimit - daily.count),
    ipHourlyRemaining: Math.max(0, config.ipHourlyLimit - hourly.count),
  };
}

export function getAllQuotaStatus(request: FastifyRequest): Record<QuotaResource, QuotaCheck> {
  return {
    ai: getQuotaStatus('ai', request),
    tts: getQuotaStatus('tts', request),
    asr: getQuotaStatus('asr', request),
  };
}

function getBucket(key: string, windowMs: number): CounterBucket {
  const now = Date.now();
  const existing = counters.get(key);
  if (existing && existing.expiresAt > now) return existing;

  const bucket = { key, count: 0, expiresAt: now + windowMs };
  counters.set(key, bucket);
  return bucket;
}

function dailyKey(resource: QuotaResource): string {
  return `${resource}:day:${new Date().toISOString().slice(0, 10)}`;
}

function hourlyKey(resource: QuotaResource, ip: string): string {
  return `${resource}:hour:${ip}:${new Date().toISOString().slice(0, 13)}`;
}

function getClientIp(request: FastifyRequest): string {
  return request.ip;
}

function secondsUntilNextUtcDay(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

function secondsUntilNextHour(): number {
  const now = new Date();
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours() + 1
  );
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export function readPositiveInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
