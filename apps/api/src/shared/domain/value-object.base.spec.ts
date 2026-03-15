import { ValueObject } from './value-object.base';

class TestVO extends ValueObject<{ name: string; age: number }> {
  get name() {
    return this.props.name;
  }
}

class OtherVO extends ValueObject<{ name: string; age: number }> {}

describe('ValueObject', () => {
  it('should freeze props on construction', () => {
    const vo = new TestVO({ name: 'Alice', age: 30 });

    expect(() => {
      (vo as any).props.name = 'Bob';
    }).toThrow();
  });

  it('equals() returns true for same props and same type', () => {
    const a = new TestVO({ name: 'Alice', age: 30 });
    const b = new TestVO({ name: 'Alice', age: 30 });

    expect(a.equals(b)).toBe(true);
  });

  it('equals() returns false for different props', () => {
    const a = new TestVO({ name: 'Alice', age: 30 });
    const b = new TestVO({ name: 'Bob', age: 30 });

    expect(a.equals(b)).toBe(false);
  });

  it('equals() returns false for different type with same props', () => {
    const a = new TestVO({ name: 'Alice', age: 30 });
    const b = new OtherVO({ name: 'Alice', age: 30 });

    expect(a.equals(b)).toBe(false);
  });

  it('equals() returns false for null/undefined', () => {
    const a = new TestVO({ name: 'Alice', age: 30 });

    expect(a.equals(null as any)).toBe(false);
    expect(a.equals(undefined as any)).toBe(false);
  });

  it('exposes props via subclass getter', () => {
    const vo = new TestVO({ name: 'Alice', age: 30 });

    expect(vo.name).toBe('Alice');
  });
});
