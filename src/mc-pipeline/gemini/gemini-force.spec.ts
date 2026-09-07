import { resolveForceRecompute } from './gemini-force';

describe('resolveForceRecompute', () => {
  const argv = process.argv;
  const env = process.env.MC1_FORCE_GEMINI;

  afterEach(() => {
    process.argv = argv;
    if (env === undefined) delete process.env.MC1_FORCE_GEMINI;
    else process.env.MC1_FORCE_GEMINI = env;
  });

  it('never defaults to force', () => {
    process.argv = ['node', 'script.ts'];
    delete process.env.MC1_FORCE_GEMINI;
    expect(resolveForceRecompute()).toBe(false);
  });

  it('MC1_FORCE_GEMINI=1 enables force', () => {
    process.argv = ['node', 'script.ts'];
    process.env.MC1_FORCE_GEMINI = '1';
    expect(resolveForceRecompute()).toBe(true);
  });
});
