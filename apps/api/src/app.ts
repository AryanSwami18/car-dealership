import express from 'express';

import { loginUser } from './auth/login.js';
import { registerUser } from './auth/register.js';

export const app = express();

app.use(express.json());
app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);
