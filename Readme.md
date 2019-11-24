# Resker
A backend for chess positions, games and collections.
Please notice that by itself, this backend does nothing. You need a client to interact with this backend.

## Usage
You can edit the config file `./config/production.js` and manually run the app yourself, but the easiest way is to just run `docker-compose up`.

Resker by default listens on port 8001, but you can change this by passing the envvar HTTP_PORT when running docker-compose: `HTTP_PORT=8080 docker-compose up`

### Security
Resker exposes an api, and to help towards security Resker requires an API Key to validate requests, every client connecting to Resker needs to send the header `x-api-key`, the default api-key is `894hmt3x489ht89p3x`, but you can change this with the envvar `X_API_KEY` when doing `docker-compose up`