# hal-http-client

> A _status code driven_ JSON [HAL](http://stateless.co/hal_specification.html) HTTP client based on the [fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

The API doc can be found [here](docs/api/hal-http-client.md).

## What is HAL and where does this client come into play?

HAL _(Hypertext Application Layer)_, as the name already states, is an application level layer on top of JSON or XML that provides conventions for linking between different resources.
For RESTful APIs it helps supporting level 3 of the [Richardson Maturity Model](https://martinfowler.com/articles/richardsonMaturityModel.html) .
Additionally it defines how to embed related resources for efficient APIs and lowering the need for actual HTTP requests over the wire.

The _hal-http-client_ defines a convenient API for accessing resources represented as HAL on top of JSON (XML is currently not supported and there are no plans in doing so):
- It allows _navigating_ through resources with `application/hal+json` media type by _following the available relations_
- If a resource is embedded, it _transparently reads the embedded representation_ instead of making a real HTTP request
- Flow control is supported by providing a _status code driven_ api
