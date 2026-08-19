const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const authRoutes = require("./routes/authRoutes");
const subcategoryRoutes = require("./routes/subcategoryRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const attributeRoutes = require("./routes/attributeRoutes");
const attributeGroupRoutes = require("./routes/attributeGroupRoutes");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/subcategories", subcategoryRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/attribute-groups", attributeGroupRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
