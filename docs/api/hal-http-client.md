
# <a id="hal-http-client"></a>hal-http-client

## Contents

**Module Members**

- [create()](#create)
- [removeHalKeys()](#removeHalKeys)
- [canFollow()](#canFollow)
- [firstRelationHref()](#firstRelationHref)

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

## Module Members

#### <a id="create"></a>create( optionalOptions )

Creates new http client for usage with a RESTful backend supporting the content type
`application/hal+json` (https://tools.ietf.org/html/draft-kelly-json-hal-06).

Promises returned by the methods of a hal client are basically the ones returned by the given `q`
library enriched by an `on` function. This function can be called with a map of status code to handler
function. Suffixes of a status code can be replaced by the wildcard character `x`. Note that in reality
only something like `2xx` (match all successful codes) and `xxx` (match any code) make sense, as for
example `20x` doesn't reference any semantically useful code range. It is possible to reuse the same
handler for several codes (optionally with wildcards) by joining them with the `|` (pipe) character,
Each handler receives the http response as argument. In case of `followAll()` or a handler returned by
`thenFollowAll()` an array of responses is given.

Example:
```javascript
halClient.get( 'http://host/someResource' )
   .on( {
      '2xx'( response ) {
         console.log( 'Everything looks fine: ', response.data );
      },
      '4xx|5xx'( response ) {
         console.log( 'Server or client failed. Who knows? The status!', response.status );
      }
   } );
```

If no matching handler was found in the object passed to `on`, the global handlers are searched for a
matching handler. Note that a more specific global handler will be favored over a more general local
handler. If no handler at all was found, a message in level `debug` is logged.
A handler may then return a new promise generated from a hal http request and thus chain several `on`
handlers.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| _optionalOptions_ | `Object` |  map of global configuration to use for the hal client |
| _optionalOptions.queueUnsafeRequests_ | `Boolean` |  if `true` an unsafe request has to be finished before the next is started. Default is `false` |
| _optionalOptions.headers_ | `Object` |  global headers to send along with every request |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used with every request. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |
| _optionalOptions.on_ | `Object` |  global `on` handlers to use as fallback if no matching handler was found in an `on` call |
| _optionalOptions.responseTransformer_ | `Function` |  a function that is called for every response and must return an optionally transformed version of that response. This currently is only used for url rewriting after proxied requests during development |
| _optionalOptions.logError_ | `Function` |  a function to log error messages to. By default `console.error` is used |
| _optionalOptions.logDebug_ | `Function` |  a function to log debug / development messages to. By default `console.debug` is used |

##### Returns

| Type | Description |
| ---- | ----------- |
| [`HalHttpClient`](#HalHttpClient) |  a new hal client instance |

#### <a id="removeHalKeys"></a>removeHalKeys( halRepresentation )

Returns a copy of the given hal representation with all hal media type specific properties removed.
Currently these are `_links` and `_embedded`.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| halRepresentation | `Object` |  the representation to clean up |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Object` |  the copy without hal media type keys |

#### <a id="canFollow"></a>canFollow( halRepresentation, relation )

Returns `true` if the given relation exists as link or is embedded.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| halRepresentation | `Object` |  hal representation to check for the relation |
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

## Types

### <a id="HalHttpClient"></a>HalHttpClient

#### <a id="HalHttpClient.get"></a>HalHttpClient.get( urlOrHalRepresentation, optionalOptions )

Makes a GET request for the given url or hal representation. In case a hal representation is given,
the `self` relation in the `_links` map is used to derive the url for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  an url or hal representation to make the request for |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default `Accept: application/hal+json` is added to the headers |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Promise` |  a promise for the response enriched by an `on` function (see `create()`) |

#### <a id="HalHttpClient.head"></a>HalHttpClient.head( urlOrHalRepresentation, optionalOptions )

Makes a HEAD request for the given url or hal representation.
In case a hal representation is given, the `self` relation in the `_links` map is used to derive the url
for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  an url or hal representation to make the request for |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default no headers are set |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Promise` |  a promise for the response enriched by an `on` function (see `create()`) |

#### <a id="HalHttpClient.put"></a>HalHttpClient.put( urlOrHalRepresentation, data, optionalOptions )

Makes a PUT request for the given url or hal representation. In case a hal representation is given,
the `self relation in the `_links` map is used to derive the url for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  an url or hal representation to make the request for |
| data | `Object` |  JSON serializable data to send |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default `Accept: application/hal+json` and `Content-Type: application/json` are added to the headers |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Promise` |  a promise for the response enriched by an `on` function (see `create()`) |

#### <a id="HalHttpClient.post"></a>HalHttpClient.post( urlOrHalRepresentation, data, optionalOptions )

Makes a POST request for the given url or hal representation. In case a hal representation is given,
the `self relation in the `_links` map is used to derive the url for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  an url or hal representation to make the request for |
| data | `Object` |  JSON serializable data to send |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default `Accept: application/hal+json` and `Content-Type: application/json` are added to the headers |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Promise` |  a promise for the response enriched by an `on` function (see `create()`) |

#### <a id="HalHttpClient.patch"></a>HalHttpClient.patch( urlOrHalRepresentation, data, optionalOptions )

Makes a PATCH request for the given url or hal representation. In case a hal representation is given,
the `self relation in the `_links` map is used to derive the url for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  an url or hal representation to make the request for |
| data | `Object` |  data in JSON Patch notation (http://tools.ietf.org/html/rfc6902) |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default `Accept: application/hal+json` and `Content-Type: application/json-patch+json` are added to the headers |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Promise` |  a promise for the response enriched by an `on` function (see `create()`) |

#### <a id="HalHttpClient.del"></a>HalHttpClient.del( urlOrHalRepresentation, optionalOptions )

Makes a DELETE request for the given url or hal representation. In case a hal representation is given,
the `self relation in the `_links` map is used to derive the url for the request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| urlOrHalRepresentation | `String`, `Object` |  an url or hal representation to make the request for |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. By default `Accept: application/hal+json` and `Content-Type: application/json` are added to the headers |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Promise` |  a promise for the response enriched by an `on` function (see `create()`) |

#### <a id="HalHttpClient.follow"></a>HalHttpClient.follow( halRepresentation, relation, optionalOptions )

Follows one or more resources of a relation within a given hal representation. First it is checked if
a representation for the relation is already embedded and in case it exists, this will be the result.
If that isn't the case, the `_links` property is searched for an url of that relation and if found, a
GET request for this url is performed. If the relation could not be found in the given representation
the resulting promise is rejected.

If there are multiple links or embedded resources, by default only the first one will possibly be
requested and its response passed to the consumers of the promise. In case the `followAll` option is
set to `true`, all found embedded representations are returned or all relations found in the `_links`
property are requested resp.. The result the promise then is resolved with, will be an array of
responses instead of a single response.
As there might be different status codes for the responses, a specific `on` handler is only called
if all status codes yield the same value. In any other case *only* the handler for `xxx` is called.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| halRepresentation | `Object` |  the representation whose relation should be followed |
| relation | `String` |  the relation to follow |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. The same default headers as for `get()` are used |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |
| _optionalOptions.followAll_ | `Boolean` |  if `true`, follows all entities found for that relation. Default is `false` |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Promise` |  a promise for the response enriched by an `on` function (see `create()`) |

#### <a id="HalHttpClient.followAll"></a>HalHttpClient.followAll( halRepresentation, relation, optionalOptions )

A shortcut function for `follow( halRepresentation, relation, { followAll: true } )`.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| halRepresentation | `Object` |  the representation whose relation should be followed |
| relation | `String` |  the relation to follow |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. The same default headers as for `get()` are used |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Promise` |  a promise for the response enriched by an `on` function (see `create()`) |

#### <a id="HalHttpClient.thenFollow"></a>HalHttpClient.thenFollow( relation, optionalOptions )

Helper factory for `follow()` function calls. The returned function only expects a response object
with at least a representation in the `data´ field and calls `follow` using that representation as
first argument. The purpose of this method is for use within chained follow calls, especially in `on`
handlers.

Example:
```javascript
halClient.get( 'http://host/office' )
   .on( { '200': halClient.thenFollow( 'desk' ) } )
   .on( { '200': halClient.thenFollow( 'computer' ) } )
   .on( { '200': halClient.thenFollow( 'keyboard' ) } );
// ...
```
Assuming every response yields a status of `200`, first a representation of an office resource is
fetched, then the `desk` relation is followed, then within the resulting representation the `computer`
relation is followed and finally within that representation the `keyboard` relation is followed.

Note that this method cannot be used in an `on` handler after a `followAll` request.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| relation | `String` |  the relation to follow |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. The same default headers as for `get()` are used |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |
| _optionalOptions.followAll_ | `Boolean` |  if `true`, follows all entities found for that relation. Default is `false` |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Function` |  a function calling `follow` on the response it receives |

#### <a id="HalHttpClient.thenFollowAll"></a>HalHttpClient.thenFollowAll( relation, optionalOptions )

A shortcut function for `thenFollow( relation, { followAll: true } )`.

##### Parameters

| Property | Type | Description |
| -------- | ---- | ----------- |
| relation | `String` |  the relation to follow |
| _optionalOptions_ | `Object` |  configuration to use for the request |
| _optionalOptions.headers_ | `Object` |  headers to send along with the request. The same default headers as for `get()` are used |
| _optionalOptions.fetchInit_ | `Object` |  additional init options for `fetch` to be used for this request only. The keys `headers`, `body` and `method` are ignored from this option, since they are either parameters on their own or implemented as specific function. |

##### Returns

| Type | Description |
| ---- | ----------- |
| `Function` |  a function calling `followAll` on the response it receives |
