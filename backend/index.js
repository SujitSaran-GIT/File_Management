import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import connectDB from './config/db.js'
import fileRoutes  from './routes/fileRoute.js'
import previewRoute from './routes/previewRoute.js'

const app = express()
connectDB()

// Middleware
app.use(cors());
app.use(express.json());

dotenv.config()

// Routes
app.use('/api/files', fileRoutes);
app.use('/api/file',previewRoute)

const PORT = process.env.PORT || 8001

app.listen(PORT, () => console.log(`Server is running on port:${PORT}`))