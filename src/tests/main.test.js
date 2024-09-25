describe('Tests', () => {
    test('test1', () => {
        expect(1+1).toBe(2);
    });
    test('test2', () => {
        expect(5.6).toBeCloseTo(5.6);
    });
    test('test3', () => {
        expect(1+1).toEqual(2);
    });
    test('test4', () => {
        expect(1+1).toStrictEqual(2);
    });
});