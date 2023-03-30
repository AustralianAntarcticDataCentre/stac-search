import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import router from './src/routes.mjs'
import { elasticHealth } from './src/elastic.mjs'


async function run() {
    const app = express()
    app.use(express.json())
    app.use('/', router)
  
    const port = process.env.API_PORT || 4000

    const esHealth = await elasticHealth()
    console.log(esHealth)
    
    app.listen({ port  }, () =>
      console.log(`🚀 Server ready at http://localhost:${port}`)
    )
  }
  
run()