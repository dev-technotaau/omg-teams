import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env.js";

const swaggerDefinition: swaggerJsdoc.Options["definition"] = {
  openapi: "3.1.0",
  info: {
    title: "OMG Teams API",
    version: "1.0.0",
    description: "OMG Teams Backend REST API Documentation",
    license: {
      name: "ISC",
    },
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}`,
      description: "Local development",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
};

export const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: ["./src/routes/**/*.ts", "./src/controllers/**/*.ts", "./src/schemas/**/*.ts"],
});
