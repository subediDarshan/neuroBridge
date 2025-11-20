

import mongoose from "mongoose";
import dotenv from "dotenv"
dotenv.config();
const MONGO_URI = process.env.MONGO_URI;

// EXPORT DEFAULT FUNCTION
const MONGODB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log(" Connected to MongoDB");
    } catch (error) {
        console.error(" MongoDB connection error:", error.message);
        process.exit(1);
    }
};

export default MONGODB;
