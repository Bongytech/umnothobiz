import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sandboxAllowed } from './provider';

const original = {
  FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR,
  ALLOW_SANDBOX_PAYMENTS: process.env.ALLOW_SANDBOX_PAYMENTS,
  SANDBOX_PROJECT_ALLOWLIST: process.env.SANDBOX_PROJECT_ALLOWLIST,
  GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
  GCP_PROJECT: process.env.GCP_PROJECT,
};

function restore(key: keyof typeof original): void {
  const value = original[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  delete process.env.FUNCTIONS_EMULATOR;
  delete process.env.ALLOW_SANDBOX_PAYMENTS;
  delete process.env.SANDBOX_PROJECT_ALLOWLIST;
  delete process.env.GCLOUD_PROJECT;
  delete process.env.GCP_PROJECT;
});

afterEach(() => {
  (Object.keys(original) as (keyof typeof original)[]).forEach(restore);
});

describe('sandboxAllowed', () => {
  it('allows the sandbox only in the Functions emulator', () => {
    process.env.FUNCTIONS_EMULATOR = 'true';
    expect(sandboxAllowed()).toBe(true);
  });

  it('refuses a production project even when ALLOW_SANDBOX_PAYMENTS=true', () => {
    process.env.ALLOW_SANDBOX_PAYMENTS = 'true';
    process.env.GCLOUD_PROJECT = 'umnotho-f71ba';
    expect(sandboxAllowed()).toBe(false);
  });

  it('allows an explicitly allowlisted non-production project', () => {
    process.env.ALLOW_SANDBOX_PAYMENTS = 'true';
    process.env.GCLOUD_PROJECT = 'umnotho-staging';
    process.env.SANDBOX_PROJECT_ALLOWLIST = 'umnotho-staging';
    expect(sandboxAllowed()).toBe(true);
  });

  it('allows demo projects with the flag, and refuses without it', () => {
    process.env.GCLOUD_PROJECT = 'demo-umnotho';
    expect(sandboxAllowed()).toBe(false);
    process.env.ALLOW_SANDBOX_PAYMENTS = 'true';
    expect(sandboxAllowed()).toBe(true);
  });
});
