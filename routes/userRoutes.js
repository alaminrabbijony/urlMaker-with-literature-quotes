const express = require("express");
const { register, login, protect, resetPassword, forgotPassword } = require("../controllers/authControllers");

const router = express.Router();

router.route("/register").post(register);
router.route("/login").post(login);


router.post('/forgot-password', forgotPassword)
router.patch('/reset/:token', resetPassword)

module.exports = router;
