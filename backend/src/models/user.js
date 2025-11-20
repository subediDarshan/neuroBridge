

import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
        },
        emailId: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: [true, 'password is required'],
        },
        refreshToken: {
            type: String,
        }
    }, {
        timestamps: true,
        // This is the crucial line that was missing.
        // It forces this model to use the 'users' collection
        // in the database you are connected to (health_data_db).
        collection: 'users'
    }
);

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
}

userSchema.methods.accessToken = function () {
    return jwt.sign({
        _id: this._id,
        email: this.emailId,
        username: this.username
    },
        process.env.ACCESS_TOKEN_SECRET_KEY,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY_DATE
        }
    )
}

userSchema.methods.RefreshToken = function () {
    return jwt.sign({
        _id: this._id
    },
        process.env.REFRESH_TOKEN_SECRET_KEY,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY_DATE
        }
    )
}

export const User = mongoose.model('User', userSchema);

