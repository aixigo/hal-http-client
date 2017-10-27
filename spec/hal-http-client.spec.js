/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
import * as halHttp from '../hal-http-client';
// We need the server version, so that node-fetch is loaded as well. This can be changed if the tests are
// run in a real browser environment. Currently they are only executed by jasmine in a node environment.
import fetchMock from 'fetch-mock/src/server';
import { data as specData, baseUrl } from './spec-data';

describe( 'The hal http client module', () => {

   it( 'has a create function', () => {
      expect( halHttp.create ).toBeDefined();
   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   it( 'has a method to remove hal specific properties from a response', () => {
      expect( halHttp.removeHalKeys( {
         _links: { self: 'xxx' },
         _embedded: { rel: { property: 1 } },
         property: 42,
         car: { color: 'red' }
      } ) ).toEqual( {
         property: 42,
         car: { color: 'red' }
      } );
      expect( halHttp.removeHalKeys( null ) ).toEqual( null );
   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   it( 'has a function to test if a relation can be followed (ATP-9441)', () => {
      expect( halHttp.canFollow( { }, 'relation' ) ).toBe( false );
      expect( halHttp.canFollow( { _links: { relation: {} } }, 'relation' ) ).toBe( true );
      expect( halHttp.canFollow( { _embedded: { relation: {} } }, 'relation' ) ).toBe( true );
      expect( halHttp.canFollow( {
         _links: { relation: {} },
         _embedded: { relation: {} }
      }, 'relation' ) ).toBe( true );
   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   it( 'has a function to retrieve the url of the first entry from a relation (ATP-9503)', () => {
      expect( halHttp.firstRelationHref( { }, 'relation' ) ).toBe( null );
      expect( halHttp.firstRelationHref( {
         _links: { relation: { href: 'fancyUrl' } }
      }, 'relation' ) ).toEqual( 'fancyUrl' );

      expect( halHttp.firstRelationHref( {
         _links: { relation: [ { href: 'fancyUrl' }, { href: 'tooFancyUrl' } ] }
      }, 'relation' ) ).toEqual( 'fancyUrl' );

      expect( halHttp.firstRelationHref( {
         _embedded: { relation: { _links: { self: { href: 'embeddedFancyUrl' } } } }
      }, 'relation' ) ).toEqual( 'embeddedFancyUrl' );

      expect( halHttp.firstRelationHref( {
         _links: { relation: { href: 'linkedFancyUrl' } },
         _embedded: { relation: { _links: { self: { href: 'embeddedFancyUrl' } } } }
      }, 'relation' ) ).toEqual( 'linkedFancyUrl' );
   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   it( 'has a function to retrieve the self link of a representation (#17)', () => {
      expect( halHttp.selfLink( { } ) ).toBe( null );
      expect( halHttp.selfLink( {
         _links: { self: { href: '/self' } }
      } ) ).toEqual( '/self' );
   } );

} );

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

describe( 'A hal client instance', () => {

   const url = path => `${baseUrl}${path}`;

   let hal;

   let data;
   let onSpy200;
   let onSpy2xx;
   let onSpy404;
   let onSpyXxx;
   let onSpy5xxGlobal;
   let thenResolvedSpy;
   let thenRejectedSpy;
   let responseTransformerSpy;

   beforeEach( () => {
      data = JSON.parse( JSON.stringify( specData ) );

      onSpy200 = jasmine.createSpy( 'onSpy200' );
      onSpy2xx = jasmine.createSpy( 'onSpy2xx' );
      onSpy404 = jasmine.createSpy( 'onSpy404' );
      onSpyXxx = jasmine.createSpy( 'onSpyXxx' );
      onSpy5xxGlobal = jasmine.createSpy( 'onSpy5xxGlobal' );
      thenResolvedSpy = jasmine.createSpy( 'thenResolvedSpy' );
      thenRejectedSpy = jasmine.createSpy( 'thenRejectedSpy' );
      responseTransformerSpy = jasmine.createSpy( 'responseTransformerSpy' ).and.callFake( _ => _ );

      hal = halHttp.create( {
         headers: { 'accept-language': 'de' },
         on: { '5xx': onSpy5xxGlobal },
         responseTransformer: responseTransformerSpy,
         fetchInit: {
            mode: 'cors'
         }
      } );
   } );

   afterEach( fetchMock.restore );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'on successful GET', () => {

      beforeEach( async () => {
         fetchMock.get( url( '/resource' ), {
            status: 200,
            body: {
               _links: { self: { href: url( '/resource' ) } },
               value: 123
            }
         } );

         const promise = hal.get( url( '/resource' ), {
            headers: {
               'x-custom-header': 'such header'
            },
            fetchInit: {
               cache: 'no-store'
            }
         } );
         promise.then( thenResolvedSpy, thenRejectedSpy );
         await promise.on( {
            '200': onSpy200,
            '2xx': onSpy2xx,
            '404': onSpy404
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'calls the configured response transformer', () => {
         expect( responseTransformerSpy ).toHaveBeenCalled();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'resolves the simple promise', () => {
         expect( thenResolvedSpy ).toHaveBeenCalled();
         expect( thenRejectedSpy ).not.toHaveBeenCalled();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'calls the most specific matching on handler', () => {
         expect( onSpy200 ).toHaveBeenCalled();
         expect( onSpy2xx ).not.toHaveBeenCalled();
         expect( onSpy404 ).not.toHaveBeenCalled();
         expect( onSpy5xxGlobal ).not.toHaveBeenCalled();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'sends default safe, global and local headers along', () => {
         expect( fetchMock.lastOptions().headers ).toEqual( {
            'accept': 'application/hal+json',
            'accept-language': 'de',
            'x-custom-header': 'such header'
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'passes additional fetch init config to fetch', () => {
         expect( fetchMock.lastOptions().mode ).toEqual( 'cors' );
         expect( fetchMock.lastOptions().cache ).toEqual( 'no-store' );
      } );

   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'on failed GET with error 404', () => {

      beforeEach( async () => {
         fetchMock.get( url( '/resource' ), { status: 404 } );
         const promise = hal.get( url( '/resource' ) );
         promise.then( thenResolvedSpy, thenRejectedSpy );
         await promise.on( {
            '200': onSpy200,
            '2xx': onSpy2xx,
            '404': onSpy404
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'resolves the simple promise', () => {
         expect( thenResolvedSpy ).toHaveBeenCalled();
         expect( thenRejectedSpy ).not.toHaveBeenCalled();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'calls the most specific matching on handler', () => {
         expect( onSpy200 ).not.toHaveBeenCalled();
         expect( onSpy2xx ).not.toHaveBeenCalled();
         expect( onSpy404 ).toHaveBeenCalled();
         expect( onSpy5xxGlobal ).not.toHaveBeenCalled();
      } );

   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'on failed GET with error 500', () => {

      beforeEach( async () => {
         fetchMock.get( url( '/resource' ), { status: 500 } );
         const promise = hal.get( url( '/resource' ) );
         promise.then( thenResolvedSpy, thenRejectedSpy );
         await promise.on( {
            '200': onSpy200,
            '2xx': onSpy2xx,
            '404': onSpy404
         } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'resolves the simple promise', () => {
         expect( thenResolvedSpy ).toHaveBeenCalled();
         expect( thenRejectedSpy ).not.toHaveBeenCalled();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'calls the most specific matching on handler (in this case the global handler)', () => {
         expect( onSpy200 ).not.toHaveBeenCalled();
         expect( onSpy2xx ).not.toHaveBeenCalled();
         expect( onSpy404 ).not.toHaveBeenCalled();
         expect( onSpy5xxGlobal ).toHaveBeenCalled();
      } );

   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'on network error', () => {

      beforeEach( async () => {
         fetchMock.get( url( '/resource' ), { throws: 'network error' } );
         const promise = hal.get( url( '/resource' ) );
         promise.then( thenResolvedSpy, thenRejectedSpy );
         await promise.on( { 'xxx': onSpyXxx } ).catch( () => {} );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'rejects the simple promise', () => {
         expect( thenResolvedSpy ).not.toHaveBeenCalled();
         expect( thenRejectedSpy ).toHaveBeenCalledWith( 'network error' );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'calls no on handler', () => {
         expect( onSpyXxx ).not.toHaveBeenCalled();
      } );

   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'if a matching global handler is more specfic than a matching local handler', () => {

      beforeEach( async () => {
         fetchMock.get( url( '/resource' ), { status: 500 } );
         await hal.get( url( '/resource' ) ).on( { 'xxx': onSpyXxx } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'still prefers the more unspecific local handler', () => {
         expect( onSpyXxx ).toHaveBeenCalled();
         expect( onSpy5xxGlobal ).not.toHaveBeenCalled();
      } );

   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'for multiple GETs during the same tick', () => {

      let promise1;
      let promise2;
      let promise3;
      let promise4;
      let promise5;

      beforeEach( async () => {
         fetchMock.get( url( '/resource' ), {
            status: 200,
            body: { value: 123 }
         } );
         promise1 = hal.get( url( '/resource' ) );
         promise2 = hal.get( url( '/resource' ) );
         promise3 = hal.get( url( '/resource' ) );

         promise4 = hal.get( url( '/resource' ), { headers: { 'X-Whatever': 'abc123' } } );
         promise5 = hal.get( url( '/resource' ), { headers: { 'X-Whatever': 'abc123' } } );
         await Promise.all( [ promise1, promise5 ] );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'returns the promise of the first request when url and headers match', () => {
         expect( promise1 ).toBe( promise2 );
         expect( promise2 ).toBe( promise3 );
         expect( promise4 ).toBe( promise5 );
         expect( promise1 ).not.toBe( promise4 );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'returns a new promise in the next tick', () => {
         expect( promise1 ).not.toBe( hal.get( url( '/resource' ) ) );
      } );

   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   [ 'PUT', 'POST', 'PATCH', 'DELETE' ].forEach( method => {

      describe( `on successful ${method}`, () => {

         beforeEach( async () => {
            fetchMock.mock( url( '/resource' ), { status: 200 }, { method } );

            const options = {
               headers: { 'X-Custom-Header': 'such header' },
               fetchInit: { cache: 'reload' }
            };
            const promise = method === 'DELETE' ?
               hal[ method.toLowerCase() ]( url( '/resource' ), options ) :
               hal[ method.toLowerCase() ]( url( '/resource' ), { my: 'data' }, options );

            promise.then( thenResolvedSpy, thenRejectedSpy );
            await promise.on( {
               '200': onSpy200,
               '2xx': onSpy2xx,
               '404': onSpy404
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'calls the configured response transformer', () => {
            expect( responseTransformerSpy ).toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'resolves the simple promise', () => {
            expect( thenResolvedSpy ).toHaveBeenCalled();
            expect( thenRejectedSpy ).not.toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'calls the most specific matching on handler', () => {
            expect( onSpy200 ).toHaveBeenCalled();
            expect( onSpy2xx ).not.toHaveBeenCalled();
            expect( onSpy404 ).not.toHaveBeenCalled();
            expect( onSpy5xxGlobal ).not.toHaveBeenCalled();
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'sends default unsafe, global and local headers along', () => {
            expect( fetchMock.lastOptions().headers ).toEqual( {
               'accept': 'application/hal+json',
               'accept-language': 'de',
               'content-type': method === 'PATCH' ? 'application/json-patch+json' : 'application/json',
               'x-custom-header': 'such header'
            } );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         it( 'passes additional fetch init config to fetch', () => {
            expect( fetchMock.lastOptions().mode ).toEqual( 'cors' );
            expect( fetchMock.lastOptions().cache ).toEqual( 'reload' );
         } );

         /////////////////////////////////////////////////////////////////////////////////////////////////////

         if( method !== 'DELETE' ) {
            it( 'sends the data as stringified request body', () => {
               expect( fetchMock.lastOptions().body ).toEqual( JSON.stringify( { my: 'data' } ) );
            } );
         }

      } );

   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'with follow relation functions', () => {

      let rootHalResource;

      beforeEach( () => {
         rootHalResource = data.ROOT;

         fetchMock.get( url( '/me/cars' ), { status: 200, body: data.CARS } );
         fetchMock.get( url( '/me/cars/0' ), { status: 200, body: data.CARS._embedded.car[ 0 ] } );
         fetchMock.get( url( '/me/cars/1' ), { status: 200, body: data.CARS._embedded.car[ 1 ] } );
         fetchMock.get( url( '/me/pets' ), { status: 200, body: data.PETS } );
         fetchMock.get( url( '/me/pets/0' ), { status: 200, body: data.PETS._embedded.pet[ 0 ] } );

         spyOn( hal, 'follow' ).and.callThrough();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'takes resources from the representation if already embedded', async () => {
         await hal.follow( rootHalResource, 'address' ).then( thenResolvedSpy, thenRejectedSpy );

         expect( fetchMock.called() ).toBe( false );
         expect( thenResolvedSpy ).toHaveBeenCalledWith( jasmine.objectContaining( { status: 200 } ) );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'calls the most specific matching on handler', async () => {
         await hal.follow( rootHalResource, 'address' ).on( {
            '200': onSpy200,
            '2xx': onSpy2xx
         } );

         expect( onSpy200 ).toHaveBeenCalledWith(
            rootHalResource._embedded.address,
            jasmine.objectContaining( { status: 200 } )
         );
         expect( onSpy2xx ).not.toHaveBeenCalled();
         expect( onSpy5xxGlobal ).not.toHaveBeenCalled();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'calls the "norel" handler if the relation is missing', async () => {
         const onSpyNorel = jasmine.createSpy( 'onSpyNorel' );
         await hal.follow( rootHalResource, 'i-dont-exist' ).on( {
            '200': onSpy200,
            '2xx': onSpy2xx,
            'norel': onSpyNorel
         } );

         expect( onSpyNorel ).toHaveBeenCalledWith(
            null,
            jasmine.objectContaining( {
               status: 'norel',
               info: { relation: 'i-dont-exist', halRepresentation: rootHalResource }
            } )
         );
         expect( onSpy200 ).not.toHaveBeenCalled();
         expect( onSpy2xx ).not.toHaveBeenCalled();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'makes a GET request for a resource that is not embedded', async () => {
         await hal.follow( rootHalResource, 'cars' ).then( thenResolvedSpy, thenRejectedSpy );

         expect( fetchMock.lastUrl() ).toEqual( url( '/me/cars' ) );
         expect( thenResolvedSpy ).toHaveBeenCalledWith( jasmine.objectContaining( { status: 200 } ) );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'follows a complete collection if followAll is true', async () => {
         await hal.follow( rootHalResource, 'car', { followAll: true } )
            .then( thenResolvedSpy, thenRejectedSpy );

         expect( fetchMock.called( url( '/me/cars/0' ) ) ).toBe( true );
         expect( fetchMock.called( url( '/me/cars/1' ) ) ).toBe( true );

         const [ callArgs ] = thenResolvedSpy.calls.argsFor( 0 );
         expect( callArgs[ 0 ].status ).toEqual( 200 );
         expect( callArgs[ 1 ].status ).toEqual( 200 );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'follows a complete collection if followAll is true although there is only one link', async () => {
         await hal.follow( rootHalResource, 'pet', { followAll: true } )
            .then( thenResolvedSpy, thenRejectedSpy );

         expect( fetchMock.called( url( '/me/pets/0' ) ) ).toBe( true );

         const [ callArgs ] = thenResolvedSpy.calls.argsFor( 0 );
         expect( callArgs[ 0 ].status ).toEqual( 200 );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'defines followAll as shortcut for follow with followAll being true', async () => {
         await hal.followAll( rootHalResource, 'pet', { headers: { 'X-More-Headers': 'yay' } } )
            .then( thenResolvedSpy, thenRejectedSpy );

         expect( fetchMock.called( url( '/me/pets/0' ) ) ).toBe( true );
         expect( fetchMock.lastOptions( url( '/me/pets/0' ) ).headers ).toEqual( {
            'accept': 'application/hal+json',
            'accept-language': 'de',
            'x-more-headers': 'yay'
         } );

         const [ callArgs ] = thenResolvedSpy.calls.argsFor( 0 );
         expect( callArgs[ 0 ].status ).toEqual( 200 );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'can follow a set of embedded resources', async () => {
         await hal.followAll( data.CARS, 'car' ).then( thenResolvedSpy, thenRejectedSpy );

         expect( fetchMock.called() ).toBe( false );

         const [ callArgs ] = thenResolvedSpy.calls.argsFor( 0 );
         expect( callArgs[ 0 ].status ).toEqual( 200 );
         expect( callArgs[ 1 ].status ).toEqual( 200 );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'can follow a set of embedded resources although there is only one element embedded', async () => {
         const carData = data.CARS;
         carData._embedded.car = carData._embedded.car[ 0 ];
         await hal.followAll( carData, 'car' ).then( thenResolvedSpy, thenRejectedSpy );

         const [ callArgs ] = thenResolvedSpy.calls.argsFor( 0 );
         expect( callArgs[ 0 ].status ).toEqual( 200 );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      // eslint-disable-next-line max-len
      it( 'can follow an empty set of embedded resources and passes an empty list of responses with overall status 200', async () => {
         const carData = data.CARS;
         carData._embedded.car = [];
         await hal.followAll( carData, 'car' ).on( {
            '200': onSpy200,
            '2xx': onSpy2xx,
            'xxx': onSpyXxx
         } );

         expect( onSpy200 ).toHaveBeenCalledWith( [], jasmine.any( Object ) );
         expect( onSpy2xx ).not.toHaveBeenCalled();
         expect( onSpyXxx ).not.toHaveBeenCalled();
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'calls a matching on handler if the status codes of all responses are the same', async () => {
         await hal.followAll( rootHalResource, 'car' ).on( {
            '200': onSpy200,
            '2xx': onSpy2xx,
            'xxx': onSpyXxx
         } );

         const [ values, responses ] = onSpy200.calls.argsFor( 0 );
         expect( onSpy200 ).toHaveBeenCalled();
         expect( onSpy2xx ).not.toHaveBeenCalled();
         expect( onSpyXxx ).not.toHaveBeenCalled();
         expect( values[ 0 ] ).toEqual( data.CARS._embedded.car[ 0 ] );
         expect( values[ 1 ] ).toEqual( data.CARS._embedded.car[ 1 ] );
         expect( responses[ 0 ].status ).toEqual( 200 );
         expect( responses[ 1 ].status ).toEqual( 200 );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'calls xxx handler if the status codes of some responses are different', async () => {
         rootHalResource._links.car.push( { href: url( '/me/cars/2' ) } );
         fetchMock.get( url( '/me/cars/2' ), { status: 404 } );
         await hal.followAll( rootHalResource, 'car' ).on( {
            '200': onSpy200,
            '2xx': onSpy2xx,
            '404': onSpy404,
            'xxx': onSpyXxx
         } );

         const [ values, responses ] = onSpyXxx.calls.argsFor( 0 );
         expect( onSpy200 ).not.toHaveBeenCalled();
         expect( onSpy2xx ).not.toHaveBeenCalled();
         expect( onSpy404 ).not.toHaveBeenCalled();
         expect( onSpyXxx ).toHaveBeenCalled();
         expect( responses[ 0 ].status ).toEqual( 200 );
         expect( responses[ 1 ].status ).toEqual( 200 );
         expect( responses[ 2 ].status ).toEqual( 404 );
         expect( values[ 0 ] ).toEqual( data.CARS._embedded.car[ 0 ] );
         expect( values[ 1 ] ).toEqual( data.CARS._embedded.car[ 1 ] );
         expect( values[ 2 ] ).toEqual( null );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'has a utility function to create a simple follow handler', async () => {
         const addressFollower = hal.thenFollow( 'address' );

         await addressFollower( rootHalResource ).then( thenResolvedSpy, thenRejectedSpy );
         await addressFollower( rootHalResource ).on( { '200': onSpy200 } );

         expect( thenResolvedSpy ).toHaveBeenCalledWith( jasmine.objectContaining( { status: 200 } ) );

         const [ value ] = onSpy200.calls.argsFor( 0 );
         expect( value ).toEqual( rootHalResource._embedded.address );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'has a utility function to create a simple followAll handler', async () => {
         const carFollower = hal.thenFollowAll( 'car' );

         await carFollower( rootHalResource ).then( thenResolvedSpy, thenRejectedSpy );
         await carFollower( rootHalResource ).on( { '200': onSpy200 } );

         const [ callArgs ] = thenResolvedSpy.calls.argsFor( 0 );
         expect( callArgs[ 0 ].status ).toEqual( 200 );
         expect( callArgs[ 1 ].status ).toEqual( 200 );

         const [ values ] = onSpy200.calls.argsFor( 0 );
         expect( values[ 0 ] ).toEqual( data.CARS._embedded.car[ 0 ] );
         expect( values[ 1 ] ).toEqual( data.CARS._embedded.car[ 1 ] );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'supports following simple path fragment templated URIs', async () => {
         fetchMock.get( url( '/me/carsByType/VW' ), { status: 200, body: {} } );

         await hal.follow( data.CARS, 'carsByType', {
            vars: {
               type: 'VW'
            }
         } );
         expect( fetchMock.called( url( '/me/carsByType/VW' ) ) ).toBe( true );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'supports following simple query string templated URIs', async () => {
         fetchMock.get( url( '/me/carsByModel?model=DeLorean' ), { status: 200, body: {} } );

         await hal.follow( data.CARS, 'carsByModel', {
            vars: {
               model: 'DeLorean'
            }
         } );

         expect( fetchMock.called( url( '/me/carsByModel?model=DeLorean' ) ) ).toBe( true );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'supports following simple query and query continuation string templated URIs', async () => {
         fetchMock.get( url( '/me/carsByTypeAndModel?type=VW&model=DeLorean' ), { status: 404 } );

         await hal.follow( data.CARS, 'carsByTypeAndModel', {
            vars: {
               type: 'VW',
               model: 'DeLorean'
            }
         } );

         expect( fetchMock.called( url( '/me/carsByTypeAndModel?type=VW&model=DeLorean' ) ) ).toBe( true );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'URI encodes simple query and query continuation string templated URIs', async () => {
         fetchMock
            .get( url( '/me/carsByTypeAndModel?type=Daimler%20Benz&model=T%201000%2B' ), { status: 404 } );

         await hal.follow( data.CARS, 'carsByTypeAndModel', {
            vars: {
               type: 'Daimler Benz',
               model: 'T 1000+'
            }
         } );

         expect( fetchMock.called( url( '/me/carsByTypeAndModel?type=Daimler%20Benz&model=T%201000%2B' ) ) )
            .toBe( true );
      } );

   } );

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   describe( 'configured to queue unsafe requests', () => {

      beforeEach( () => {
         fetchMock.post( 'first', { status: 201 } );
         fetchMock.post( 'firstFails', { throws: 'network down!' } );
         fetchMock.post( 'second', { status: 201 } );

         hal = halHttp.create( { queueUnsafeRequests: true } );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'only starts the next request if the previous was fulfilled', async () => {
         const firstRequest = hal.post( 'first', {} );
         hal.post( 'second', {} );

         expect( fetchMock.called( 'first' ) ).toBe( true );
         expect( fetchMock.called( 'second' ) ).toBe( false );

         await firstRequest;

         expect( fetchMock.called( 'second' ) ).toBe( true );
      } );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      it( 'only starts the next request if the previous was rejected', async () => {
         const firstRequest = hal.post( 'firstFails', {} );
         hal.post( 'second', {} );

         expect( fetchMock.called( 'firstFails' ) ).toBe( true );
         expect( fetchMock.called( 'second' ) ).toBe( false );

         await firstRequest.catch( () => {} );

         expect( fetchMock.called( 'second' ) ).toBe( true );
      } );

   } );

} );
