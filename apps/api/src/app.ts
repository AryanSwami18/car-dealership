import express from 'express';

import { registerUser } from './auth/register.js';

export const app = express();

app.use(express.json());
app.post('/api/auth/register', registerUser);
