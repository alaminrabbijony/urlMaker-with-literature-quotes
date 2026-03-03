// middleware/globalErrorHandler.js

const { ZodError } = require("zod");
const AppError = require("./appError");


/* ----------------------------- ZOD ----------------------------- */

const handleZodError = (err) => {
  const formatted = err.issues.map(issue => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  return new AppError("Validation failed", 400, formatted);
};

/* ----------------------------- POSTGRES ----------------------------- */

const handleDuplicate = (err) => {
  const match = err.detail?.match(/Key \((.*?)\)=\((.*?)\) already exists/);

  let field = "unknown";
  let message = "Duplicate field value entered.";

  if (match) {
    field = match[1];
    const value = match[2];
    message = `The ${field} '${value}' is already taken.`;
  }

  return new AppError(message, 400, [{ field, message }]);
};

const handleNotNull = (err) => {
  const field = err.column || "unknown";
  const message = `The '${field}' field cannot be empty.`;

  return new AppError(message, 400, [{ field, message }]);
};

const handleForeignKey = (err) => {
  const match = err.detail?.match(/Key \((.*?)\)=\((.*?)\) is not present/);

  let field = "unknown";
  let message = "Invalid reference.";

  if (match) {
    field = match[1];
    const value = match[2];
    message = `The referenced ${field} '${value}' does not exist.`;
  }

  return new AppError(message, 400, [{ field, message }]);
};

const handleInvalidText = (err) => {
  const match = err.message?.match(/invalid input syntax for type (.*?): "(.*?)"/);

  let field = "unknown";
  let message = "Invalid data format.";

  if (match) {
    const type = match[1];
    const value = match[2];
    message = `'${value}' is not a valid ${type}.`;
  }

  return new AppError(message, 400, [{ field, message }]);
};

const postgresHandler = (err) => {
  switch (err.code) {
    case "23505": return handleDuplicate(err);
    case "23502": return handleNotNull(err);
    case "23503": return handleForeignKey(err);
    case "22P02": return handleInvalidText(err);
    default: return err;
  }
};

/* ----------------------------- JWT ----------------------------- */

const handleJWTError = () =>
  new AppError("Invalid token. Please login again.", 401);

const handleTokenExpired = () =>
  new AppError("Token expired. Please login again.", 401);

/* ----------------------------- RESPONSE ----------------------------- */

const devErr = (err, res) => {
  return res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    errors: err.errors,
    stack: err.stack,
  });
};

const prodErr = (err, res) => {
  if (!err.isOperational) {
    console.error("💥 UNEXPECTED ERROR:", err);

    return res.status(500).json({
      status: "error",
      message: "Something went very wrong!",
      errors: [],
    });
  }

  return res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    errors: err.errors,
  });
};

/* ----------------------------- GLOBAL HANDLER ----------------------------- */

const globalErrorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let error = err;

  // Zod
  if (error instanceof ZodError) {
    error = handleZodError(error);
  }

  // Postgres
  error = postgresHandler(error);

  // JWT
  if (error.name === "JsonWebTokenError") {
    error = handleJWTError();
  }

  if (error.name === "TokenExpiredError") {
    error = handleTokenExpired();
  }

  // filee up
// if (error.name === "MulterError") {
//   const message = error.code === "LIMIT_FILE_SIZE" 
//     ? "File is too large. Please upload a smaller file." 
//     : `File upload error: ${error.message}`;
//   error = new AppError(message, 400);
// }

  // Normalize
  error.statusCode = error.statusCode || 500;
  error.status = error.status || "error";

  if (process.env.NODE_ENV === "development") {
    return devErr(error, res);
  }

  return prodErr(error, res);
};

module.exports = globalErrorHandler;