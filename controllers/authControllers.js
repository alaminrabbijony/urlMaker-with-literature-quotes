const { eq } = require("drizzle-orm");
const { db } = require("../db");
const { usersTable } = require("../models/usersMOdel");
const AppError = require("../util/appError");
const catchAsync = require("../util/catchAsync");
const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const { promisify } = require("util");
const signToken = (id) => {
  return jwt.sign({ id: id }, process.env.SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

exports.register = catchAsync(async (req, res, next) => {
  console.log(process.env.DB_URL);
  const { email, name, password } = req.body;

  if (!email || !name || !password)
    return next(new AppError("Plz prvide all the credentials", 400));

  //check weither user already exists
  const [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existingUser) {
    return next(new AppError("User already exists", 400));
  }
  //

  //Hash the password
  const hashedPassword = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  //CREATE NEW USER

  const [newUser] = await db
    .insert(usersTable)
    .values({ name, email, password: hashedPassword, role: "user" })
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      
    });

  //SEND TOKEN

  const token = signToken(newUser.id);

  res.status(201).json({
    status: "success",
    token,
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password)
    return next(new AppError("Please provide all fields", 400));

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user || !(await argon2.verify(user.password, password)))
    return next(new AppError("Invalid email or password", 400));

  const token = signToken(user.id);

  res.status(200).json({
    status: "success",
    token,
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[0];
  }

  if (!token) return next(new AppError("U are not logged in ✋🚫", 401));

  const decoded = await promisify(jwt.verify(token, process.env.SECRET));

  const currUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, decoded.id));
  if (!currUser) return next(new AppError("No user found😔😔", 401));
  req.user = currUser;

  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("U dont have authorization to this content 😥😥😥", 403),
      ); //403 => forbidden
    }
    next();
  };
};
