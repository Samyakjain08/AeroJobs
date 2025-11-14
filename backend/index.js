import express from "express";
const app= express();
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config({}); // Must run first to load variables
import connectDB from "./utils/db.js"; // Import DB connection utility
import userRoute from "./routes/user.js"
import chatRoute from "./routes/chat.js"
import companyRoute from "./routes/company.js"
import jobRoute from "./routes/job.js";
import applicationRoute from "./routes/application.js";
import path from "path";


const _dirname= path.resolve();

app.get("/home", (req,res)=>{
 return res.status(200).json({
message: "I am coming from backend",
 success: true
})
})

const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'].filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {

        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);

        if (process.env.NODE_ENV !== 'production') {
            console.warn('CORS allowing unexpected origin in dev:', origin);
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
};


app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cors(corsOptions));
app.use(cookieParser());


app.use('/api/v1/chat', (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    }
 
    next();
});
app.use("/api/v1/user", userRoute);
app.use("/api/v1/company", companyRoute);
app.use("/api/v1/job", jobRoute);
app.use("/api/v1/application", applicationRoute);
app.use("/api/v1/chat", chatRoute);


app.use(express.static(path.join(_dirname, "frontend", "dist")));
app.get('*', (_,res)=>{
    res.sendFile(path.resolve(_dirname, "frontend", "dist", "index.html"));
})


const PORT = process.env.PORT || 8001; 

const server = app.listen(PORT, ()=>{
    connectDB(); 
    console.log(`Server connected at PORT:${PORT}`)
});

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please free the port or set PORT env to a free port.`);

        process.exit(1);
    }
    console.error('Server error:', err);
});
