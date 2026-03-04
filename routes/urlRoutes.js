const express = require('express')
const { protect } = require('../controllers/authControllers')
const { postUrl, getUrl } = require('../controllers/urlControllers')

const router = express.Router()


/**
 * FORM: https://www.youtube.com/
 * TO: liturl/Eleanor Roosevelt->The future belongs to those who believe in the beauty of their dreams
*/

router.get('/:shortCode',getUrl)

//router.use(protect)


router.post('/postUrl',protect,postUrl )


module.exports = router