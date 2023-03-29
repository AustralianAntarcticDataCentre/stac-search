
import { elasticClient } from "./elastic.mjs"
import axios from 'axios'

const indexAlias = `${process.env.ELASTIC_INDEX_PREFIX}-stac`

function parseDatetime(datetime) {
    let [from, to] = datetime.split('/')

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
            "coordinates": [ [ bbox[0], bbox[1] ], [ bbox[2], bbox[3] ] ]
        }
    }

    return filter_shape
}


async function search(req,res) {
    let query

    if(req.method == 'GET') {
        query = req.query
        query.collections = query.collections ? query.collections.split(',') : null
        query.ids = query.ids? query.ids.split(',') : null
        query.bbox = query.bbox? query.bbox.split(',') : null
    }

    if(req.method == 'POST') {
        query = req.body
    } 

    let { 
        limit,
        bbox,
        datetime,
        intersects,
        ids,
        collections
    } = query

    limit = limit | 100

    query = {
        index: 'undefined-stac-1680060757963',
        "from" : 0, "size" : limit,
        body: {
            "query": {
                "bool" :{
                    "must": []
                }
            }
        }
    }

    let range = {}
    let filter = []

    if(datetime) {
        let filter_date = parseDatetime(datetime)
        if(filter_date) {
            range["properties.datetime"] = filter_date
        }
    }

    if(bbox || intersects) {
    let filter_shape = parseGeometry(bbox, intersects)
        if(filter_shape) {
            filter.push({
                "geo_shape": {
                    "geometry": {
                        "shape": filter_shape
                    }
                }
            }) 
        }   
    }

    if(collections) {
        filter.push({terms: {'collection': collections }})
    }

    if(ids) {
        filter.push({terms: {'id': ids }})
    }

    console.log('filter', filter)

    query.body.query.bool.filter = filter

    console.log('query: ', query.body.query)

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
    let catalog = req.body.catalog
    console.log(`--- INDEXING STAC CATALOG - ${catalog} ---`)

    let catalog_result = await axios.get(catalog)

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

    catalog_result.data.links.map(async l => {
        if(l.rel = "child") {
            let child_result = await axios.get(l.href)

            child_result.data.links.map(async i => {
                if(i.rel == "item") {
                    let item_result = await axios.get(i.href)

                    //this is the thing to add to the index
                    console.log(`indexing: ${item_result.data.id}`)
                    let index_response = await elasticClient.index({
                        index: indexName,
                        body: item_result.data
                    })
                }
            })
        }
    })

    res.send({OK:true})
}

export {search, index}