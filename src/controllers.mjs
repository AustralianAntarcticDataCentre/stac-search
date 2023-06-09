
import { elasticClient } from "./elastic.mjs"
import axios from 'axios'
import retry from 'axios-retry'
import SqlWhereParser from 'sql-where-parser'

let config = SqlWhereParser.defaultConfig
config.tokenizer.shouldTokenize.splice(config.tokenizer.shouldTokenize.indexOf('-'), 1)
let parser = new SqlWhereParser(config)

const {
    isNetworkOrIdempotentRequestError
} = retry

function handleRetry (error) {
    return isNetworkOrIdempotentRequestError(error)
}

retry(axios, { retries: 3, retryCondition: handleRetry, retryDelay: () => { return 2000 } })

const indexAlias = `${process.env.ELASTIC_INDEX_PREFIX}-stac`

function parseDatetime(datetime) {
    let [from, to] = datetime.split('/')

    console.log(`${from} ${to}`)

    let from_date, to_date
    if(from && from != '..') {
        from_date = from
    }

    if(to && to != '..') {
        to_date = to
    }

    return {
        gte: from_date,
        lte: to_date
    }
}

function parseGeometry(bbox, intersects) {
    let filter_shape

    if(intersects) {
        filter_shape = intersects
    } else if(bbox) {
        filter_shape = {
            "type": "envelope",
            "coordinates": [ [ bbox[0], bbox[3] ], [ bbox[2], bbox[1] ] ]
        }
    }

    return filter_shape
}

function parseTextFilter(filter) {
    const parsed = parser.parse(filter, (operatorValue, operands) => {
        switch (operatorValue) {
            case '=':
                return {
                    "op": "=",
                    args: [{"property": operands[0]}, operands[1]]
                }
            case '<=':
                return {
                    "op": "<=",
                    args: [{"property": operands[0]}, operands[1]]
                }
            case '>=':
                return {
                    "op": ">=",
                    args: [{"property": operands[0]}, operands[1]]
                }
            case '<':
                return {
                    "op": "<",
                    args: [{"property": operands[0]}, operands[1]]
                }
            case '>':
                return {
                    "op": ">",
                    args: [{"property": operands[0]}, operands[1]]
                }
            case '<>':
                return {
                    "op": "<>",
                    args: [{"property": operands[0]}, operands[1]]
                }
            case 'like':
                return {
                    "op": "like",
                    args: [{"property": operands[0]}, operands[1]]
                }
            case 'AND':
                return {
                    'op': "and",
                    args: operands
                }
        }
    })

    return parsed
}

function parseSort(sortby) {
    console.log(sortby)
    let output = []
    let sorts = sortby.split(',')

    for(let s of sorts) {
        let direction = 'asc'
        let property = s

        if(s.startsWith('-')) {
            direction = 'desc'
            property = s.slice(1);
        }

        if(s.startsWith('+')) {
            direction = 'asc'
            property = s.slice(1);
        }

        output.push({property, direction})
    }
}


