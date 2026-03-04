const { eq, and, gt, isNull } = require("drizzle-orm");
const { db } = require("../db");
const {
  usersTable,
  resetPasswordTable,
  passwordChangeHistoryTable,
} = require("../models/usersMOdel");
const AppError = require("../util/appError");
const catchAsync = require("../util/catchAsync");
const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const { promisify } = require("util");
const {
  userSchema,
  loginUserSchema,
  forgetPasswordUserSchema,
  resetPasswordSchema,
} = require("../util/validation");
const {
  genRandToken,
  hashToken,
  hashPassword,
} = require("../util/hashedTokenGenerator");
const sendMail = require("../util/sendMail");

const signToken = (id) => {
  return jwt.sign({ id: id }, process.env.SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

exports.register = catchAsync(async (req, res, next) => {
  //console.log(process.env.DB_URL);
  console.log(req.body);
  const { email, name, password } = await userSchema.parseAsync(req.body);

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
  const hashedPassword = await hashPassword(password);

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
  const { email, password } = await loginUserSchema.parseAsync(req.body);
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
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
console.log(req.headers.authorization);
console.log(token);
  if (!token || token === "null" || token === "undefined") {
  return next(new AppError("You are not logged in", 401));
}
  const decoded = await promisify(jwt.verify)(token, process.env.SECRET);

  const [currUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, decoded.id));
  if (!currUser) return next(new AppError("No user found😔😔", 401));

  if (currUser.passwordChangedAt) {
    const changeTime = Math.floor(
      new Date(currUser.passwordChangedAt).getTime() / 1000,
    );

    if (changedTime > decoded.iat) {
      return next(
        new AppError("Password recently changed. Please log in again.", 401),
      );
    }
  }

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

exports.forgotPassword = catchAsync(async (req, res, next) => {
  //1) get the user based on POSTed email
  const { email } = await forgetPasswordUserSchema.parseAsync(req.body);
  // gives returns an array with 1st el ebven if there are 5 el
  // const [user] = await db
  //   .select()
  //   .from(usersTable)
  //   .where(eq(usersTable.email, email));
  // console.log(email)
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });
  // console.log(user)
  if (!user) {
    return res.status(200).json({
      status: "success",
      message: "If that email exists, a reset link has been sent.",
    });
  }

  //2) Generate the reset token
  const token = genRandToken();
  const hashedToken = hashToken(token);

  await db.transaction(async (tx) => {
    //3) Mark all token as used
    await tx
      .update(resetPasswordTable)
      .set({
        usedAt: new Date(),
      })
      .where(
        and(
          eq(resetPasswordTable.userId, user.id),
          isNull(resetPasswordTable.usedAt),
        ),
      );

    //4) insert token in the db
    await tx.insert(resetPasswordTable).values({
      userId: user.id,
      tokenHash: hashedToken,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), //5 min
    });
  });

  try {
    //5) Send the token to the mail

    const resetUrl = `${req.protocol}://${req.get("host")}/api/v1/users/reset/${token}`;
    const message = `Forgot ur password?\n Submit a PATCH req with ur new password and confirm password in this URL\n ${resetUrl}\n If u didnt then ignore this email`;

    await sendMail({
      email: email,
      subject: "Reset Password",
      message,
    });
    res.status(200).json({
      status: "success",
      message: "Token send to email",
      resetUrl,
    });
  } catch (error) {
    //6) clean reset token
    await db
      .update(resetPasswordTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(resetPasswordTable.userId, user.id),
          isNull(resetPasswordTable.usedAt),
        ),
      );

    return next(
      new AppError("Something went wrong while sending email😥😥😥", 500),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  //1. Get the user with the token

  const hashedToken = hashToken(req.params.token);
  //2. If token has not expired , there is a user so set the password
  const tokenRow = await db.query.resetPasswordTable.findFirst({
    where: and(
      eq(resetPasswordTable.tokenHash, hashedToken),
      gt(resetPasswordTable.expiresAt, new Date()),
      isNull(resetPasswordTable.usedAt),
    ),
  });
  if (!tokenRow) return next(new AppError("Token is invalid or expired", 400));
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, tokenRow.userId),
  });
  if (!user) return next(new AppError("User not found", 404));

  //3. change password
  const { password } = await resetPasswordSchema.parseAsync(req.body);
  const hashedPassword = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({
        password: hashedPassword,
        //3. Change the updatPasswordAt
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));
    //documet the password change history
    await tx.insert(passwordChangeHistoryTable).values({
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await tx
      .update(resetPasswordTable)
      .set({ usedAt: new Date() })
      .where(eq(resetPasswordTable.id, tokenRow.id));
  });

  //4. Log user and send jwt
  //const token = signToken(user.id);
  const token = signToken(tokenRow.userId);
  res.status(200).json({
    status: "success",
    token,
  });
});
