import dotenv from 'dotenv'
dotenv.config()
import { Client } from '@elastic/elasticsearch'

const elasticUsername = process.env.ELASTIC_USERNAME
const elasticPassword = process.env.ELASTIC_PASSWORD
const elasticHost = process.env.ELASTIC_HOST || 'http://localhost:9200'

const elasticClient = new Client({
  node: elasticHost,
  auth:
    !elasticUsername || !elasticPassword
      ? null
      : {
          username: elasticUsername,
          password: elasticPassword
        },
  ssl: {
    rejectUnauthorized: false
  }
})

async function elasticHealth () {
  const health = await elasticClient.cluster.health({ format: 'json'})
  console.log(`ElasticSearch (${elasticHost}) (Username: ${elasticUsername}) - Cluster Health: ${health.body.status}`)
  return health
}

const hostSplit = elasticHost.split('://')
const elasticHostURL =
  !elasticUsername || !elasticPassword
    ? elasticHost
    : `${hostSplit[0]}://${elasticUsername}:${elasticPassword}@${hostSplit[1]}`

export { elasticClient, elasticHealth, elasticHostURL }
