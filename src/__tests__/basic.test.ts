// src/__tests__/basic.test.ts

describe('Basic Jest Test', () => {
  it('should run a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should test basic string operations', () => {
    const message = 'Hello, World!';
    expect(message.length).toBe(13);
    expect(message.toUpperCase()).toBe('HELLO, WORLD!');
  });

  it('should test async operations', async () => {
    const promise = Promise.resolve('async result');
    const result = await promise;
    expect(result).toBe('async result');
  });
});
