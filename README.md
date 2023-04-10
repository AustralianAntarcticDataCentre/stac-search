# STAC-SEARCH
a [STAC API](https://github.com/radiantearth/stac-api-spec) compliant search implementation written in nodejs and backed by elasticsearch

## Overview
This service is a nodejs implementation of the `/search` API for [STAC](https://github.com/radiantearth/stac-api-spec/tree/main/item-search) intended to simply index and provide search capabilities for a static STAC Catalogue.

The `/index` endpoint takes a url to a STAC Catalogue, and indexes the whole tree of child items

## Conformance Classes
- STAC API - Core -  1.0.0-rc.2  
- STAC API - Item Search -  1.0.0-rc.2  

## Deployment
Dockerfile for deployment as container
environment variables for configuration

## License
Copyright Commonwealth of Australia
Released under MIT license