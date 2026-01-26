import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ENV } from "./libs/env.js";

const app = express();

// middleware
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());
app.use(cookieParser());

const PORT = ENV.PORT;

const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
  });
};

startServer();
