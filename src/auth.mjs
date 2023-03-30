const expressJwt = require('express-jwt')
const jwt_secret = process.env.

module.exports = () => {
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
  
    const authenticate = expressJwt({
      secret: jwt_secret,
      credentialsRequired: true,
      getToken: findToken,
      algorithms: ["HS256"]
    })
  
    const loginCheck = expressJwt({
      secret: jwt_secret,
      credentialsRequired: false,
      getToken: findToken,
      algorithms: ["HS256"]
    })
  
    return {
      findToken,
      authenticate,
      loginCheck
    }
  }