async function search(req,res) {
    let query

    if(req.method == 'GET') {
        query = req.query
        query.limit = parseInt(query.limit)
        query.collections = query.collections ? query.collections.split(',') : null
        query.ids = query.ids? query.ids.split(',') : null
        if(query.bbox) {
            query.bbox = query.bbox.split(',').map(i => {
                return parseFloat(i)
            })
        }

        if(query.sortby) {
            query.sortby = parseSort(query.sortby)
        }
    }

    if(req.method == 'POST') {
        query = req.body
    } 

    query.filter_lang = query['filter-lang']

    let { 
        limit,
        bbox,
        datetime,
        intersects,
        ids,
        collections,
        filter,
        filter_lang,
        sortby
    } = query

    limit = limit || 100

    query = {
        index: indexAlias,
        "from" : 0, "size" : limit,
        body: {
            "query": {
                "bool" :{
                    "must": [],
                    "must_not": []
                }
            }
        }
    }

    let esFilter = []
    let esMatch = []
    let esNot = []
    let esSort = []

    console.log(filter_lang)
    console.log(filter)
    console.log(sortby)

    if(filter && filter_lang == 'cql2-text') {
        filter = parseTextFilter(filter)
        filter_lang = 'cql2-json'
    }

    if(filter && filter_lang == 'cql2-json') {

        console.log(filter)

        let args = []

        if(filter.op == 'and' || filter.op == 'or') {
            args = filter.args
        } else {
            args.push(filter)
        }

        args.map(arg => {

            let property = arg.args[0].property

            if(property != 'collection' && property != 'id') {
                property = `properties.${property}`
            }

            if(arg.op == '=') {
                let a = {match: {}}
                a.match[property] = arg.args[1]
                esMatch.push(a)
            }

            if(arg.op == 'like') {
                let a = {match: {}}
                a.match[property] = arg.args[1].replace('%', '')
                esMatch.push(a)
            }

            if(arg.op == '<>') {
                let a = {match: {}}
                a.match[property] = arg.args[1]
                esNot.push(a)
            }

            if(arg.op == '<') {
                let a = {range: {}}
                a.range[property] = {lt: arg.args[1]}
                esFilter.push(a)
            } 

            if(arg.op == '<=') {
                let a = {range: {}}
                a.range[property] = {lte: arg.args[1]}
                esFilter.push(a)
            }

            if(arg.op == '>') {
                let a = {range: {}}
                a.range[property] = {gt: arg.args[1]}
                esFilter.push(a)
            }

            if(arg.op == '>=') {
                let a = {range: {}}
                a.range[property] = {gte: arg.args[1]}
                esFilter.push(a)
            }

            if(arg.op == 's_intersects') {
                let a = {
                    "geo_shape": {
                    }
                }

                a.geo_shape[`${arg.args[0].property}`] = {
                    "shape": arg.args[1],
                    "relation": "intersects"
                }

                esFilter.esFilter.push(a)
            }

            if(arg.op == 's_within') {
                let a = {
                    "geo_shape": {
                    }
                }

                a.geo_shape[`${arg.args[0].property}`] = {
                    "shape": arg.args[1],
                    "relation": "within"
                }

                esFilter.esFilter.push(a)
            }
        })
    }

    if(datetime) {
        let filter_date = parseDatetime(datetime)
        if(filter_date) {
            esFilter.push({range: {"properties.datetime" : filter_date }})
        }
    }

    if(bbox || intersects) {
    let filter_shape = parseGeometry(bbox, intersects)
        if(filter_shape) {
            esFilter.push({
                "geo_shape": {
                    "geometry": {
                        "shape": filter_shape
                    }
                }
            }) 
        }   
    }

    if(collections) {
        esFilter.push({terms: {'collection': collections }})
    }

    if(ids) {
        esFilter.push({terms: {'id': ids }})
    }

    if(sortby) {
        for (let i of sortby) {
            let sort = {}
            sort[i.field] = i.direction
            esSort.push(sort)
        }
    }

    console.log('filter', esFilter)
    console.log('must', esMatch)
    console.log('sort', esSort)

    query.body.sort = esSort
    query.body.query.bool.must = esMatch
    query.body.query.bool.filter = esFilter
    query.body.query.bool.must_not = esNot

    const result = await elasticClient.search(query)

    let result_list = result.body.hits.hits.map(h => {
        return h._source
    })

    let output = {
        type: "FeatureCollection",
        stac_version: "1.0.0",
        stac_extensions: [],
        context: {
            limit: limit,
            matched: result.body.hits.total.value,
            returned: result.body.hits.length
        },
        links: [
            {
                href: "",
                method: "GET",
                rel: "next",
                title: "Next",
                type: "application/json"
            }
        ],
        features: [
            ...result_list
        ]
    }

    res.send(output)
}

async function index(req,res) {

    if(process.env.JWT_SECRET) {
        if(!req.auth.roles.includes(process.env.JWT_AUTH_ROLE)) {
            res.status(401).send("Unauthorised")
        }
    }

    let catalog = req.body.catalog
    console.log(`--- INDEXING STAC CATALOG - ${catalog} ---`)

    let catalog_result = await axios.get(catalog)

    res.send({OK:true})

    const indexName = `${indexAlias}-${Date.now()}`

    console.log(`stac creating index... ${indexName}`)
    await elasticClient.indices.create({index: indexName})

    await elasticClient.indices.putMapping({
        index: indexName,
        body: {
            properties: {    
                id: {type: 'keyword'},
                collection: {type: 'keyword'},
                geometry: {type: 'geo_shape'},
            }
        }
    })

    await Promise.all(catalog_result.data.links.map(async l => {
        if(l.rel == "child") {
            let child_result = await axios.get(l.href)

            if(!child_result.data.links) {
                console.log('empty collection')
                return
            }

            for( let i of child_result.data.links) {
                if(i.rel == "item") {
                    let item_result = await axios.get(i.href)
                    let index_response = await elasticClient.index({
                        index: indexName,
                        body: item_result.data
                    })
                }
            }

            console.log(`indexed: ${child_result.data.id}`)
        }
    }))

    await rotateIndex(indexName, indexAlias)
}

async function rotateIndex(indexName, alias) {
    console.log(`Rotating Index ${alias} to ${indexName}`)
    await elasticClient.indices.putAlias({index: indexName, name: alias})

    const indexPrefix = alias+'*'
    const indexes = await elasticClient.cat.indices({ format: 'json', index: indexPrefix })

    for(let index of indexes.body) {
        if(index.index != indexName) {
            console.log(`Removing alias from ${index.index}`)
            try {
                await elasticClient.indices.deleteAlias({index: index.index, name: alias})
            } catch (error) {
            }
        }
    }
}

function conformance(req,res) {
    res.send({
        "conformsTo" : [
            "https://api.stacspec.org/v1.0.0-rc.3/core",
            "https://api.stacspec.org/v1.0.0-rc.3/item-search",
            "http://www.opengis.net/spec/cql2/1.0/conf/cql2-text",
            "http://www.opengis.net/spec/cql2/1.0/conf/cql2-json",
            "http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/basic-cql2",
            "http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/filter",
            "https://api.stacspec.org/v1.0.0-beta.5/item-search#filter:item-search-filter"
        ],
    })
}

export {search, index, conformance}