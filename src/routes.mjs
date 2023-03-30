import express from 'express'
import {search, index, conformance} from './controllers.mjs'
import {authenticate} from './auth.mjs'


var router = express.Router()

router.get('/', (req,res) => { res.send("STAC SEARCH API")})

router.get('/search', search)
router.post('/search', search)
router.get('/conformance', conformance)
router.post('/index', authenticate, index)
router.get('/api', (req,res) => {res.send({openapi: true})})

export default router