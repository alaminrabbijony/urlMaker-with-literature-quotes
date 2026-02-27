const express = require('express')
const app = require("express")
const  helmet  = require("helmet")
const cors = require("cors")
const morgan = require("morgan")
const { default: rateLimit } = require("express-rate-limit")
const compression = require('compression')
const AppError = require('./util/appError')


/* =======================================================
   1. TRUST PROXY (important behind Nginx/Render/Heroku)
======================================================= */
app.set('trust proxy',1)

/* =======================================================
   2. GLOBAL SECURITY
======================================================= */

app.use(helmet())
app.use(cors())

if(process.env.NODE_ENV === "development") app.use(morgan("dev"))

/* =======================================================
   3. HOT PATH — REDIRECT ENGINE
   (Minimal middleware, maximum speed)
======================================================= */

const redirectLimiter = rateLimit({
    windowMs: 15 *60 *1000,
    max: 1500,
    standardHeaders: true,
    legacyHeaders: false
})

//Short Code: app.get('/shortcode', redirectLimiter, redirectToOriginal)


/* =======================================================
   4. API PIPELINE (Creation & Management)
   Heavy middleware isolated here
======================================================= */

const apiLimiter = rateLimit({
    windowMs: 15 * 60 *1000,
    max: 100,
    message: "Too many attempts🛑"
})

app.use("/api", [
    apiLimiter,
    express.json({limit: '10kb'}),
    express.urlencoded({extended: true,limit: "10kb"}),
    hpp(),
    compression() // only compress api respones
])

/* =======================================================
   5. Routers
======================================================= */


/* =======================================================
   6. 404 unhandle routes
======================================================= */
app.use((req, res, next) => {
    next(new AppError(`Cant find ${req.originalUrl} on this server 😥`, 404))
})

/* =======================================================
   7. GLOBAL ERROR HANDLER
======================================================= */

module.exports = app