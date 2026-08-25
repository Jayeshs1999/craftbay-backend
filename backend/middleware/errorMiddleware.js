const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  if (err.name === "CastError") {
    return res.status(404).json({ message: "Resource not found" });
  }
  if (err.code === 11000) {
    return res.status(400).json({ message: "Duplicate field value" });
  }

  // Multer errors (file too large, wrong type, etc.)
  if (err.name === "MulterError") {
    return res.status(400).json({ message: err.message });
  }

  res.status(statusCode).json({
    message: err.message || "Something went wrong",
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export { notFound, errorHandler };
