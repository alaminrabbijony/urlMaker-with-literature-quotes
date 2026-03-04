const z = require("zod");

const userSchema = z
  .object({
    name: z
      .string({
        required_error: "Name is required",
        invalid_type_error: "Name must be a string",
      })
      .min(3, { message: "Name must be at least 3 characters long" }),

    email: z
      .string({
        required_error: "Email is required",
        invalid_type_error: "Email must be a string",
      })
      .email({ message: "Invalid email address" }),

    password: z
      .string({
        required_error: "Password is required",
        invalid_type_error: "Password is required",
      })
      .min(3, { message: "Password must be at least 3 characters long" }),

    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"], // attach err to the confirm password
  })
  .strict();

const loginUserSchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
      invalid_type_error: "Email must be a string",
    })
    .email({ message: "Invalid email address" }),

  password: z
    .string({
      required_error: "Password is required",
    })
    .min(3, { message: "Password must be at least 3 characters long" }),
});

const forgetPasswordUserSchema = z.object({
  email: z
    .string({
      required_error: "Email is required",
      invalid_type_error: "Email must be a string",
    })
    .email({ message: "Invalid email address" }),
});

const resetPasswordSchema = z
  .object({
    password: z
      .string({
        required_error: "Password is required",
        invalid_type_error: "Password is required",
      })
      .min(3, { message: "Password must be at least 3 characters long" }),

    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    password: "Both password dont match",
    path: ["confirmPassword"],
  })
  .strict();

const cusUrlSchema = z.object({
  code: z
    .string()
    .min(3, { message: "Password must be at least 3 characters long" })
    .optional(),
  targetUrl: z.string(),
  activeTime: z.number().int().positive().max(365).default(7)
});

module.exports = {
  userSchema,
  resetPasswordSchema,
  loginUserSchema,
  forgetPasswordUserSchema,
  cusUrlSchema
};
