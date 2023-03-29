import express from 'express'
import {search, index} from './controllers.mjs'


var router = express.Router()

router.get('/', function(req,res) { res.send("STAC SEARCH API")})

router.get('/search', search)
router.post('/search', search)

router.post('/index', index)

export default router