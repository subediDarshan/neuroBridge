import { asynchandler } from "../utils/asynchandler.js";
import { Personal } from "../models/Personal.js";

const updatePersonalDetails = asynchandler(async (req, res, next) => {
    const { dob, gender, address, emergencyContact, medicalHistory, familyHistory, lifestyle, consentGiven } = req.body;
    const userId = req.user._id;

    // Check if a user with the given userId exists
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: User not found."
        });
    }

    // Prepare data to be updated
    const updateData = {
        dob,
        gender,
        address,
        emergencyContact,
        medicalHistory,
        familyHistory,
        lifestyle,
        consentGiven,
        userId: userId // Ensure userId is included for update/creation
    };

    // Find and update the user's personal info, or create it if it doesn't exist
    const personalInfo = await Personal.findOneAndUpdate(
        { userId: userId },
        { $set: updateData },
        { new: true, upsert: true, runValidators: true }
    );

    if (!personalInfo) {
        return res.status(500).json({
            success: false,
            message: "Failed to create or update personal information."
        });
    }

    return res.status(200).json({
        success: true,
        message: "Personal details updated successfully.",
        data: personalInfo
    });
});

export { updatePersonalDetails };