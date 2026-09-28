const { detectPriority } = require('../src/utils/priority');

describe('detectPriority', () => {
  it('defaults to MEDIUM when no priority is requested and no urgent keywords appear', () => {
    expect(detectPriority('Squeaky door', 'The hinge squeaks a bit', undefined)).toBe('MEDIUM');
  });

  it('honors an explicit LOW/MEDIUM/HIGH selection when no urgent keywords appear', () => {
    expect(detectPriority('Paint chipping', 'Some paint is chipping in the hallway', 'LOW')).toBe('LOW');
    expect(detectPriority('Slow drain', 'The bathroom sink drains slowly', 'HIGH')).toBe('HIGH');
  });

  it('falls back to MEDIUM for an invalid requested priority', () => {
    expect(detectPriority('Test', 'Test description', 'NOT_A_PRIORITY')).toBe('MEDIUM');
  });

  it('overrides to URGENT when the title contains an urgent keyword', () => {
    expect(detectPriority('No heat', 'Just started today', 'LOW')).toBe('URGENT');
  });

  it('overrides to URGENT when the description contains an urgent keyword, case-insensitively', () => {
    expect(detectPriority('Kitchen issue', 'There is a GAS SMELL near the stove', 'LOW')).toBe('URGENT');
  });

  it('overrides to URGENT regardless of the tenant-selected priority', () => {
    expect(detectPriority('Bathroom', 'There is flooding under the sink', 'HIGH')).toBe('URGENT');
  });

  it('does not false-positive on unrelated text', () => {
    expect(detectPriority('Broken tile', 'One tile in the bathroom floor is cracked', 'MEDIUM')).toBe(
      'MEDIUM'
    );
  });
});
