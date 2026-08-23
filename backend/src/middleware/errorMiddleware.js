function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found — ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Resource not found";
  }

  /**
   * A unique-index clash. The old message was "Duplicate field value entered",
   * which named neither the field nor the value — so naming a second product
   * after an existing one produced a refusal with nothing to act on. Mongo
   * tells us exactly what collided; pass it on.
   */
  if (err.code === 11000) {
    statusCode = 400;
    const [field, value] = Object.entries(err.keyValue || {})[0] || [];

    if (field === "slug") {
      message =
        `The web address "${value}" is already taken by another item. ` +
        `Edit the Slug field to something unique — two products cannot share one.`;
    } else if (field) {
      message = `Another record already uses ${field} "${value}", and it has to be unique.`;
    } else {
      message = "That value is already used by another record and has to be unique.";
    }
  }

  // Mongoose validation lists every invalid path; reporting only the first
  // means fixing one and being refused again for the next.
  if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(" ");
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
}

module.exports = { notFound, errorHandler };
