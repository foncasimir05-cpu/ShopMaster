const { toPositional, san } = require('../src/config/dbHelpers');

describe('toPositional', () => {
  test('passes through SQL with no placeholders', () => {
    expect(toPositional('SELECT 1')).toBe('SELECT 1');
  });

  test('converts a single ? to $1', () => {
    expect(toPositional('SELECT * FROM t WHERE id = ?')).toBe('SELECT * FROM t WHERE id = $1');
  });

  test('converts multiple ? in order', () => {
    expect(toPositional('INSERT INTO t (a,b,c) VALUES (?,?,?)')).toBe(
      'INSERT INTO t (a,b,c) VALUES ($1,$2,$3)'
    );
  });

  test('handles mixed WHERE with three params', () => {
    expect(toPositional('WHERE a=? AND b=? AND c=?')).toBe('WHERE a=$1 AND b=$2 AND c=$3');
  });

  test('is stateless across calls', () => {
    toPositional('SELECT ? WHERE ?');
    expect(toPositional('SELECT ?')).toBe('SELECT $1');
  });
});

describe('san', () => {
  test('returns empty array unchanged', () => {
    expect(san([])).toEqual([]);
  });

  test('replaces undefined with null', () => {
    expect(san([1, undefined, 'hello'])).toEqual([1, null, 'hello']);
  });

  test('leaves null as null', () => {
    expect(san([null, null])).toEqual([null, null]);
  });

  test('leaves 0 and false untouched', () => {
    expect(san([0, false, ''])).toEqual([0, false, '']);
  });

  test('does not mutate the original array', () => {
    const original = [1, undefined];
    san(original);
    expect(original[1]).toBe(undefined);
  });
});
