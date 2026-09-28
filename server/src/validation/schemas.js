const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100),
  email: z.string().trim().toLowerCase().email('a valid email is required'),
  password: z.string().min(8, 'password must be at least 8 characters').max(72),
  role: z.enum(['TENANT', 'LANDLORD'], { message: 'role must be TENANT or LANDLORD' }),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('a valid email is required'),
  password: z.string().min(1, 'password is required'),
});

const createPropertySchema = z.object({
  address: z.string().trim().min(1, 'address is required').max(200),
  unitName: z.string().trim().max(100).optional().or(z.literal('')),
});

const joinPropertySchema = z.object({
  joinCode: z.string().trim().min(1, 'joinCode is required'),
});

const createRequestSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(150),
  description: z.string().trim().min(1, 'description is required').max(2000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED'], {
    message: 'status must be one of OPEN, IN_PROGRESS, RESOLVED',
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  createPropertySchema,
  joinPropertySchema,
  createRequestSchema,
  updateStatusSchema,
};
