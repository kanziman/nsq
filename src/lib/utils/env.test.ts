import { describe, it, expect, afterEach } from 'vitest';
import { isProductionDeploy } from './env';

// process.env.VERCEL을 케이스별로 조작하고 매번 원복한다.
const ORIGINAL = process.env.VERCEL;
afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = ORIGINAL;
  }
});

describe('isProductionDeploy', () => {
  it("should return true when process.env.VERCEL === '1'", () => {
    process.env.VERCEL = '1';
    expect(isProductionDeploy()).toBe(true);
  });

  it('should return false when process.env.VERCEL is undefined', () => {
    delete process.env.VERCEL;
    expect(isProductionDeploy()).toBe(false);
  });

  it("should return false when process.env.VERCEL === '0'", () => {
    process.env.VERCEL = '0';
    expect(isProductionDeploy()).toBe(false);
  });
});
