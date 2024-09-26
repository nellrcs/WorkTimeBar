var Route = require('../js/Route.class')


describe('Route', () => {
    test('chek url empty', () => {
       let route = new Route(''); 
      expect(route.filename).toBe('/src/painel.html');
    });

    test('chek url ', () => {
        let url = '/src/js/backoff.js';
        let route = new Route(url); 
       expect(route.filename).toBe(url);
    });
});