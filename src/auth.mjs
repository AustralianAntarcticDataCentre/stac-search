import * as jwt from 'express-jwt'
const jwt_secret = process.env.JWT_SECRET

function findToken (req) {
    if (req.headers['x-access-token'] && req.headers['x-access-token'] !== '') {
    return req.headers['x-access-token']
    } else if (req.query && req.query.token) {
    return req.query.token
    } else if (req.cookies && req.cookies.aadc_token) {
    return req.cookies.aadc_token
    }

    return null
}
  
const authenticate = () => jwt.expressjwt({
    secret: jwt_secret,
    credentialsRequired: true,
    getToken: findToken,
    algorithms: ["HS256"]
})
  
export {
    findToken,
    authenticate
}
