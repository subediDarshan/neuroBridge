














import { asynchandler } from "../utils/asynchandler.js";
import { User } from "../models/user.js";

/**
 * @description Generates access and refresh tokens for a user
 * @param {string} userId - The ID of the user
 * @returns {object} - An object containing the access and refresh tokens
 */
const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.accessToken(); // Corrected method name to match convention
        const refreshToken = user.RefreshToken(); // Assuming this is correct from your model

        user.refreshToken = refreshToken;
        // The `validateBeforeSave: false` is okay here since we are only updating the token, not user input.
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        // This will be caught by asynchandler
        throw new Error("Token generation failed. Please try again.");
    }
};

/**
 * @description Sets tokens as secure, httpOnly cookies in the response
 * @param {object} res - The Express response object
 * @param {object} tokens - Object containing accessToken and refreshToken
 */
const setTokenCookies = (res, tokens) => {
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    };
    res.cookie("accessToken", tokens.accessToken, options);
    res.cookie("refreshToken", tokens.refreshToken, options);
};

// --- CONTROLLER FUNCTIONS ---

const registerUser = asynchandler(async (req, res) => {
    const { username, emailId, password } = req.body;

    if ([username, emailId, password].some((field) => !field || field.trim() === "")) {
        return res.status(400).json({ // 400 Bad Request is more appropriate
            success: false,
            message: "All fields are required"
        });
    }

    const existedUser = await User.findOne({
        $or: [{ username: username.toLowerCase() }, { emailId }]
    });

    if (existedUser) {
        return res.status(409).json({ // 409 Conflict is the correct code for an existing resource
            success: false,
            message: "User with this username or email already exists"
        });
    }

    const user = await User.create({
        username: username.toLowerCase(),
        emailId,
        password,
    });

    // We get the created user back from the DB, excluding sensitive fields
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        return res.status(500).json({ // 500 for a server error where creation failed unexpectedly
            success: false,
            message: "Something went wrong while registering the user."
        });
    }

    // --- Improvement: Log the user in immediately after registration ---
    const tokens = await generateAccessAndRefreshToken(createdUser._id);
    setTokenCookies(res, tokens);

    return res.status(201).json({ // 201 Created is the correct status for a new resource
        success: true,
        message: "User registered and logged in successfully",
        data: {
            user: createdUser
        }
    });
});

const loginUser = asynchandler(async (req, res) => {
    // Only emailId and password are required for login based on your logic
    const { emailId, password } = req.body;

    if (!emailId || !password) {
        return res.status(400).json({ // 400 Bad Request
            success: false,
            message: "Email and password are required"
        });
    }

    const user = await User.findOne({ emailId });

    if (!user) {
        return res.status(404).json({ // 404 Not Found is correct here
            success: false,
            message: "User does not exist"
        });
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        return res.status(401).json({ // 401 Unauthorized for incorrect credentials
            success: false,
            message: "Invalid user credentials"
        });
    }

    const tokens = await generateAccessAndRefreshToken(user._id);
    setTokenCookies(res, tokens);

    // Send back user data so the frontend can update its state
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    return res.status(200).json({
        success: true,
        message: "User logged in successfully",
        data: {
            user: loggedInUser
        }
    });
});

const logoutUser = asynchandler(async (req, res) => {
    // req.user is added by your verifyJwt middleware
    await User.findByIdAndUpdate(
        req.user._id,
        { $set: { refreshToken: undefined } },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
    };

    // Clear both cookies
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json({
            success: true,
            message: "User logged out successfully"
        });
});

export { registerUser, loginUser, logoutUser };






