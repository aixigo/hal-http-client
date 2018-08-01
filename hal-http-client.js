/**
 * Copyright 2017 aixigo AG
 * Released under the MIT license.
 * http://laxarjs.org/license
 */
/**
 * A _status code driven_ JSON [HAL](http://stateless.co/hal_specification.html) HTTP client based on the
 * [fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
 *
 * @module hal-http-client
 */

import template from 'url-template';

/**
 * Default headers used with safe http methods.
 *
 * @type {Object}
 * @private
 */
const DEFAULT_SAFE_HEADERS = {
   'accept': 'application/hal+json, application/json;q=0.8'
};

/**
 * Default headers used with unsafe http methods.
 *
 * @type {Object}
 * @private
 */
const DEFAULT_UNSAFE_HEADERS = {
   ...DEFAULT_SAFE_HEADERS,
   'content-type': 'application/json'
};

/**
 * Default headers used with the PATCH http methods.
 *
 * @type {Object}
 * @private
 */
const DEFAULT_PATCH_HEADERS = {
   ...DEFAULT_SAFE_HEADERS,
   'content-type': 'application/json-patch+json'
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Virtual status code `'norel'` for a missing relation to use as key in the `on`-handlers map.
 *
 * @name STATUS_NOREL
 * @type {String}
 */
export const STATUS_NOREL = 'norel';

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a new http client for usage with a RESTful backend supporting the content type
 * `application/hal+json` (https://tools.ietf.org/html/draft-kelly-json-hal-06).
 *
 * Example:
 * ```js
 * const hal = create( {
 *    on: {
 *       'xxx'( data, response ) {
 *          console.log( 'I\'ll handle everything not handled locally' );
 *       }
 *    }
 * } );
 *
 * hal.get( 'http://host/someResource' )
 *    .on( {
 *       '2xx'( data, response ) {
 *          console.log( 'Everything looks fine: ', data );
 *          return hal.follow( data, 'some-relation' );
 *       },
 *       '4xx|5xx'( data, response ) {
 *          console.log( 'Server or client failed. Who knows? The status!', response.status );
 *       }
 *    } )
 *    // handle the response from following 'some-relation'
 *    .on( {
 *       '200'( data, response ) {
 *          console.log( 'I got this: ', data );
 *       },
 *       'norel'() {
 *           console.log( 'Oh no, seems "some-relation" is missing in the representation' );
 *       }
 *    } );
 * ```
 *
 * See {@link #ResponsePromise} for further information on the `on` function.
 *
 * @param {Object} [optionalOptions]
 *    map of global configuration to use for the HAL client
 * @param {Boolean} [optionalOptions.queueUnsafeRequests]
 *    if `true` an unsafe request (DELETE, PATCH, POST and PUT) has to be finished before the next is started.
 *    Default is `false`
 * @param {Object} [optionalOptions.headers]
 *    global headers to send along with every request
 * @param {Object} [optionalOptions.fetchInit]
 *    additional init options for `fetch` to be used with every request. The keys `headers`, `body` and
 *    `method` are ignored from this option, since they are either parameters on their own or implemented as
 *    specific function.
 * @param {Object} [optionalOptions.on]
 *    global `on` handlers to use as fallback if no matching handler was found in an `on` call
 * @param {Function} [optionalOptions.responseTransformer]
 *    a function that is called for every response and must return an optionally transformed version of
 *    that response. This can e.g. be used for URL rewriting of proxied requests during development. This
 *    should not be used in production for transformation of actual data
 * @param {Function} [optionalOptions.logError]
 *    a function to log error messages to. By default `console.error` is used
 * @param {Function} [optionalOptions.logDebug]
 *    a function to log debug / development messages to. By default `console.debug` is used
 *
 * @return {HalHttpClient}
 *    a new HAL client instance
 */
export function create( optionalOptions = {} ) {

   const getPromiseCache = {};
   const globalOptions = {
      queueUnsafeRequests: false,
      headers: {},
      fetchInit: {},
      on: {},
      responseTransformer: response => response,
      logError: msg => { console.error( msg ); }, // eslint-disable-line no-console
      logDebug: msg => { console.debug( msg ); }, // eslint-disable-line no-console
      ...optionalOptions
   };
   const { logError, logDebug } = globalOptions;
   const globalOnHandlers = expandHandlers( globalOptions.on );

   /**
    * @constructor
    * @name HalHttpClient
    */
   const api = {
      get,
      head,
      put,
      post,
      patch,
      del,
      delete: del,
      follow,
      followAll,
      thenFollow,
      thenFollowAll
   };

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Makes a GET request for the given URL or HAL representation. In case a HAL representation is given,
    * the `self` relation in the `_links` map is used to derive the URL for the request.
    *
    * @param {String|Object} urlOrHalRepresentation
    *    a URL or a HAL representation to make the request for
    * @param {Object} [optionalOptions]
    *    configuration to use for the request
    * @param {Object} [optionalOptions.headers]
    *    headers to send along with the request. By default,
    *    `Accept: application/hal+json, application/json;q=0.8` is added to the headers
    * @param {Object} [optionalOptions.fetchInit]
    *    additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and
    *    `method` are ignored from this option, since they are either parameters on their own or implemented
    *    as specific function.
    *
    * @return {ResponsePromise}
    *    an extended promise for the response
    *
    * @memberof HalHttpClient
    */
   function get( urlOrHalRepresentation, optionalOptions ) {
      const url = extractUrl( urlOrHalRepresentation );
      const options = {
         headers: {},
         fetchInit: {},
         ...optionalOptions
      };

      const cacheKey = createCacheKey( url, createHeaders( 'GET', options.headers ) );
      if( cacheKey in getPromiseCache ) {
         return getPromiseCache[ cacheKey ];
      }

      const promise = doFetch( url, options )
         .then( response => globalOptions.responseTransformer( response ) );

      const removeFromCache = () => { delete getPromiseCache[ cacheKey ]; };
      promise.then( removeFromCache, removeFromCache );

      getPromiseCache[ cacheKey ] = extendResponsePromise( promise );
      return getPromiseCache[ cacheKey ];
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Makes a HEAD request for the given URL or HAL representation.
    * In case a HAL representation is given, the `self` relation in the `_links` map is used to derive the URL
    * for the request.
    *
    * @param {String|Object} urlOrHalRepresentation
    *    an URL or a HAL representation to make the request for
    * @param {Object} [optionalOptions]
    *    configuration to use for the request
    * @param {Object} [optionalOptions.headers]
    *    headers to send along with the request. By default no headers are set
    * @param {Object} [optionalOptions.fetchInit]
    *    additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and
    *    `method` are ignored from this option, since they are either parameters on their own or implemented
    *    as specific function.
    *
    * @return {ResponsePromise}
    *    an extended promise for the response
    *
    * @memberof HalHttpClient
    */
   function head( urlOrHalRepresentation, optionalOptions ) {
      const url = extractUrl( urlOrHalRepresentation );
      const options = {
         headers: {},
         fetchInit: {},
         ...optionalOptions
      };

      return extendResponsePromise( doFetch( url, options, 'HEAD' ) );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Makes a PUT request for the given URL or HAL representation. In case a HAL representation is given,
    * the `self` relation in the `_links` map is used to derive the URL for the request.
    *
    * @param {String|Object} urlOrHalRepresentation
    *    an URL or a HAL representation to make the request for
    * @param {Object} body
    *    JSON serializable body to send
    * @param {Object} [optionalOptions]
    *    configuration to use for the request
    * @param {Object} [optionalOptions.headers]
    *    headers to send along with the request. By default `Accept: application/hal+json` and
    *    `Content-Type: application/json` are added to the headers
    * @param {Object} [optionalOptions.fetchInit]
    *    additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and
    *    `method` are ignored from this option, since they are either parameters on their own or implemented
    *    as specific function.
    *
    * @return {ResponsePromise}
    *    an extended promise for the response
    *
    * @memberof HalHttpClient
    */
   function put( urlOrHalRepresentation, body, optionalOptions ) {
      return unsafeRequest( 'PUT', urlOrHalRepresentation, optionalOptions, body );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Makes a POST request for the given URL or HAL representation. In case a HAL representation is given,
    * the `self` relation in the `_links` map is used to derive the URL for the request.
    *
    * @param {String|Object} urlOrHalRepresentation
    *    an URL or a HAL representation to make the request for
    * @param {Object} body
    *    JSON serializable body to send
    * @param {Object} [optionalOptions]
    *    configuration to use for the request
    * @param {Object} [optionalOptions.headers]
    *    headers to send along with the request. By default,
    *    `Accept: application/hal+json, application/json;q=0.8` and
    *    `Content-Type: application/json` are added to the headers
    * @param {Object} [optionalOptions.fetchInit]
    *    additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and
    *    `method` are ignored from this option, since they are either parameters on their own or implemented
    *    as specific function.
    *
    * @return {ResponsePromise}
    *    an extended promise for the response
    *
    * @memberof HalHttpClient
    */
   function post( urlOrHalRepresentation, body, optionalOptions ) {
      return unsafeRequest( 'POST', urlOrHalRepresentation, optionalOptions, body );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Makes a PATCH request for the given URL or HAL representation. In case a HAL representation is given,
    * the `self` relation in the `_links` map is used to derive the URL for the request.
    *
    * @param {String|Object} urlOrHalRepresentation
    *    a URL or a HAL representation to make the request for
    * @param {Object} body
    *    body in JSON Patch notation (http://tools.ietf.org/html/rfc6902)
    * @param {Object} [optionalOptions]
    *    configuration to use for the request
    * @param {Object} [optionalOptions.headers]
    *    headers to send along with the request. By default,
    *    `Accept: application/hal+json, application/json;q=0.8` and
    *    `Content-Type: application/json-patch+json` are added to the headers
    * @param {Object} [optionalOptions.fetchInit]
    *    additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and
    *    `method` are ignored from this option, since they are either parameters on their own or implemented
    *    as specific function.
    *
    * @return {ResponsePromise}
    *    an extended promise for the response
    *
    * @memberof HalHttpClient
    */
   function patch( urlOrHalRepresentation, body, optionalOptions ) {
      return unsafeRequest( 'PATCH', urlOrHalRepresentation, optionalOptions, body );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Makes a DELETE request for the given URL or HAL representation. In case a HAL representation is given,
    * the `self` relation in the `_links` map is used to derive the URL for the request.
    *
    * @param {String|Object} urlOrHalRepresentation
    *    an URL or a HAL representation to make the request for
    * @param {Object} [body]
    *    JSON serializable body to send. If you want to use options, but have no `body`, use `undefined` as
    *    value for `body`
    * @param {Object} [optionalOptions]
    *    configuration to use for the request
    * @param {Object} [optionalOptions.headers]
    *    headers to send along with the request. By default
    *    `Accept: application/hal+json, application/json;q=0.8` and
    *    `Content-Type: application/json` are added to the headers
    * @param {Object} [optionalOptions.fetchInit]
    *    additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and
    *    `method` are ignored from this option, since they are either parameters on their own or implemented
    *    as specific function.
    *
    * @return {ResponsePromise}
    *    an extended promise for the response
    *
    * @memberof HalHttpClient
    */
   function del( urlOrHalRepresentation, body, optionalOptions ) {
      return unsafeRequest( 'DELETE', urlOrHalRepresentation, optionalOptions, body );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Follows one or more resources of a relation within a given HAL representation. First it is checked if
    * a representation for the relation is already embedded and in case it exists, this will be the result.
    * If that isn't the case, the `_links` property is searched for a URL of that relation and if found, a
    * GET request for this URL is performed. If the relation could not be found in the given representation
    * the resulting promise is rejected.
    *
    * If there are multiple links or embedded resources, by default only the first one will be requested and
    * its response passed to the consumers of the promise. In case the `followAll` option is set to `true`,
    * all found embedded representations are returned or all relations found in the `_links` property are
    * requested resp.. The resulting promise will then be resolved with an array of responses instead of a
    * single response. As there might be different status codes for the responses, a specific `on` handler is
    * only called if all status codes yield the same value. In any other case *only* the handler for `xxx` is
    * called. This can be prevented, if a list resource always embeds the representations of its items.
    *
    * @param {Object} halRepresentation
    *    the representation whose relation should be followed
    * @param {String} relation
    *    the relation to follow
    * @param {Object} [optionalOptions]
    *    configuration to use for the request
    * @param {Object} [optionalOptions.method]
    *    method to use for the request(s). If not `GET`, embedded representations will be ignored. Default is
    *    `GET`
    * @param {Object} [optionalOptions.body]
    *    JSON serializable body to send
    * @param {Object} [optionalOptions.headers]
    *    headers to send along with the request. The same default headers as for `get()` are used
    * @param {Object} [optionalOptions.fetchInit]
    *    additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and
    *    `method` are ignored from this option, since they are either parameters on their own or implemented
    *    as specific function.
    * @param {Boolean} [optionalOptions.followAll]
    *    if `true`, follows all entities found for that relation. Default is `false`
    * @param {Object} [optionalOptions.vars]
    *    map of variables to replace in templated URLs
    *
    * @return {ResponsePromise}
    *    an extended promise for the response
    *
    * @memberof HalHttpClient
    */
   function follow( halRepresentation, relation, optionalOptions = {} ) {
      const options = {
         followAll: false,
         headers: {},
         fetchInit: {},
         vars: {},
         method: 'GET',
         body: undefined,
         ...optionalOptions
      };

      return extendResponsePromise( new Promise( ( resolve, reject ) => {
         if( options.method === 'GET' && path( halRepresentation, `_embedded.${relation}` ) ) {
            const embedded = halRepresentation._embedded[ relation ];
            if( options.followAll ) {
               const all = Array.isArray( embedded ) ? embedded : [ embedded ];
               resolve( all.map( data => {
                  return {
                     status: 200,
                     headers: {},
                     text: () => Promise.resolve( JSON.stringify( data ) )
                  };
               } ) );
            }
            else {
               const data = Array.isArray( embedded ) ? embedded[ 0 ] : embedded;
               resolve( {
                  status: 200,
                  headers: {},
                  text: () => Promise.resolve( JSON.stringify( data ) )
               } );
            }
         }
         else if( path( halRepresentation, `_links.${relation}` ) ) {
            const linkOrLinks = halRepresentation._links[ relation ];
            if( options.followAll ) {
               const links = Array.isArray( linkOrLinks ) ? linkOrLinks : [ linkOrLinks ];
               allSettled( links.map( link => {
                  const href = expandPossibleVars( link, options.vars );
                  return request( href );
               } ) ).then( resolve, reject );
            }
            else {
               const link = Array.isArray( linkOrLinks ) ? linkOrLinks[ 0 ] : linkOrLinks;
               const href = expandPossibleVars( link, options.vars );
               request( href ).then( resolve, reject );
            }
         }
         else {
            resolve( {
               status: STATUS_NOREL,
               info: { halRepresentation, relation },
               headers: {},
               text: () => Promise.resolve( JSON.stringify( null ) )
            } );
         }
      } ) );

      function request( href ) {
         const requestOptions = { headers: options.headers, fetchInit: options.fetchInit };
         const requestFunction = api[ options.method.toLowerCase() ];
         if( [ 'DELETE', 'PATCH', 'POST', 'PUT' ].indexOf( options.method.toUpperCase() ) !== -1 ) {
            return requestFunction( href, options.body, requestOptions );
         }
         return requestFunction( href, requestOptions );
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * A shortcut function for {@link #HalHttpClient.follow()} called with `followAll` yielding `true`:
    * `follow( halRepresentation, relation, { followAll: true } )`.
    *
    * @param {Object} halRepresentation
    *    the representation whose relation should be followed
    * @param {String} relation
    *    the relation to follow
    * @param {Object} [optionalOptions]
    *    configuration to use for the request
    * @param {Object} [optionalOptions.method]
    *    method to use for the request(s). If not `GET`, embedded representations will be ignored. Default is
    *    `GET`
    * @param {Object} [optionalOptions.body]
    *    JSON serializable body to send
    * @param {Object} [optionalOptions.headers]
    *    headers to send along with the request. The same default headers as for `get()` are used
    * @param {Object} [optionalOptions.fetchInit]
    *    additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and
    *    `method` are ignored from this option, since they are either parameters on their own or implemented
    *    as specific function.
    * @param {Object} [optionalOptions.vars]
    *    map of variables to replace in templated URLs
    *
    * @return {ResponsePromise}
    *    an extended promise for the response
    *
    * @memberof HalHttpClient
    */
   function followAll( halRepresentation, relation, optionalOptions = {} ) {
      const options = optionalOptions;
      options.followAll = true;
      return follow( halRepresentation, relation, options );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * Helper factory for `follow()` function calls. The returned function only expects a HAL representation as
    * argument, and calls {@link #HalHttpClient.follow()} using that representation as first argument.
    * The purpose of this method is the use within chained `follow()` calls, especially in `on` handlers.
    *
    * Example:
    * ```js
    * halClient.get( 'http://host/office' )
    *    .on( { '200': halClient.thenFollow( 'desk' ) } )
    *    .on( { '200': halClient.thenFollow( 'computer' ) } )
    *    .on( { '200': halClient.thenFollow( 'keyboard' ) } );
    * // ...
    * ```
    * Assuming every response yields a status of `200`, first a representation of an office resource is
    * fetched, then the `desk` relation is followed, then within the resulting representation the `computer`
    * relation is followed and finally within that representation the `keyboard` relation is followed.
    *
    * Note that this method cannot be used in an `on` handler after a `followAll` request, as there will be
    * an array of objects instead of only one object.
    *
    * @param {String} relation
    *    the relation to follow
    * @param {Object} [optionalOptions]
    *    configuration to use for the request
    * @param {Object} [optionalOptions.method]
    *    method to use for the request(s). If not `GET`, embedded representations will be ignored. Default is
    *    `GET`
    * @param {Object} [optionalOptions.body]
    *    JSON serializable body to send
    * @param {Object} [optionalOptions.headers]
    *    headers to send along with the request. The same default headers as for `get()` are used
    * @param {Object} [optionalOptions.fetchInit]
    *    additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and
    *    `method` are ignored from this option, since they are either parameters on their own or implemented
    *    as specific function.
    * @param {Boolean} [optionalOptions.followAll]
    *    if `true`, follows all entities found for that relation. Default is `false`
    *
    * @return {Function}
    *    a function calling `follow` on the response it receives
    *
    * @memberof HalHttpClient
    */
   function thenFollow( relation, optionalOptions ) {
      return function( representation ) {
         return follow( representation, relation, optionalOptions );
      };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /**
    * A shortcut function for {@link #HalHttpClient.thenFollow()} called with `followAll` yielding `true`:
    * `thenFollow( relation, { followAll: true } )`.
    *
    * @param {String} relation
    *    the relation to follow
    * @param {Object} [optionalOptions]
    *    configuration to use for the request
    * @param {Object} [optionalOptions.method]
    *    method to use for the request(s). If not `GET`, embedded representations will be ignored. Default is
    *    `GET`
    * @param {Object} [optionalOptions.body]
    *    JSON serializable body to send
    * @param {Object} [optionalOptions.headers]
    *    headers to send along with the request. The same default headers as for `get()` are used
    * @param {Object} [optionalOptions.fetchInit]
    *    additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and
    *    `method` are ignored from this option, since they are either parameters on their own or implemented
    *    as specific function.
    *
    * @return {Function}
    *    a function calling `followAll` on the response it receives
    *
    * @memberof HalHttpClient
    */
   function thenFollowAll( relation, optionalOptions ) {
      return function( representation ) {
         return followAll( representation, relation, optionalOptions );
      };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   let continuationPromise;
   function unsafeRequest( method, urlOrHalRepresentation, optionalOptions = {}, optionalBody = {} ) {
      const url = extractUrl( urlOrHalRepresentation );
      const options = {
         headers: {},
         fetchInit: {},
         ...optionalOptions
      };

      if( globalOptions.queueUnsafeRequests === true ) {
         continuationPromise = continuationPromise ? continuationPromise.then( next, next ) : next();
         return extendResponsePromise( continuationPromise );
      }

      return extendResponsePromise( next() );

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function next() {
         return doFetch( url, options, method, optionalBody ).then(
            response => globalOptions.responseTransformer( response ),
            response => Promise.reject( globalOptions.responseTransformer( response ) )
         );
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function extendResponsePromise( promise ) {

      /**
       * A simple extension of a normal
       * [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).
       * Its purpose is to add some convenience when following relations of a resource. Using the standard
       * Promise API is still possible.
       *
       * @name ResponsePromise
       * @constructor
       * @extends Promise
       */

      /**
       * A function to register handlers for the possible
       * [HTTP status codes](https://tools.ietf.org/html/rfc7231#page-47) returned by the API. This is the
       * actual heart of this library.
       *
       * This function has to be called with a map of status codes to functions responsible for handling the
       * response that was given for an actual status code. It is possible to group status codes using the
       * same handler for their codes. And lastly wildcards are possible to be able to treat a specific class
       * of status codes conveniently the same way.
       *
       * Let's have a look at an example:
       * ```js
       * const handler1 = ( result, response ) => {};
       * const handler2 = ( result, response ) => {};
       * const handler3 = ( result, response ) => {};
       * const handler4 = ( result, response ) => {};
       *
       * hal.get( 'my-resource' )
       *    .on( {
       *       '200': handler1,
       *       '201|202|204': handler2,
       *       '5xx': handler3
       *    } );
       * ```
       * Here `handler1` will only be called for status code _200_, `handler2` for the given status codes
       * _201_, _202_ and _204_, and `handler3` will be called for any type of server error. A final catch all
       * handler could have also been added simply using a full wildcard string _xxx_. Any code that is not
       * handled by this map of handlers is forwarded to the global handlers map (see {@link create()}). In
       * case there is no handler there either, this will be logged and the next returned promise will be
       * rejected.
       *
       * Each handler receives to arguments: First, the body of the response (already parsed from a JSON
       * string into a JavaScript object). The second argument is the plain response object as returned by
       * the underlying `fetch` API. In case the entries of a list resource were fetched the arguments will
       * be arrays, carrying the body and response objects of all list items.
       *
       * If the response cannot be parsed into valid JSON (for example, if the server returns an HTML error
       * page which may often happen in case of a `4xx` or `5xx`), the status code will be kept, but the
       * `result` object is set to `null`. In this case, interested handlers can still inspect the complete
       * response for details.
       *
       * Handlers can then further follow relations of the provided body object by using the convenience
       * methods {@link #HalHttpClient.follow()} or {@link #HalHttpClient.followAll()}, and returning the
       * resulting `ResponsePromise` for typical Promise-like chaining. If a handler really does nothing apart
       * from following a relation of the HAL response, a generic handler can even be created by using
       * {@link #HalHttpClient.thenFollow()} or {@link #HalHttpClient.thenFollowAll()}. In addition to the
       * http status codes and _xxx_ a "virtual" code of `'norel'` can be used to handle the case, where a
       * relation is missing in a response.
       *
       * If a handler returns nothing or `null`, and by that indicating an empty response, subsequent handlers
       * will never be called.
       *
       * *Special cases*
       *
       * - _An empty list resource_: This will be returned with overall status code _200_.
       * - _Different status codes for the list items_: This will only trigger the _xxx_ handler.
       * - _The relation to follow doesn't exist_: The _norel_ handler will be called
       *
       *
       * @param {Object} handlers
       *    the map of handlers as described above
       *
       * @return {ResponsePromise}
       *    an extended promise for the result of the handler that was called
       *
       * @memberof ResponsePromise
       */
      promise.on = handlers => extendResponsePromise( promise.then( createCallStatusHandler( handlers ) ) );

      return promise;

      ////////////////////////////////////////////////////////////////////////////////////////////////////////

      function createCallStatusHandler( statusHandlers ) {
         return response => {
            if( !response ) {
               return null;
            }

            if( response.__unhandledOn ) {
               return Promise.reject( response );
            }

            let status = response.status || 'xxx';
            if( !( 'status' in response ) && Array.isArray( response ) ) {
               if( response.length ) {
                  status = response[ 0 ].status;
                  if( !response.every( _ => _.status === status ) ) {
                     status = 'xxx';
                  }
               }
               else {
                  // This is the case, when we tried to follow a list of embedded resources, but there
                  // were no entries. For list resources it hence is totally valid to be empty. If
                  // emptiness is a problem, that has to be handled later on by functional code.
                  status = 200;
               }
            }

            const handler = findBestMatchingStatusHandler( status, statusHandlers, globalOnHandlers );
            if( !handler ) {
               if( status === STATUS_NOREL ) {
                  const { relation, halRepresentation } = response.info;
                  logError( `Relation "${relation}" is missing and no ${STATUS_NOREL} handler was found.` );
                  logDebug( `Offending representation: ${JSON.stringify( halRepresentation )}` );
               }
               else if( response.config && response.config.url ) {
                  logDebug(
                     `Unhandled http status "${status}" of response for uri "${response.config.url}".`
                  );
               }
               else if( response.message && response.representation ) {
                  logError( `An error occured: ${response.message}.` );
                  logError( `Representation: ${JSON.stringify( response.representation )}.` );
               }
               else {
                  logError(
                     `Unhandled http status "${status}" of response "${JSON.stringify( response )}".`
                  );
               }

               response.__unhandledOn = true;
               return Promise.reject( response );
            }
            if( !response.__bodyPromise ) {
               if( Array.isArray( response ) ) {
                  response.__bodyPromise = Promise.all( response.map( response => response.text() ) );
               }
               else {
                  response.__bodyPromise = response.text();
               }
            }

            return response.__bodyPromise
               .then( body => {
                  let result = null;
                  if( Array.isArray( body ) ) {
                     result = body.map( _ => _ ? parseJson( _ ) : null );
                  }
                  else if( body ) {
                     result = parseJson( body );
                  }
                  return handler( result, response );
               } );

            function parseJson( json ) {
               try {
                  return JSON.parse( json );
               }
               catch( e ) {
                  // e.g. because an HTML error page was served
                  return null;
               }
            }
         };
      }
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function expandPossibleVars( link, vars ) {
      if( !link.templated ) {
         return link.href;
      }

      return template.parse( link.href ).expand( vars );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function findBestMatchingStatusHandler( status, handlers, globalHandlers ) {
      const statusStr = `${status}`;
      const localHandlers = expandHandlers( handlers );
      const statusKeys = status === STATUS_NOREL ?
         [ STATUS_NOREL ] :
         [ statusStr, `${statusStr.substr( 0, 2 )}x`, `${statusStr[ 0 ]}xx`, 'xxx' ];

      for( let i = 0, len = statusKeys.length; i < len; ++i ) {
         if( statusKeys[ i ] in localHandlers ) {
            return localHandlers[ statusKeys[ i ] ];
         }
      }

      for( let i = 0, len = statusKeys.length; i < len; ++i ) {
         if( statusKeys[ i ] in globalHandlers ) {
            return globalHandlers[ statusKeys[ i ] ];
         }
      }

      return null;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function expandHandlers( handlers ) {
      const tmp = {};

      Object.keys( handlers ).forEach( key => {
         const value = handlers[ key ];
         const keyParts = key.split( '|' );
         keyParts.forEach( keyPart => {
            tmp[ keyPart ] = value;
         } );
      } );

      return tmp;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   /*
    * Similar to `Promise.all` but waits for all promises to be fulfilled, no matter if some get rejected or
    * not.
    * The resulting promise is rejected if at least one input promise is rejected and resolved otherwise.
    * The argument array consists of all promise values, thus inspection by the application is necessary to
    * sort out the rejections.
    *
    * @private
    */
   function allSettled( promises ) {
      return new Promise( ( resolve, reject ) => {
         const finished = [];
         let waitingFor = promises.length;
         let failed = false;

         promises.forEach( ( promise, index ) => {
            promise.then( doneCallback( false ), doneCallback( true ) );

            function doneCallback( rejected ) {
               return function( result ) {
                  failed = rejected || failed;
                  finished[ index ] = result;
                  if( --waitingFor === 0 ) {
                     if( failed ) {
                        reject( finished );
                     }
                     else {
                        resolve( finished );
                     }
                  }
               };
            }
         } );
      } );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function extractUrl( urlOrHalRepresentation ) {
      const url = typeof urlOrHalRepresentation === 'string' ?
         urlOrHalRepresentation : path( urlOrHalRepresentation, '_links.self.href', null );

      if( !url ) {
         logError( 'Tried to make a request without valid url. Instead got [0:%o].', urlOrHalRepresentation );
         throw new Error( 'Tried to make a request without valid url' );
      }

      return url;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createCacheKey( url, headers ) {
      return Object.keys( headers ).sort().reduce(
         ( acc, key, index ) => `${acc}${index ? '_' : ''}${key}=${headers[ key ]}`,
         `${url}@`
      );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function doFetch( url, options, method = 'GET', bodyObject = undefined ) {
      const headers = createHeaders( method, options.headers );
      const lcHeaders = {};
      Object.keys( headers ).forEach( key => {
         lcHeaders[ key.toLowerCase() ] = headers[ key ];
      } );
      return fetch( url, createInit( options.fetchInit, method, lcHeaders, bodyObject ) );
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createInit( localInit, method, headers, bodyObject ) {
      const config = {
         ...globalOptions.fetchInit,
         ...localInit,
         method,
         headers
      };
      delete config.body;
      if( bodyObject !== undefined ) {
         config.body = JSON.stringify( bodyObject );
      }
      return config;
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   function createHeaders( method, localHeaders ) {
      let defaultHeaders = DEFAULT_UNSAFE_HEADERS;
      if( method === 'GET' ) {
         defaultHeaders = DEFAULT_SAFE_HEADERS;
      }
      else if( method === 'PATCH' ) {
         defaultHeaders = DEFAULT_PATCH_HEADERS;
      }
      return { ...defaultHeaders, ...globalOptions.headers, ...localHeaders };
   }

   ///////////////////////////////////////////////////////////////////////////////////////////////////////////

   return api;

}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Returns a copy of the given HAL representation with all HAL media type specific properties removed.
 * Currently these are `_links` and `_embedded`.
 *
 * @param {Object} halRepresentation
 *    the representation to clean up
 *
 * @return {Object}
 *    the copy without HAL media type keys
 */
export function removeHalKeys( halRepresentation ) {
   if( halRepresentation != null && typeof halRepresentation === 'object' ) {
      const copy = JSON.parse( JSON.stringify( halRepresentation ) );
      delete copy._embedded;
      delete copy._links;
      return copy;
   }
   return halRepresentation;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Returns `true` if the given relation exists as link or is embedded.
 *
 * @param {Object} halRepresentation
 *    HAL representation to check for the relation
 * @param {String} relation
 *    name of the relation to find
 *
 * @return {Boolean} `true` if `relation` exists in the representation
 */
export function canFollow( halRepresentation, relation ) {
   return !!( ( halRepresentation._links && relation in halRepresentation._links ) ||
      ( halRepresentation._embedded && relation in halRepresentation._embedded ) );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Returns the first value of href for the requested relation. Search for the relation starts under
 * `_links` and continues in `_embedded`, if not found in `_links`. If not found at all, `null` is
 * returned.
 * If the relation is found and yields only a single value, that value's `href` attribute value is
 * returned. If the relation yields a list, the `href` attribute value of the first entry is returned.
 *
 * @param {Object} halRepresentation
 *    the representation to search for the relation
 * @param {String} relation
 *    the relation to get a `href` attribute value from
 *
 * @return {String} the `href` attribute value if available, `null` otherwise
 */
export function firstRelationHref( halRepresentation, relation ) {
   if( halRepresentation._links && relation in halRepresentation._links ) {
      const linkOrLinks = halRepresentation._links[ relation ];
      return Array.isArray( linkOrLinks ) ? linkOrLinks[ 0 ].href : linkOrLinks.href;
   }

   return path( halRepresentation, `_embedded.${relation}._links.self.href`, null );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Returns the first value of href for the *self* relation. The same as for {@link #firstRelationHref} holds,
 * but normally a *self* relation should always be present for a RESTful webservice.
 *
 * @param {Object} halRepresentation
 *    the representation to search for the *self* relation
 *
 * @return {String} the `href` attribute value if available, `null` otherwise
 */
export function selfLink( halRepresentation ) {
   return firstRelationHref( halRepresentation, 'self' );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

function path( obj, thePath, optionalDefault = undefined ) {
   const pathArr = thePath.split( '.' );
   let node = obj;
   let key = pathArr.shift();

   while( key ) {
      if( node && typeof node === 'object' && node.hasOwnProperty( key ) ) {
         node = node[ key ];
         key = pathArr.shift();
      }
      else {
         return optionalDefault;
      }
   }

   return node;
}
