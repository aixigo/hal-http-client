# hal-http-client

> A _status code driven_ JSON [HAL](http://stateless.co/hal_specification.html) HTTP client based on the [fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

The API doc can be found [here](docs/api/hal-http-client.md).


## What is HAL and where does this client come into play?

HAL _(Hypertext Application Layer)_, as the name already states, is an application level layer on top of JSON or XML that provides conventions for linking between different resources.
For RESTful APIs it helps to reach level 3 of the [Richardson Maturity Model](https://martinfowler.com/articles/richardsonMaturityModel.html) .
Additionally it defines how to embed related resources into the response of their parent resource for efficient APIs and lowering the need for actual HTTP requests over the wire.

The _hal-http-client_ defines a convenient API for accessing resources represented as HAL on top of JSON (XML is currently not supported and there are no plans in doing so):
- It allows _navigating_ through resources with `application/hal+json` media type by _following the available relations_
- If a resource is embedded, it _transparently reads the embedded representation_ instead of making a real HTTP request
- Flow control is supported by providing a _status code driven_ API

[Templated URLs (RFC6570)](https://tools.ietf.org/html/rfc6570#section-3.2.7) are supported via the [url-template](https://github.com/bramstein/url-template) library.

## Installation and Usage

```sh
npm install hal-http-client
```

Basically import the library, make a new instance and start discovering resources by making a `GET` request to the root URL of your API.

```js
import * as halHttp from '../hal-http-client';

const hal = halHttp.create( {
   headers: { 'accept-language': 'de' },
   on: {
      // globally define how responses for status codes should be handled that were not handled locally
      '5xx': ( data, response ) => {
         console.error( `Caught unhandled 5xx error (status: ${response.status})` );
      }
   }
} );
hal.get( 'http://my-server/api/root' )
// See the example below on how to go on from here
```


## Example

Lets take the following simple model of a person and his cars from the specs:

```js
// person
{
   "name": "Peter",
   "age": 34
}
// his address
{
   "street": "Mainstreet 12",
   "postalCode": "12345",
   "city": "Faketown"
}
// his cars
[
   {
      "type": "VW",
      "model": "T3 Vanagon"
   },
   {
      "type": "DMC",
      "model": "DeLorean"
   }
]
```

An according JSON response with all sub resources embedded could look like this:

```js
{
   "name": "Peter",
   "age": 34,
   "_links": {
      "self": { "href": "peter" },
      "address": { "href": "peter/address" },
      "cars": { "href": "peter/cars" }
   },
   "_embedded": {
      "address": {
         "street": "Mainstreet 12",
         "postalCode": "12345",
         "city": "Faketown",
         "_links": { "self": { "href": "peter/address" } }
      },
      "cars": {
         "_links": {
            "self": { "href": "peter/cars" },
            "car": [ { "href": "peter/cars/0" }, { "href": "peter/cars/1" } ]
         },
         "_embedded": {
            "car": [
               {
                  "type": "VW",
                  "model": "T3 Vanagon",
                  "_links": { "self": { "href": "peter/cars/0" } }
               },
               {
                  "type": "DMC",
                  "model": "DeLorean",
                  "_links": { "self": { "href": "peter/cars/1" } }
               }
            ]
         }
      }
   }
}
```

Getting the cars starting from the person can be achieved in the following way:

```js
hal.get( '/peter' )
   .on( {
      '200': hal.thenFollow( 'cars' )
   } )
   .on( {
      '200': hal.thenFollowAll( 'car' )
   } )
   .on( {
      '200': carList => {
         console.log( carList );
         // will print:
         /*
           [
               {
                  "type": "VW",
                  "model": "T3 Vanagon",
                  "_links": { "self": { "href": "peter/cars/0" } }
               },
               {
                  "type": "DMC",
                  "model": "DeLorean",
                  "_links": { "self": { "href": "peter/cars/1" } }
               }
            ]
         */
      }
   } );
```

The `hal.thenFollow` method is a convenience factory for creating a function, which takes the response of the previous request, then _follows_ the given relation in the response body and finally returns a `ResponsePromise` for further `on` chaining.
So instead this part could have been written the following way:

```js
hal.get( '/peter' )
   .on( {
      '200': ( peterResource, response ) => {
         return hal.follow( peterResource, 'cars' );
      }
   } )
```

Diving even deeper into details, the `hal.follow` method actually does the following (written in pseudo code):

```vb
function follow( resource, relation ) {
   if relation_is_embedded then
      return promise_for_embedded_representation;

   else if relation_is_in_links then
      set url to href_of_link_object;
      set httpResponse to result_of_HTTP_GET_url;
      return promise_for_http_response;

   else
      return rejected_promise;
}
```

The method `hal.thenFollowAll` basically works the same, only that it expects to find an array of relations to follow on the given resource and return all results again as an array.

From here on you should consult the [API doc](docs/api/hal-http-client.md) to have a look at all the other APIs available on the _hal-http-client_.
