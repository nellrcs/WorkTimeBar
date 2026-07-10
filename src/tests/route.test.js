var Route = require('../js/Route.class')

describe('Route', () => {
    test('check url empty fallback', () => {
       let route = new Route(''); 
       expect(route.filename).toBe('/dist/painel.html');
    });

    test('check root url', () => {
       let route = new Route('/'); 
       expect(route.filename).toBe('/dist/painel.html');
    });

    test('check floating path', () => {
       let route = new Route('/floating'); 
       expect(route.filename).toBe('/dist/index.html');
    });
});