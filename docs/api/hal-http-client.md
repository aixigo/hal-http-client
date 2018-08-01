
# <a id="hal-http-client"></a>hal-http-client

A _status code driven_ JSON [HAL](http://stateless.co/hal_specification.html) HTTP client based on the
[fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

## Contents

**Module Members**

- [STATUS_NOREL](#STATUS_NOREL)
- [create()](#create)
- [removeHalKeys()](#removeHalKeys)
- [canFollow()](#canFollow)
- [firstRelationHref()](#firstRelationHref)
- [selfLink()](#selfLink)

**Types**

- [HalHttpClient](#HalHttpClient)
  - [HalHttpClient.get()](#HalHttpClient.get)
  - [HalHttpClient.head()](#HalHttpClient.head)
  - [HalHttpClient.put()](#HalHttpClient.put)
  - [HalHttpClient.post()](#HalHttpClient.post)
  - [HalHttpClient.patch()](#HalHttpClient.patch)
  - [HalHttpClient.del()](#HalHttpClient.del)
  - [HalHttpClient.follow()](#HalHttpClient.follow)
  - [HalHttpClient.followAll()](#HalHttpClient.followAll)
  - [HalHttpClient.thenFollow()](#HalHttpClient.thenFollow)
  - [HalHttpClient.thenFollowAll()](#HalHttpClient.thenFollowAll)
- [ResponsePromise](#ResponsePromise)
  - [ResponsePromise.on()](#ResponsePromise.on)

## Module Members

#### <a id="STATUS_NOREL"></a>STATUS_NOREL `String`

Virtual status code `'norel'` for a missing relation to use as key in the `on`-handlers map.

#### <a id="create"></a>create( optionalOptions )

Creates a new http client for usage with a RESTful backend supporting the content type
`application/hal+json` (https://tools.ietf.org/html/draft-kelly-json-hal-06).

Example:
```js
const hal = create( {
   on: {
      'xxx'( data, response ) {
         console.log( 'I\'ll handle everything not handled locally' );
      }
   }
} );

hal.get( 'http://host/someResource' )
   .on( {
      '2xx'( data, response ) {
         console.log( 'Everything looks fine: ', data );
         return hal.follow( data, 'some-relation' );
      },
      '4xx|5xx'( data, response ) {
         console.log( 'Server or client failed. Who knows? The status!', response.status );
      }
   } )
   // handle the response from following 'some-relation'
   .on( {
      '200'( data, response ) {
         console.log( 'I got this: ', data );
      },
      'norel'() {
          console.log( 'Oh no, seems "some-relation" is missing in the representation' );
      }
   } );
```

See [`#ResponsePromise`](#ResponsePromise) for further information on the `on` function.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| _optionalOptions_ | `Object` |  map of global configuration to use for the HAL client |
| _optionalOptions.queueUnsafeRequests_ | `Boolean` |  if `true` an unsafe request (DELETE, PATCH, POST and PUT) has to be finished before the next is started. Default is `false` |
| _optionalOptions.headers_ | `Object` |  global headers to send along with every request |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used with every request. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |
| _optionalOptions.on_ | `Object` |  global `on` handlers to use as fallback if no matching handler was found in an `on` call |
| _optionalOptions.responseTransformer_ | `Function` |  a function that is called for every response and must return an optionally transformed version of that response. This can e.g. be used for URL rewriting of proxied requests during development. This should not be used in production for transformation of actual data |
| _optionalOptions.logError_ | `Function` |  a function to log error messages to. By default `console.error` is used |
| _optionalOptions.logDebug_ | `Function` |  a function to log debug / development messages to. By default `console.debug` is used |

##### Returns

| Type | Description |
| ---- | ----------- |
| [`HalHttpClient`](#HalHttpClient) |  a new HAL client instance |

#### <a id="removeHalKeys"></a>removeHalKeys( halRepresentation )

Returns a copy of the given HAL representation with all HAL media type specific properties removed.
Currently these are `_links` and `_embedded`.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| halRepresentation | `Object` |  the representation to clean up |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Object` |  the copy without HAL media type keys |

#### <a id="canFollow"></a>canFollow( halRepresentation, relation )

Returns `true` if the given relation exists as link or is embedded.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| halRepresentation | `Object` |  HAL representation to check for the relation |
| relation | `String` |  name of the relation to find |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Boolean` |  `true` if `relation` exists in the representation |

#### <a id="firstRelationHref"></a>firstRelationHref( halRepresentation, relation )

Returns the first value of href for the requested relation. Search for the relation starts under
`_links` and continues in `_embedded`, if not found in `_links`. If not found at all, `null` is
returned.
If the relation is found and yields only a single value, that value's `href` attribute value is
returned. If the relation yields a list, the `href` attribute value of the first entry is returned.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| halRepresentation | `Object` |  the representation to search for the relation |
| relation | `String` |  the relation to get a `href` attribute value from |

##### Returns

| Type | Description |
| ---- | ----------- |
| `String` |  the `href` attribute value if available, `null` otherwise |

#### <a id="selfLink"></a>selfLink( halRepresentation )

Returns the first value of href for the *self* relation. The same as for [`#firstRelationHref`](#firstRelationHref) holds,
but normally a *self* relation should always be present for a RESTful webservice.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| halRepresentation | `Object` |  the representation to search for the *self* relation |

##### Returns

| Type | Description |
| ---- | ----------- |
| `String` |  the `href` attribute value if available, `null` otherwise |

## Types

### <a id="HalHttpClient"></a>HalHttpClient

#### <a id="HalHttpClient.get"></a>HalHttpClient.get( urlOrHalRepresentation, optionalOptions )

Makes a GET request for the given URL or HAL representation. In case a HAL representation is given,
the `self` relation in the `_links` map is used to derive the URL for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  a URL or a HAL representation to make the request for |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default, `Accept: application/hal+json, application/json;q=0.8` is added to the headers |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| [`ResponsePromise`](#ResponsePromise) |  an extended promise for the response |

#### <a id="HalHttpClient.head"></a>HalHttpClient.head( urlOrHalRepresentation, optionalOptions )

Makes a HEAD request for the given URL or HAL representation.
In case a HAL representation is given, the `self` relation in the `_links` map is used to derive the URL
for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  an URL or a HAL representation to make the request for |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default no headers are set |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| [`ResponsePromise`](#ResponsePromise) |  an extended promise for the response |

#### <a id="HalHttpClient.put"></a>HalHttpClient.put( urlOrHalRepresentation, body, optionalOptions )

Makes a PUT request for the given URL or HAL representation. In case a HAL representation is given,
the `self` relation in the `_links` map is used to derive the URL for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  an URL or a HAL representation to make the request for |
| body | `Object` |  JSON serializable body to send |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default `Accept: application/hal+json` and `Content-Type: application/json` are added to the headers |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| [`ResponsePromise`](#ResponsePromise) |  an extended promise for the response |

#### <a id="HalHttpClient.post"></a>HalHttpClient.post( urlOrHalRepresentation, body, optionalOptions )

Makes a POST request for the given URL or HAL representation. In case a HAL representation is given,
the `self` relation in the `_links` map is used to derive the URL for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  an URL or a HAL representation to make the request for |
| body | `Object` |  JSON serializable body to send |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default, `Accept: application/hal+json, application/json;q=0.8` and `Content-Type: application/json` are added to the headers |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| [`ResponsePromise`](#ResponsePromise) |  an extended promise for the response |

#### <a id="HalHttpClient.patch"></a>HalHttpClient.patch( urlOrHalRepresentation, body, optionalOptions )

Makes a PATCH request for the given URL or HAL representation. In case a HAL representation is given,
the `self` relation in the `_links` map is used to derive the URL for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  a URL or a HAL representation to make the request for |
| body | `Object` |  body in JSON Patch notation (http://tools.ietf.org/html/rfc6902) |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default, `Accept: application/hal+json, application/json;q=0.8` and `Content-Type: application/json-patch+json` are added to the headers |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| [`ResponsePromise`](#ResponsePromise) |  an extended promise for the response |

#### <a id="HalHttpClient.del"></a>HalHttpClient.del( urlOrHalRepresentation, body, optionalOptions )

Makes a DELETE request for the given URL or HAL representation. In case a HAL representation is given,
the `self` relation in the `_links` map is used to derive the URL for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  an URL or a HAL representation to make the request for |
| _body_ | `Object` |  JSON serializable body to send. If you want to use options, but have no `body`, use `undefined` as value for `body` |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default `Accept: application/hal+json, application/json;q=0.8` and `Content-Type: application/json` are added to the headers |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| [`ResponsePromise`](#ResponsePromise) |  an extended promise for the response |

#### <a id="HalHttpClient.follow"></a>HalHttpClient.follow( halRepresentation, relation, optionalOptions )

Follows one or more resources of a relation within a given HAL representation. First it is checked if
a representation for the relation is already embedded and in case it exists, this will be the result.
If that isn't the case, the `_links` property is searched for a URL of that relation and if found, a
GET request for this URL is performed. If the relation could not be found in the given representation
the resulting promise is rejected.

If there are multiple links or embedded resources, by default only the first one will be requested and
its response passed to the consumers of the promise. In case the `followAll` option is set to `true`,
all found embedded representations are returned or all relations found in the `_links` property are
requested resp.. The resulting promise will then be resolved with an array of responses instead of a
single response. As there might be different status codes for the responses, a specific `on` handler is
only called if all status codes yield the same value. In any other case *only* the handler for `xxx` is
called. This can be prevented, if a list resource always embeds the representations of its items.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| halRepresentation | `Object` |  the representation whose relation should be followed |
| relation | `String` |  the relation to follow |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.method_ | `Object` |  method to use for the request(s). If not `GET`, embedded representations will be ignored. Default is `GET` |
| _optionalOptions.body_ | `Object` |  JSON serializable body to send |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. The same default headers as for `get()` are used |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |
| _optionalOptions.followAll_ | `Boolean` |  if `true`, follows all entities found for that relation. Default is `false` |
| _optionalOptions.vars_ | `Object` |  map of variables to replace in templated URLs |

##### Returns

| Type | Description |
| ---- | ----------- |
| [`ResponsePromise`](#ResponsePromise) |  an extended promise for the response |

#### <a id="HalHttpClient.followAll"></a>HalHttpClient.followAll( halRepresentation, relation, optionalOptions )

A shortcut function for [`#HalHttpClient.follow()`](#HalHttpClient.follow) called with `followAll` yielding `true`:
`follow( halRepresentation, relation, { followAll: true } )`.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| halRepresentation | `Object` |  the representation whose relation should be followed |
| relation | `String` |  the relation to follow |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.method_ | `Object` |  method to use for the request(s). If not `GET`, embedded representations will be ignored. Default is `GET` |
| _optionalOptions.body_ | `Object` |  JSON serializable body to send |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. The same default headers as for `get()` are used |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |
| _optionalOptions.vars_ | `Object` |  map of variables to replace in templated URLs |

##### Returns

| Type | Description |
| ---- | ----------- |
| [`ResponsePromise`](#ResponsePromise) |  an extended promise for the response |

#### <a id="HalHttpClient.thenFollow"></a>HalHttpClient.thenFollow( relation, optionalOptions )

Helper factory for `follow()` function calls. The returned function only expects a HAL representation as
argument, and calls [`#HalHttpClient.follow()`](#HalHttpClient.follow) using that representation as first argument.
The purpose of this method is the use within chained `follow()` calls, especially in `on` handlers.

Example:
```js
halClient.get( 'http://host/office' )
   .on( { '200': halClient.thenFollow( 'desk' ) } )
   .on( { '200': halClient.thenFollow( 'computer' ) } )
   .on( { '200': halClient.thenFollow( 'keyboard' ) } );
// ...
```
Assuming every response yields a status of `200`, first a representation of an office resource is
fetched, then the `desk` relation is followed, then within the resulting representation the `computer`
relation is followed and finally within that representation the `keyboard` relation is followed.

Note that this method cannot be used in an `on` handler after a `followAll` request, as there will be
an array of objects instead of only one object.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| relation | `String` |  the relation to follow |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.method_ | `Object` |  method to use for the request(s). If not `GET`, embedded representations will be ignored. Default is `GET` |
| _optionalOptions.body_ | `Object` |  JSON serializable body to send |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. The same default headers as for `get()` are used |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |
| _optionalOptions.followAll_ | `Boolean` |  if `true`, follows all entities found for that relation. Default is `false` |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Function` |  a function calling `follow` on the response it receives |

#### <a id="HalHttpClient.thenFollowAll"></a>HalHttpClient.thenFollowAll( relation, optionalOptions )

A shortcut function for [`#HalHttpClient.thenFollow()`](#HalHttpClient.thenFollow) called with `followAll` yielding `true`:
`thenFollow( relation, { followAll: true } )`.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| relation | `String` |  the relation to follow |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.method_ | `Object` |  method to use for the request(s). If not `GET`, embedded representations will be ignored. Default is `GET` |
| _optionalOptions.body_ | `Object` |  JSON serializable body to send |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. The same default headers as for `get()` are used |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Function` |  a function calling `followAll` on the response it receives |

### <a id="ResponsePromise"></a>ResponsePromise

> extends `Promise`

A simple extension of a normal
[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).
Its purpose is to add some convenience when following relations of a resource. Using the standard
Promise API is still possible.

#### <a id="ResponsePromise.on"></a>ResponsePromise.on( handlers )

A function to register handlers for the possible
[HTTP status codes](https://tools.ietf.org/html/rfc7231#page-47) returned by the API. This is the
actual heart of this library.

This function has to be called with a map of status codes to functions responsible for handling the
response that was given for an actual status code. It is possible to group status codes using the
same handler for their codes. And lastly wildcards are possible to be able to treat a specific class
of status codes conveniently the same way.

Let's have a look at an example:
```js
const handler1 = ( result, response ) => {};
const handler2 = ( result, response ) => {};
const handler3 = ( result, response ) => {};
const handler4 = ( result, response ) => {};

hal.get( 'my-resource' )
   .on( {
      '200': handler1,
      '201|202|204': handler2,
      '5xx': handler3
   } );
```
Here `handler1` will only be called for status code _200_, `handler2` for the given status codes
_201_, _202_ and _204_, and `handler3` will be called for any type of server error. A final catch all
handler could have also been added simply using a full wildcard string _xxx_. Any code that is not
handled by this map of handlers is forwarded to the global handlers map (see [`create()`](hal-http-client.md)). In
case there is no handler there either, this will be logged and the next returned promise will be
rejected.

Each handler receives to arguments: First, the body of the response (already parsed from a JSON
string into a JavaScript object). The second argument is the plain response object as returned by
the underlying `fetch` API. In case the entries of a list resource were fetched the arguments will
be arrays, carrying the body and response objects of all list items.

If the response cannot be parsed into valid JSON (for example, if the server returns an HTML error
page which may often happen in case of a `4xx` or `5xx`), the status code will be kept, but the
`result` object is set to `null`. In this case, interested handlers can still inspect the complete
response for details.

Handlers can then further follow relations of the provided body object by using the convenience
methods [`#HalHttpClient.follow()`](#HalHttpClient.follow) or [`#HalHttpClient.followAll()`](#HalHttpClient.followAll), and returning the
resulting `ResponsePromise` for typical Promise-like chaining. If a handler really does nothing apart
from following a relation of the HAL response, a generic handler can even be created by using
[`#HalHttpClient.thenFollow()`](#HalHttpClient.thenFollow) or [`#HalHttpClient.thenFollowAll()`](#HalHttpClient.thenFollowAll). In addition to the
http status codes and _xxx_ a "virtual" code of `'norel'` can be used to handle the case, where a
relation is missing in a response.

If a handler returns nothing or `null`, and by that indicating an empty response, subsequent handlers
will never be called.

*Special cases*

- _An empty list resource_: This will be returned with overall status code _200_.
- _Different status codes for the list items_: This will only trigger the _xxx_ handler.
- _The relation to follow doesn't exist_: The _norel_ handler will be called

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| handlers | `Object` |  the map of handlers as described above |

##### Returns

| Type | Description |
| ---- | ----------- |
| [`ResponsePromise`](#ResponsePromise) |  an extended promise for the result of the handler that was called |
