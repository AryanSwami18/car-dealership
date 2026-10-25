import express from 'express';

import { loginUser } from './auth/login.js';
import { registerUser } from './auth/register.js';
import { authenticateRequest } from './auth/authenticate.js';
import { authorizeRoles } from './auth/authorize.js';
import { createVehicle } from './vehicles/create.js';
import { listVehicles } from './vehicles/list.js';
import { updateVehicle } from './vehicles/update.js';

export const app = express();

app.use(express.json());
app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);
app.post('/api/vehicles', authenticateRequest, authorizeRoles('ADMIN'), createVehicle);
app.get('/api/vehicles', authenticateRequest, listVehicles);
app.put('/api/vehicles/:id', authenticateRequest, authorizeRoles('ADMIN'), updateVehicle);
