

import mongoose, { Schema } from "mongoose";

// Based on your personal.controllers.js, the schema should look like this.
const personalSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true
        },
        dob: { type: Date },
        gender: { type: String },
        address: { type: String },
        emergencyContact: { type: String },
        medicalHistory: { type: String },
        familyHistory: { type: String },
        lifestyle: { type: String },
        consentGiven: { type: Boolean, default: false }
    }, {
        timestamps: true,
        // This is the final, crucial fix.
        // It forces this model to use the 'personals' collection
        // inside your 'health_data_db' database.
        collection: 'personals'
    }
);

export const Personal = mongoose.model('Personal', personalSchema);

