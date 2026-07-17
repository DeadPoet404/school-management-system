import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SMS Core Backend API',
      version: '1.0.0',
      description: 'K-12 School Management System API for Ghanaian educational institutions',
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/modules/*/routes/*.ts', './src/modules/auth/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
