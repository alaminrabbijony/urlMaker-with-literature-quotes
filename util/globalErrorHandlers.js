const { ZodError } = require("zod");
const AppError = require("./appError");

/* ----------------------------------------- ZOD ----------------------------------------- */

const handleZodErrors = (err) => {
  // 1. Map through the Zod issues and create an array of strings
  const errorMessages = err.issues.map((issue) => {
    const fieldName = issue.path.join(".");
    return `${fieldName}: ${issue.message}`;
  });

  // 2. Join the array into a single sentence
  const combinedMessage = `Validation Failed. ${errorMessages.join(", ")}`;

  // 3. Pass only the combined string to your AppError (no need for the array anymore)
  return new AppError(combinedMessage, 400);
};

/* ----------------------------------------- POSTGRES ----------------------------------------- */

/* ----------------------------------------- POSTGRES ----------------------------------------- */

const handleDuplicateFieldsDB = (err) => {
  // Postgres err.detail looks like: Key (email)=(test@example.com) already exists.
  // We use regex to extract the field name and the value they entered.
  const match = err.detail?.match(/Key \((.*?)\)=\((.*?)\) already exists/);

  let message = "Duplicate field value entered. Please use another value.";
  if (match) {
    const field = match[1];
    const value = match[2];
    message = `The ${field} '${value}' is already taken. Please use a different ${field}.`;
  }

  return new AppError(message, 400);
};

const handleNotNullViolation = (err) => {
  // Postgres err.column gives us the exact column name that was null
  const column = err.column || "Required";
  const message = `The '${column}' field cannot be empty. Please provide a valid value.`;

  return new AppError(message, 400);
};

const handleForeignKeyViolation = (err) => {
  // err.detail looks like: Key (user_id)=(123) is not present in table "users".
  const match = err.detail?.match(/Key \((.*?)\)=\((.*?)\) is not present/);

  let message = "Invalid reference. The related record does not exist.";
  if (match) {
    const field = match[1];
    const value = match[2];
    message = `The referenced ${field} ('${value}') does not exist in our system.`;
  }

  return new AppError(message, 400);
};

const handleInvalidTextRepresentation = (err) => {
  // Happens when you send a string to a UUID or Integer column
  // err.message looks like: invalid input syntax for type uuid: "hello"
  const match = err.message?.match(
    /invalid input syntax for type (.*?): "(.*?)"/,
  );

  let message = "Invalid data format provided for one of the fields.";
  if (match) {
    const type = match[1];
    const value = match[2];
    message = `The value '${value}' is invalid. It must be a valid ${type} format.`;
  }

  return new AppError(message, 400);
};

const handleValueTooLongDB = () => {
  return new AppError(
    "One of your inputs exceeds the maximum allowed length.",
    400,
  );
};

const handleCheckConstraintDB = (err) => {
  // Extracting the constraint name if possible
  const constraint = err.constraint || "data";
  return new AppError(
    `The provided data violates the '${constraint}' constraint.`,
    400,
  );
};

const postgresErr = (error) => {
  switch (error.code) {
    case "23505":
      error = handleDuplicateFieldsDB(error);
      break;
    case "23502":
      error = handleNotNullViolation(error);
      break;
    case "23503":
      error = handleForeignKeyViolation(error);
      break;
    case "22P02":
      error = handleInvalidTextRepresentation(error);
      break;
    case "22001":
      error = handleValueTooLongDB();
      break;
    case "23514":
      error = handleCheckConstraintDB(error);
      break;
    default:
      break;
  }
  return error;
};

/* ----------------------------------------- JWT ----------------------------------------- */

const handleJWTError = () =>
  new AppError("Invalid token. Please login again.", 401);

const handleTokenExpiredError = () =>
  new AppError("Token expired. Please login again.", 401);

/* ----------------------------------------- RESPONSE FORMATTERS ----------------------------------------- */

const devErrors = (err, res) => {
  return res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    errors: err.errors || null,
    stack: err.stack,
  });
};

const prodErrors = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      //errors: err.errors || null,
    });
  }

  console.error("ERROR 💥", err);

  return res.status(500).json({
    status: "error",
    message: "Something went very wrong!",
  });
};

/* ----------------------------------------- GLOBAL HANDLER ----------------------------------------- */

const globalErrorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let error = err;

  //conn
  if (error.code === "ECONNREFUSED") {
    error = new AppError("Database connection failed.", 500);
  }

  // Zod
  if (error instanceof ZodError) {
    error = handleZodErrors(error);
  }

  // Postgres
  error = postgresErr(error);
  // JWT
  if (error.name === "JsonWebTokenError") error = handleJWTError();
  if (error.name === "TokenExpiredError") error = handleTokenExpiredError();

  // FILE UPLOAD
  // if (error.name === "MulterError") {
  //   const message = error.code === "LIMIT_FILE_SIZE"
  //     ? "File is too large. Please upload a smaller file."
  //     : `File upload error: ${error.message}`;
  //   error = new AppError(message, 400);
  // }
  //Others
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return new AppError(
      "Invalid JSON payload passed. Please check your formatting.",
      400,
    );
  }
  // Normalize
  error.statusCode = error.statusCode || 500;
  error.status = error.status || "error";

  // ENV SPLIT
  if (process.env.NODE_ENV === "development") {
    return devErrors(error, res);
  }

  return prodErrors(error, res);
};

module.exports = globalErrorHandler;
